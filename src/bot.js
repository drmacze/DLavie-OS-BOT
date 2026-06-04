/**
 * DLavie OS — WhatsApp Connection Manager v2.1
 * Fixed: pairing code 405/428, queue integration, anti-ban, login gate
 */

const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  PHONENUMBER_MCC,
} = require('@whiskeysockets/baileys');
const pino       = require('pino');
const fs         = require('fs');
const path       = require('path');
const config     = require('./config');
const { loadCommands, handleMessage } = require('./commandLoader');
const { getEngine }      = require('./core/engine');
const { getMessageQueue } = require('./queue/messageQueue');
const { getAntiBan }     = require('./antiban/antiBan');

const AUTH_DIR    = 'auth_info_baileys';
const MAX_RETRIES = 10;

let sock           = null;
let retryCount     = 0;
let reconnectTimer = null;
let isConnecting   = false;

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

// ─── Koneksi utama ───
async function connectToWhatsApp(retryAfterClear = false) {
  if (isConnecting) return;
  isConnecting = true;

  console.log(`[DLAVIE][WA] Starting DLavie OS Bot v2.0 (attempt ${retryCount + 1}/${MAX_RETRIES})...`);

  try {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const commands   = loadCommands();
    const antiBan    = getAntiBan(config.antiBan || {});
    const msgQueue   = getMessageQueue(config.queue || {});

    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
      },
      printQRInTerminal:      false,
      mobile:                 false,
      connectTimeoutMs:       60_000,
      defaultQueryTimeoutMs:  30_000,
      keepAliveIntervalMs:    25_000,
      retryRequestDelayMs:    500,
      emitOwnEvents:          false,
      fireInitQueries:        true,
      shouldSyncHistoryMessage: () => false,
      getMessage: async () => ({ conversation: '' }),
      generateHighQualityLinkPreview: false,
    });

    // ─── Request pairing code (jika belum registered) ───
    if (!state.creds.registered) {
      const botNum = String(config.botNumber || '').replace(/\D/g, '');
      if (!botNum) {
        console.error('[DLAVIE][WA] ❌ BOT_NUMBER belum diset di .env atau config!');
        isConnecting = false;
        return;
      }

      // Tunggu socket stabil, lalu minta pairing code
      setTimeout(async () => {
        try {
          // Validasi nomor ada di MCC database
          const countryCode = botNum.slice(0, 2);
          const isValidNum  = botNum.length >= 10 && botNum.length <= 15;
          if (!isValidNum) {
            console.error('[DLAVIE][WA] ❌ Format nomor tidak valid:', botNum);
            return;
          }

          const code = await sock.requestPairingCode(botNum);
          if (code) {
            const formatted = code.match(/.{1,4}/g)?.join('-') || code;
            console.log('\n' + '═'.repeat(50));
            console.log('🔑  PAIRING CODE: ' + formatted);
            console.log('═'.repeat(50));
            console.log('📱 WhatsApp → Perangkat Tertaut → Tautkan Perangkat');
            console.log('   Masukkan kode di atas\n');
          }
        } catch (err) {
          // Tangani error spesifik
          const msg = err.message || '';
          if (msg.includes('405') || err?.output?.statusCode === 405) {
            console.warn('[DLAVIE][WA] ⚠️  Sesi lama terdeteksi (405). Menghapus session...');
            clearAuthState();
            scheduleReconnect(15_000, true);
          } else if (msg.includes('428') || err?.output?.statusCode === 428) {
            console.warn('[DLAVIE][WA] ⚠️  Session conflict (428). Menghapus session...');
            clearAuthState();
            scheduleReconnect(20_000, true);
          } else if (msg.includes('rate-overlimit') || msg.includes('429')) {
            console.warn('[DLAVIE][WA] ⚠️  Rate limit dari WhatsApp. Menunggu 60 detik...');
            scheduleReconnect(60_000);
          } else {
            console.error('[DLAVIE][WA] Pairing code error:', msg);
            scheduleReconnect(10_000);
          }
        }
      }, 5_000);
    }

    // ─── Connection Update ───
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (connection === 'open') {
        retryCount = 0;
        isConnecting = false;
        console.log(`[DLAVIE][WA] ✅ Connected as ${config.botName}!`);
        _notifyEngine('bot.connected');
      }

      if (connection === 'close') {
        isConnecting = false;
        const code = lastDisconnect?.error?.output?.statusCode;
        const reason = _errorReason(code);
        console.log(`[DLAVIE][WA] Connection closed: ${code || 'unknown'} — ${reason}`);

        // Jangan reconnect jika sengaja logout
        if (code === DisconnectReason.loggedOut) {
          console.log('[DLAVIE][WA] Logged out. Delete auth_info_baileys and restart.');
          clearAuthState();
          return;
        }

        // 405 / 428 = session conflict → clear dan reconnect
        if (code === 405 || code === 428) {
          clearAuthState();
          scheduleReconnect(_backoffDelay(retryCount++), true);
          return;
        }

        // Rate limit
        if (code === 429 || code === 503) {
          scheduleReconnect(60_000);
          return;
        }

        // Normal disconnect → reconnect
        scheduleReconnect(_backoffDelay(retryCount++));
      }

      if (connection === 'connecting') {
        console.log('[DLAVIE][WA] Connecting to WhatsApp...');
      }
    });

    // ─── Creds update ───
    sock.ev.on('creds.update', saveCreds);

    // ─── Message Handler — dengan queue & anti-ban ───
    sock.ev.on('messages.upsert', async (m) => {
      if (!m.messages?.length) return;
      const msg = m.messages[0];
      if (!msg.message) return;
      if (msg.key.fromMe) return;       // skip pesan dari bot sendiri

      const jid  = msg.key.remoteJid;
      const body = _extractBody(msg) || '';
      const prefix = config.botPrefix || '!';

      // Hanya proses pesan yang dimulai dengan prefix
      if (!body.startsWith(prefix)) return;

      // Ambil userId
      const userId = (msg.key.participant || jid || '').replace('@s.whatsapp.net', '').replace('@g.us', '').replace(/\D/g, '');
      const { getWebAuth } = require('./auth/webAuth');
      const webAuth = getWebAuth();
      const userPlan = webAuth.getUserPlan(userId) || 'free';

      // ─── Queue / Direct berdasarkan plan ───
      const isPriority = ['pro', 'enterprise'].includes(userPlan);

      const processTask = async () => {
        return await handleMessage(sock, m, commands, config, antiBan);
      };

      if (isPriority) {
        // Pro/Enterprise → langsung proses tanpa queue
        try {
          await processTask();
        } catch (err) {
          console.error('[DLAVIE][WA] Message handler error:', err.message);
        }
      } else {
        // Free/Starter → masuk queue
        try {
          const queuePos = msgQueue.getQueuePosition(userId);

          if (queuePos && queuePos.position > 1) {
            // Sudah di queue, berikan info posisi
            const estWait = Math.ceil(queuePos.estimatedWaitMs / 1000);
            try {
              await antiBan.safeSend(sock, jid, {
                text: `⏳ *Antrian DLavie OS*\n\nKamu sedang menunggu di antrian.\n\n📍 Posisi: *#${queuePos.position}* dari ${queuePos.total}\n⏱️ Estimasi tunggu: *~${estWait} detik*\n\n💡 Upgrade ke *Pro* untuk bypass antrian instant!`
              });
            } catch (_) {}
            return;
          }

          await msgQueue.enqueue(processTask, userId, userPlan);
        } catch (err) {
          if (err.code === 'QUEUE_FULL') {
            try {
              await antiBan.safeSend(sock, jid, {
                text: `⚠️ *Antrian Penuh*\n\nBot sedang sangat sibuk. Antrian sudah penuh (${err.queueSize} orang).\n\nCoba lagi dalam beberapa menit, atau upgrade ke *Pro* untuk bypass antrian!\n\n📊 Cek status: !status`
              });
            } catch (_) {}
          } else if (err.code !== 'ALREADY_QUEUED') {
            console.error('[DLAVIE][WA] Queue error:', err.message || err);
          }
        }
      }
    });

    // ─── Error handler ───
    sock.ev.on('error', (err) => {
      console.error('[DLAVIE][WA] Socket error:', err.message);
      try {
        const engine = getEngine();
        const errors = engine.getSystem('errors');
        if (errors) errors.report(err, { source: 'wa_socket' });
      } catch (_) {}
    });

    return sock;
  } catch (err) {
    isConnecting = false;
    console.error('[DLAVIE][WA] Connection setup error:', err.message);
    scheduleReconnect(_backoffDelay(retryCount++));
  }
}

// ─── Schedule reconnect ───
function scheduleReconnect(delayMs, afterClear = false) {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (retryCount >= MAX_RETRIES) {
    console.error(`[DLAVIE][WA] Max retries (${MAX_RETRIES}) reached. Manual restart required.`);
    return;
  }
  console.log(`[DLAVIE][WA] Reconnecting in ${delayMs / 1000}s...`);
  reconnectTimer = setTimeout(() => {
    isConnecting = false;
    connectToWhatsApp(afterClear).catch(e => {
      console.error('[DLAVIE][WA] Reconnect failed:', e.message);
      isConnecting = false;
    });
  }, delayMs);
}

// ─── Exponential backoff ───
function _backoffDelay(attempt) {
  const base = Math.min(5_000 * Math.pow(1.5, attempt), 120_000);
  const jitter = Math.floor(Math.random() * 2000);
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
  const reasons = {
    405: 'Session conflict — clearing auth',
    428: 'Precondition required — clearing auth',
    408: 'Request timeout',
    429: 'Rate limited by WhatsApp',
    440: 'Another device connected',
    500: 'Internal WhatsApp server error',
    503: 'WhatsApp service unavailable',
    515: 'Restart required',
  };
  return reasons[code] || 'Connection closed';
}

// ─── Notify engine on events ───
function _notifyEngine(event) {
  try {
    const engine = getEngine();
    const webhook = engine.getSystem('webhook');
    if (webhook) webhook.send(event, { botName: config.botName, timestamp: Date.now() }).catch(() => {});
  } catch (_) {}
}

// ─── Get current socket ───
function getSock() { return sock; }

module.exports = { connectToWhatsApp, getSock, clearAuthState };
