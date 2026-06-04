module.exports = {
  name: 'owner',
  execute: async (sock, msg, args, config) => {
    const from = msg.key.remoteJid;
    if (!from.includes(config.ownerNumber)) return;
    await sock.sendMessage(from, { text: `Owner: ${config.ownerNumber}` });
  }
};