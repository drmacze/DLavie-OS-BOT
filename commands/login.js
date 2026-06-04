/**
 * DLavie OS — !login command
 * Login bot menggunakan kode dari web dashboard
 */

const { getWebAuth } = require('../src/auth/webAuth');

module.exports = {
  name: 'login',
  aliases: ['masuk', 'signin'],
  description: 'Login ke DLavie OS menggunakan kode dari web',

  execute: async (sock, msg, args, config, ctx = {}) => {
    const jid    = msg.key.remoteJid;
    const userId = (msg.key.participant || jid || '').replace(/@[a-z.]+$/, '').replace(/\D/g, '');
    const safeSend = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));

    const webAuth  = getWebAuth();
    const dashUrl  = config.web?.dashboardUrl || config.website?.dashboardUrl || '';

    // Sudah login?
    if (webAuth.isLoggedIn(userId)) {
      const session = webAuth.getSession(userId);
      await safeSend(jid, {
        text: `✅ *Kamu sudah login!*\n\n📧 Akun: ${session.email}\n📦 Plan: ${(session.plan || 'free').toUpperCase()}\n🔑 Access Key: \`${session.accessKey?.slice(0, 20)}...\`\n\nGunakan \`!menu\` untuk melihat semua fitur.\nGunakan \`!logout\` untuk keluar.`
      });
      return;
    }

    // Cek ada kode?
    const code = args[0];
    if (!code) {
      await safeSend(jid, {
        text: `🔑 *DLavie OS — Login Bot*\n\nFormat: \`!login KODEMU\`\n\n*Cara mendapatkan kode:*\n1️⃣ Buka web DLavie OS${dashUrl ? '\n   ' + dashUrl : ''}\n2️⃣ Login / Register akun kamu\n3️⃣ Di Dashboard → klik *"Get Bot Code"*\n4️⃣ Salin kode 8 karakter\n5️⃣ Kirim: \`!login KODE\`\n\n⏱️ Kode berlaku *10 menit* saja.`
      });
      return;
    }

    // Verifikasi kode
    const result = webAuth.verifyBotCode(userId, code);

    if (!result.success) {
      await safeSend(jid, {
        text: `❌ *Login Gagal*\n\n${result.error}\n\n💡 Cara mendapatkan kode baru:\n→ Buka web DLavie OS → Dashboard → Get Bot Code`
      });
      return;
    }

    const { session } = result;
    const plan = (session.plan || 'free').toUpperCase();

    // Kirim notifikasi ke owner
    try {
      const ownerNum = config.ownerNumber || config.bot?.ownerNumber;
      if (ownerNum && config.notifications?.notifyNewUser) {
        const ownerJid = `${ownerNum}@s.whatsapp.net`;
        await sock.sendMessage(ownerJid, {
          text: `📢 *New Bot Login*\n\nUser: ${session.email}\nWA: ${userId}\nPlan: ${plan}\nWaktu: ${new Date().toLocaleString('id-ID')}`
        });
      }
    } catch (_) {}

    await safeSend(jid, {
      text: `✅ *Login Berhasil!*\n\n📧 Akun: *${session.email}*\n📦 Plan: *${plan}*\n🔑 Access Key: \`${session.accessKey?.slice(0, 20)}...\`\n\n${plan === 'FREE' || plan === 'STARTER' ? '⏳ Plan kamu menggunakan *sistem antrian*.\n💡 Upgrade ke Pro untuk bypass antrian!\n\n' : '⚡ Kamu punya akses *priority* (no queue)!\n\n'}Ketik \`!menu\` untuk melihat semua fitur DLavie OS.`
    });
  }
};
