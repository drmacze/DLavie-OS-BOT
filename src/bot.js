const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
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

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) setTimeout(connectToWhatsApp, 3000);
    } else if (connection === 'open') {
      console.log(`✅ [${config.botName}] Bot connected!`);
    }

    if (!sock.authState.creds.registered && connection === 'connecting') {
      try {
        const code = await sock.requestPairingCode(config.botNumber);
        const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
        console.log(`\n\uD83D\uDD11 PAIRING CODE: ${formatted}\n`);
      } catch (e) {
        console.error(e.message);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('messages.upsert', async (m) => handleMessage(sock, m, commands, config));

  return sock;
}

module.exports = { connectToWhatsApp };