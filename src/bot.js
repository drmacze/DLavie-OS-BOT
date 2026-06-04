const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const config = require('./config');
const { loadCommands, handleMessage } = require('./commandLoader');
const { getEngine } = require('./core/engine');

let isReconnecting = false;

async function connectToWhatsApp() {
  if (isReconnecting) return;
  console.log('[DLAVIE][WA] Starting Dlavie OS Bot v2.0 connection...');

  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: state,
    printQRInTerminal: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 15000,
    emitOwnEvents: true,
    fireInitQueries: true,
    shouldSyncHistoryMessage: () => false,
    shouldIgnoreJid: (jid) => false,
    getMessage: async () => undefined
  });

  const commands = loadCommands();

  // === Request Pairing Code if not registered ===
  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(config.botNumber);
        const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
        console.log(`\n🔑 PAIRING CODE: ${formatted}\n`);
        console.log('[DLAVIE][WA] Silakan buka WhatsApp di HP → Perangkat Tertaut → Tautkan Perangkat, lalu masukkan kode di atas.');
      } catch (err) {
        console.error('[DLAVIE][ERROR] Gagal mendapat pairing code:', err.message);
      }
    }, 3000);
  }

  // === Connection Update Handler ===
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`[DLAVIE][WA] Koneksi ditutup, alasan: ${statusCode || 'unknown'}`);

      if (shouldReconnect) {
        console.log('[DLAVIE][WA] Reconnecting dalam 5 detik...');
        isReconnecting = true;
        setTimeout(() => {
          isReconnecting = false;
          connectToWhatsApp().catch(err => {
            console.error('[DLAVIE][WA] Reconnect failed:', err.message);
            isReconnecting = false;
          });
        }, 5000);
      } else {
        console.log('[DLAVIE][WA] Logged out. Hapus folder auth_info_baileys lalu restart bot.');
      }
    }
    else if (connection === 'open') {
      console.log(`[DLAVIE][WA] ✅ Bot connected as ${config.botName}!`);
      isReconnecting = false;

      // Notify engine
      try {
        const engine = getEngine();
        const webhook = engine.getSystem('webhook');
        if (webhook) {
          await webhook.send('bot.connected', {
            botName: config.botName,
            timestamp: Date.now()
          });
        }
      } catch (err) {
        // Silent fail for webhook
      }
    }
    else if (connection === 'connecting') {
      console.log('[DLAVIE][WA] Connecting to WhatsApp...');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // === Message Handler with Error Recovery ===
  sock.ev.on('messages.upsert', async (m) => {
    try {
      await handleMessage(sock, m, commands, config);
    } catch (err) {
      console.error('[DLAVIE][WA] Message handler error:', err.message);
      // NEVER crash - just log and continue
    }
  });

  // === Graceful Error Handler for Socket ===
  sock.ev.on('error', (err) => {
    console.error('[DLAVIE][WA] Socket error:', err.message);
    // Log to error aggregator
    try {
      const engine = getEngine();
      const errors = engine.getSystem('errors');
      if (errors) errors.report(err, { source: 'whatsapp_socket' });
    } catch (e) {
      // Silent
    }
  });

  return sock;
}

module.exports = { connectToWhatsApp };
