module.exports = {
  name: 'owner',
  description: 'Info kontak owner (owner only)',
  execute: async (sock, msg, args, config, ctx) => {
    if (ctx.sender !== config.ownerNumber) {
      return sock.sendMessage(ctx.jid, { text: '⛔ Perintah ini hanya untuk owner.' });
    }
    await sock.sendMessage(ctx.jid, {
      text: `👑 *Owner Info*\nNomor: +${config.ownerNumber}`,
    });
  },
};
