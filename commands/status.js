module.exports = {
  name: 'status',
  execute: async (sock, msg, args, config) => {
    const from = msg.key.remoteJid;
    if (!from.includes(config.ownerNumber)) return;
    await sock.sendMessage(from, { text: `✅ ${config.botName} is running (Pairing Code)` });
  }
};