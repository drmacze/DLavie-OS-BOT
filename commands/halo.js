module.exports = {
  name: 'halo',
  execute: async (sock, msg, args, config) => {
    await sock.sendMessage(msg.key.remoteJid, { text: `Halo! 👋 Saya ${config.botName}.` });
  }
};