/**
 * DLavie OS — !halo command (PUBLIC — tidak perlu login)
 */
const { getWebAuth } = require('../src/auth/webAuth');

module.exports = {
  name: 'halo',
  aliases: ['hello', 'hai', 'hi'],
  description: 'Sapaan dari DLavie OS (publik)',

  execute: async (sock, msg, args, config, ctx = {}) => {
    const jid      = msg.key.remoteJid;
    const userId   = (msg.key.participant || jid || '').replace(/@[a-z.]+$/, '').replace(/\D/g, '');
    const safeSend = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));
    const webAuth  = getWebAuth();
    const prefix   = config.botPrefix || config.bot?.prefix || '!';
    const dashUrl  = config.web?.dashboardUrl || config.website?.dashboardUrl || '';

    const hours    = new Date().getHours();
    const greeting = hours < 11 ? 'Selamat Pagi' : hours < 15 ? 'Selamat Siang' : hours < 18 ? 'Selamat Sore' : 'Selamat Malam';

    if (webAuth.isLoggedIn(userId)) {
      const session = webAuth.getSession(userId);
      await safeSend(jid, {
        text: `⚡ *${greeting}, ${session.email}!*\n\nSelamat datang kembali di *DLavie OS*.\n📦 Plan: *${(session.plan || 'free').toUpperCase()}*\n\nKetik \`${prefix}menu\` untuk melihat semua fitur.`
      });
    } else {
      await safeSend(jid, {
        text: `⚡ *Halo! Saya DLavie OS*\n\n${greeting}! Platform kontrol bot WhatsApp yang canggih.\n\n*Fitur Utama:*\n• 🤖 Multi-Bot Control\n• 🔧 AI Auto-Fix Error\n• 🧩 Plugin Marketplace\n• 🖥️ Shell Access\n• 📊 Real-time Monitor\n• 🛡️ Anti-Ban & Queue System\n\n*Cara memulai:*\n1️⃣ Daftar/Login di web${dashUrl ? '\n   ' + dashUrl : ''}\n2️⃣ Get Bot Code di Dashboard\n3️⃣ Kirim: \`${prefix}login KODE\`\n\n💡 Gratis selamanya dengan 5.000 token awal!`
      });
    }
  }
};