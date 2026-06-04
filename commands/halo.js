module.exports = {
  name: 'halo',
  aliases: ['hello', 'hi'],
  description: 'Sapa bot',
  execute: async (sock, msg, args, config, ctx) => {
    const nama = ctx.sender;
    await sock.sendMessage(ctx.jid, {
      text: `Halo! 👋 Saya *${config.botName}*.\nKetik *${config.prefix}menu* untuk melihat daftar perintah.`,
    });
  },
};
