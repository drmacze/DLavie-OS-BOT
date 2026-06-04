module.exports = {
  name: 'info',
  description: 'Info tentang bot',
  execute: async (sock, msg, args, config, ctx) => {
    await sock.sendMessage(ctx.jid, {
      text:
        `ℹ️ *Info Bot*\n\n` +
        `🤖 Nama   : ${config.botName}\n` +
        `📌 Versi  : v2.0.0\n` +
        `🔧 Engine : Baileys (WhatsApp Multi-Device)\n` +
        `📱 Support: WhatsApp & WA Business\n` +
        `        iOS, Android, & Desktop\n\n` +
        `Ketik *${config.prefix}menu* untuk daftar perintah.`,
    });
  },
};
