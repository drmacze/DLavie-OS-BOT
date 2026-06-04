module.exports = {
  name: 'ping',
  execute: async (sock, msg, args, config) => {
    await sock.sendMessage(msg.key.remoteJid, { text: `Pong! 🤖 ${config.botName}` });
  }
};