const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const config = require('./config');
const { loadCommands, handleMessage } = require('./commandLoader');

let pairingRequested = false;

async function connectToWhatsApp() {
  console.log('[DLAVIE][WA] Starting Dlavie OS Bot connection...');

  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: state,
    printQRInTerminal: false,
  });

  const commands = loadCommands();

  // Request pairing code ONLY ONCE per connection attempt
  if (!sock.authState.creds.registered && !pairingRequested) {
    pairingRequested = true;

    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(config.botNumber);
        const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
        console.log(`\n\ud83d\udd11 PAIRING CODE: ${formatted}\n`);
        console.log('[DLAVIE][WA] Silakan buka WhatsApp di HP \u2192 Perangkat Tertaut \u2192 Tautkan Perangkat, lalu masukkan kode di atas.');
      } catch (err) {
        console.error('[DLAVIE][ERROR] Gagal mendapat pairing code:', err.message);
        pairingRequested = false; // allow retry
      }
    }, 2500);
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`[DLAVIE][WA] Koneksi ditutup, alasan: ${statusCode || 'unknown'}`);

      if (shouldReconnect) {
        console.log('[DLAVIE][WA] Reconnecting dalam 3 detik...');
        pairingRequested = false;
        setTimeout(connectToWhatsApp, 3000);
      } else {
        console.log('[DLAVIE][WA] Logged out. Hapus folder auth_info_baileys lalu restart bot.');
      }
    } 
    else if (connection === 'open') {
      console.log(`[DLAVIE][WA] ✅ Bot connected as ${config.botName}!`);
      pairingRequested = false;
    }
    else if (connection === 'connecting') {
      console.log('[DLAVIE][WA] Connecting to WhatsApp...');
    }
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('messages.upsert', async (m) => handleMessage(sock, m, commands, config));

  return sock;
}

module.exports = { connectToWhatsApp };