/**
 * DLavie OS — WhatsApp Connection Manager v2.2
 * Fix: QR fallback, 428/405 loop prevention, exponential backoff, login gate
 */

const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');
const pino   = require('pino');
const fs     = require('fs');
const path   = require('path');

const config  = require('./config');
const { loadCommands, handleMessage } = require('./commandLoader');
const { getEngine }       = require('./core/engine');
const { getMessageQueue } = require('./queue/messageQueue');
const { getAntiBan }      = require('./antiban/antiBan');

const AUTH_DIR    = 'auth_info_baileys';
const MAX_RETRIES = 10;

// ─── State global ───
let sock           = null;
let retryCount     = 0;
let authClearCount = 0;   // Batasi berapa kali clear auth (anti-loop 428)
let reconnectTimer = null;
let isConnecting   = false;
let isLoggedOut    = false;

// ─── Hapus auth state untuk fresh session ───
function clearAuthState() {
  try {
    if (fs.existsSync(AUTH_DIR)) {
      const files = fs.readdirSync(AUTH_DIR);
      files.forEach(f => {
        try { fs.unlinkSync(path.join(AUTH_DIR, f)); } catch (_) {}
      });
      console.log('[DLAVIE][WA] Auth state cleared for fresh session');
    }
  } catch (err) {
    console.warn('[DLAVIE][WA] Could not clear auth:', err.message);
  }
}

// ─── Print QR ke terminal (fallback jika tanpa pairing code) ───
function printQR(qr) {
  try {
    const qrcode = require('qrcode-terminal');
    console.log('\n' + '═'.repeat(60));
    console.log('📱  SCAN QR CODE INI DI WHATSAPP');
    console.log('    WhatsApp → Perangkat Tertaut → Tautkan Perangkat → Scan QR');
    console.log('═'.repeat(60));
    qrcode.generate(qr, { small: true });
    console.log('═'.repeat(60) + '\n');
  } catch (_) {
    // Fallback jika qrcode-terminal tidak terinstall
    console.log('\n[DLAVIE][WA] QR Code (paste ke https://www.qr-code-generator.com):');
    console.log(qr);
    console.log('[DLAVIE][WA] Atau install: npm install qrcode-terminal\n');
  }
}

// ─── Koneksi utama ───
async function connectToWhatsApp() {
  if (isConnecting || isLoggedOut) return;
  isConnecting = true;

  const attempt = retryCount + 1;
  console.log(`[DLAVIE][WA] Starting DLavie OS Bot v2.0 (attempt ${attempt}/${MAX_RETRIES})...`);

  try {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const commands = loadCommands();
    const antiBan  = getAntiBan(config.antiBan || {});
    const msgQueue = getMessageQueue(config.queue || {});

    const botNum   = String(config.botNumber || '').replace(/\D/g, '');
    const useQR    = !botNum;                     // fallback ke QR jika tanpa nomor
    const alreadyRegistered = state.creds.registered;

    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
      },
      mobile:                   false,
      connectTimeoutMs:         60_000,
      defaultQueryTimeoutMs:    30_000,
      keepAliveIntervalMs:      25_000,
      retryRequestDelayMs:      500,
      emitOwnEvents:            false,
      fireInitQueries:          true,
      shouldSyncHistoryMessage: () => false,
      getMessage:               async () => ({ conversation: '' }),
      generateHighQualityLinkPreview: false,
    });

    // ─── Mode PAIRING CODE (BOT_NUMBER diset) ───
    if (!useQR && !alreadyRegistered) {
      if (botNum.length < 10 || botNum.length > 15) {
        console.error(`[DLAVIE][WA] ❌ Format BOT_NUMBER tidak valid: "${botNum}" (harus 10-15 digit)`);
        isConnecting = false;
        return;
      }

      // Tunggu socket stabil dulu sebelum minta pairing code
      setTimeout(async () => {
        try {
          console.log(`[DLAVIE][WA] Meminta pairing code untuk nomor: ${botNum}...`);
          const code = await sock.requestPairingCode(botNum);
          if (code) {
            const fmt = code.match(/.{1,4}/g)?.join('-') || code;
            console.log('\n' + '═'.repeat(55));
            console.log('🔑  PAIRING CODE: ' + fmt);
            console.log('═'.repeat(55));
            console.log('📱 WhatsApp → Menu (3 titik) → Perangkat Tertaut');
            console.log('   → Tautkan Perangkat → Masukkan Kode');
            console.log('═'.repeat(55) + '\n');
          }
        } catch (err) {
          const msg  = err.message || '';
          const code = err?.output?.statusCode;

          if (code === 405 || msg.includes('405')) {
            console.warn('[DLAVIE][WA] ⚠️  405 — Sesi lama aktif. Membersihkan auth...');
            _handleSessionConflict(20_000);
          } else if (code === 428 || msg.includes('428')) {
            console.warn('[DLAVIE][WA] ⚠️  428 — Session conflict. Membersihkan auth...');
            _handleSessionConflict(25_000);
          } else if (code === 429 || msg.includes('rate-overlimit') || msg.includes('429')) {
            console.warn('[DLAVIE][WA] ⚠️  Rate limit WhatsApp. Tunggu 90 detik...');
            scheduleReconnect(90_000);
          } else if (msg.includes('Connection Closed') || msg.includes('connection')) {
            console.warn('[DLAVIE][WA] ⚠️  Koneksi terputus saat request pairing code. Retry...');
            scheduleReconnect(_backoffDelay(retryCount));
          } else {
            console.error('[DLAVIE][WA] Pairing code error:', msg);
            scheduleReconnect(_backoffDelay(retryCount++));
          }
        }
      }, 5_000);

    } else if (useQR && !alreadyRegistered) {
      // ─── Mode QR ───
      console.log('[DLAVIE][WA] Mode QR aktif. Menunggu scan...');
      console.log('[DLAVIE][WA] 💡 Tip: Set BOT_NUMBER di .env untuk pakai Pairing Code (lebih mudah)');
    } else {
      console.log('[DLAVIE][WA] Sesi tersimpan ditemukan. Melanjutkan koneksi...');
    }

    // ─── Connection Update ───
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && useQR) {
        printQR(qr);
      }

      if (connection === 'open') {
        retryCount    = 0;
        authClearCount = 0;
        isConnecting  = false;
        console.log(`[DLAVIE][WA] ✅ Connected! Bot aktif sebagai ${config.botName}`);
        _notifyEngine('bot.connected');
      }

      if (connection === 'close') {
        isConnecting = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason     = _errorReason(statusCode);
        console.log(`[DLAVIE][WA] Koneksi ditutup: ${statusCode || 'unknown'} — ${reason}`);

        // Sengaja logout → jangan reconnect
        if (statusCode === DisconnectReason.loggedOut) {
          console.log('[DLAVIE][WA] Logged out. Hapus folder auth_info_baileys dan restart.');
          isLoggedOut = true;
          clearAuthState();
          return;
        }

        // 405/428 session conflict → clear auth, batasi 3x saja
        if (statusCode === 405 || statusCode === 428) {
          _handleSessionConflict(_backoffDelay(retryCount++));
          return;
        }

        // Rate limit
        if (statusCode === 429 || statusCode === 503) {
          console.warn('[DLAVIE][WA] Rate limited. Tunggu 120 detik...');
          scheduleReconnect(120_000);
          return;
        }

        // 515 = restart required
        if (statusCode === 515) {
          console.warn('[DLAVIE][WA] WhatsApp minta restart. Reconnecting...');
          scheduleReconnect(3_000);
          return;
        }

        // Disconnect normal → reconnect dengan backoff
        scheduleReconnect(_backoffDelay(retryCount++));
      }

      if (connection === 'connecting') {
        console.log('[DLAVIE][WA] Connecting to WhatsApp...');
      }
    });

    // ─── Creds update ───
    sock.ev.on('creds.update', saveCreds);

    // ─── Message Handler (queue + anti-ban) ───
    sock.ev.on('messages.upsert', async (m) => {
      if (!m.messages?.length) return;
      const msg = m.messages[0];
      if (!msg.message || msg.key.fromMe) return;

      const jid    = msg.key.remoteJid;
      const body   = _extractBody(msg) || '';
      const prefix = config.botPrefix || config.bot?.prefix || '!';

      if (!body.startsWith(prefix)) return;

      const userId = (msg.key.participant || jid || '')
        .replace('@s.whatsapp.net', '').replace('@g.us', '').replace(/\D/g, '');

      let userPlan = 'free';
      try {
        const { getWebAuth } = require('./auth/webAuth');
        userPlan = getWebAuth().getUserPlan(userId) || 'free';
      } catch (_) {}

      const isPriority  = ['pro', 'enterprise'].includes(userPlan);
      const processTask = async () => handleMessage(sock, m, commands, config, antiBan);

      if (isPriority) {
        try { await processTask(); } catch (err) {
          console.error('[DLAVIE][WA] Message handler error:', err.message);
        }
        return;
      }

      // Free/Starter → antrian
      try {
        const queuePos = msgQueue.getQueuePosition(userId);
        if (queuePos && queuePos.position > 1) {
          const wait = Math.ceil(queuePos.estimatedWaitMs / 1000);
          try {
            await antiBan.safeSend(sock, jid, {
              text: `⏳ *DLavie OS — Antrian*\n\n📍 Posisi kamu: *#${queuePos.position}* dari ${queuePos.total}\n⏱️ Estimasi: *~${wait} detik*\n\n💡 Upgrade ke *Pro* untuk bypass antrian!`
            });
          } catch (_) {}
          return;
        }
        await msgQueue.enqueue(processTask, userId, userPlan);
      } catch (err) {
        if (err.code === 'QUEUE_FULL') {
          try {
            await antiBan.safeSend(sock, jid, {
              text: `⚠️ *Antrian Penuh* (${err.queueSize} orang)\n\nCoba beberapa menit lagi, atau upgrade ke *Pro* untuk bypass antrian!`
            });
          } catch (_) {}
        } else if (err.code !== 'ALREADY_QUEUED') {
          console.error('[DLAVIE][WA] Queue error:', err.message || err);
        }
      }
    });

    // ─── Socket error ───
    sock.ev.on('error', (err) => {
      console.error('[DLAVIE][WA] Socket error:', err.message);
      try {
        const errs = getEngine().getSystem('errors');
        if (errs) errs.report(err, { source: 'wa_socket' });
      } catch (_) {}
    });

    return sock;

  } catch (err) {
    isConnecting = false;
    console.error('[DLAVIE][WA] Connection setup error:', err.message);
    scheduleReconnect(_backoffDelay(retryCount++));
  }
}

// ─── Handle session conflict (405/428) — anti-loop ───
function _handleSessionConflict(delayMs) {
  if (authClearCount >= 3) {
    console.error('[DLAVIE][WA] ❌ Auth sudah di-clear 3x tapi masih conflict.');
    console.error('[DLAVIE][WA]    Kemungkinan nomor sedang dipakai perangkat lain.');
    console.error('[DLAVIE][WA]    Tunggu 10 menit sebelum mencoba lagi...');
    scheduleReconnect(600_000);   // tunggu 10 menit
    return;
  }
  authClearCount++;
  clearAuthState();
  scheduleReconnect(delayMs);
}

// ─── Schedule reconnect ───
function scheduleReconnect(delayMs) {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (isLoggedOut) return;

  if (retryCount >= MAX_RETRIES) {
    console.error(`[DLAVIE][WA] ❌ Gagal connect setelah ${MAX_RETRIES}x percobaan.`);
    console.error('[DLAVIE][WA]    Restart manual diperlukan. Periksa .env dan nomor WA.');
    return;
  }

  const delaySec = Math.round(delayMs / 1000);
  console.log(`[DLAVIE][WA] Reconnect dalam ${delaySec}s... (percobaan ${retryCount}/${MAX_RETRIES})`);

  reconnectTimer = setTimeout(() => {
    isConnecting = false;
    connectToWhatsApp().catch(e => {
      console.error('[DLAVIE][WA] Reconnect error:', e.message);
      isConnecting = false;
    });
  }, delayMs);
}

// ─── Exponential backoff ───
function _backoffDelay(attempt) {
  const base   = Math.min(5_000 * Math.pow(1.5, attempt), 120_000);
  const jitter = Math.floor(Math.random() * 2_000);
  return base + jitter;
}

// ─── Extract message body ───
function _extractBody(msg) {
  const m = msg.message;
  return (
    m?.conversation ||
    m?.extendedTextMessage?.text ||
    m?.imageMessage?.caption ||
    m?.videoMessage?.caption ||
    m?.buttonsResponseMessage?.selectedButtonId ||
    m?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m?.templateButtonReplyMessage?.selectedId ||
    ''
  );
}

// ─── Error reason helper ───
function _errorReason(code) {
  const map = {
    401: 'Unauthorized / session invalid',
    405: 'Session conflict — clearing auth',
    408: 'Request timeout',
    410: 'Session expired',
    428: 'Precondition required — clearing auth',
    429: 'Rate limited by WhatsApp',
    440: 'Another device connected',
    500: 'Internal WA server error',
    503: 'WA service unavailable',
    515: 'Restart required',
  };
  return map[code] || 'Connection closed';
}

// ─── Notify engine ───
function _notifyEngine(event) {
  try {
    const webhook = getEngine().getSystem('webhook');
    if (webhook) webhook.send(event, { botName: config.botName, ts: Date.now() }).catch(() => {});
  } catch (_) {}
}

// ─── Exports ───
function getSock() { return sock; }
module.exports = { connectToWhatsApp, getSock, clearAuthState };
