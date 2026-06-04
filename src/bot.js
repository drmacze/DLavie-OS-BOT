const { makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const config = require('./config');
const { loadCommands, handleMessage } = require('./commandLoader');

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: state,
    printQRInTerminal: false,
  });

  const commands = loadCommands();

  if (!sock.authState.creds.registered) {
    await delay(2000);
    try {
      const code = await sock.requestPairingCode(config.botNumber);
      const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
      console.log(`\n🔑 PAIRING CODE: ${formatted}\n`);
    } catch (e) {
      console.error('Gagal mendapat pairing code:', e.message);
    }
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log('Koneksi ditutup, alasan:', reason);
      const shouldReconnect = reason !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        console.log('Reconnecting dalam 3 detik...');
        setTimeout(connectToWhatsApp, 3000);
      } else {
        console.log('Logged out. Hapus folder auth_info_baileys dan restart.');
      }
    } else if (connection === 'open') {
      console.log(`✅ [${config.botName}] Bot connected!`);
    } else if (connection === 'connecting') {
      console.log('Menghubungkan ke WhatsApp...');
    }
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('messages.upsert', async (m) => handleMessage(sock, m, commands, config));

  return sock;
}

module.exports = { connectToWhatsApp };
