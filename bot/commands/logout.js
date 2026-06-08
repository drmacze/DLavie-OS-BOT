/**
 * DLavie OS — !logout command
 */

const { getWebAuth } = require('../src/auth/webAuth');

module.exports = {
  name: 'logout',
  aliases: ['keluar', 'signout'],
  description: 'Logout dari DLavie OS',

  execute: async (sock, msg, args, config, ctx = {}) => {
    const jid    = msg.key.remoteJid;
    const userId = (msg.key.participant || jid || '').replace(/@[a-z.]+$/, '').replace(/\D/g, '');
    const safeSend = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));

    const webAuth = getWebAuth();

    if (!webAuth.isLoggedIn(userId)) {
      await safeSend(jid, { text: 'Kamu belum login. Gunakan `!login KODE` untuk masuk.' });
      return;
    }

    const session = webAuth.getSession(userId);
    webAuth.logout(userId);

    await safeSend(jid, {
      text: `👋 *Logout Berhasil*\n\nSampai jumpa, *${session.email}*!\nSesi kamu telah dihapus.\n\nLogin lagi kapan saja dengan \`!login KODE\` (dapat kode baru dari web DLavie OS).`
    });
  }
};
