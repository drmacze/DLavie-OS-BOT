/**
 * DLavie OS — !menu command
 * Hanya bisa dilihat setelah login (!login KODE)
 */

const { getWebAuth } = require('../src/auth/webAuth');
const { getEngine }  = require('../src/core/engine');

module.exports = {
  name: 'menu',
  aliases: ['help', 'm'],
  description: 'Tampilkan menu DLavie OS',

  execute: async (sock, msg, args, config, ctx = {}) => {
    const jid      = msg.key.remoteJid;
    const userId   = (msg.key.participant || jid || '').replace(/@[a-z.]+$/, '').replace(/\D/g, '');
    const safeSend = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));
    const webAuth  = getWebAuth();
    const prefix   = config.botPrefix || config.bot?.prefix || '!';
    const session  = webAuth.getSession(userId);
    const plan     = (session?.plan || 'free').toUpperCase();
    const isOwner  = webAuth.isOwner(userId, config.ownerNumber || config.bot?.ownerNumber);
    const isAdmin  = ['admin'].includes(session?.role);

    const isQueue  = ['FREE', 'STARTER'].includes(plan);

    const tokenEng = getEngine().getSystem('token');
    let balance = '—';
    try {
      if (tokenEng) balance = (tokenEng.getBalance?.(userId) || 0).toLocaleString('id-ID');
    } catch (_) {}

    // ─── Banner ───
    let text = `╔══════════════════════════════╗
║   ⚡  *DLavie OS*  ⚡        ║
║  WhatsApp Multi-Bot Control  ║
╚══════════════════════════════╝

👤 *${session?.email || userId}*
📦 Plan: *${plan}*  🪙 Token: *${balance}*
${isQueue ? '⏳ Kamu menggunakan *antrian* (queue)\n💡 Upgrade ke Pro → bypass antrian!' : '⚡ Priority Access — NO queue!'}

━━━━━━━━━━━━━━━━━━━━━━━━
📋 *COMMAND UTAMA*
━━━━━━━━━━━━━━━━━━━━━━━━

🔑 *Autentikasi*
\`${prefix}login KODE\`  — Login dengan kode dari web
\`${prefix}logout\`      — Logout dari DLavie OS

🤖 *Bot Management*
\`${prefix}connect\`     — Hubungkan bot user kamu
\`${prefix}relay\`       — Kirim command ke bot user
\`${prefix}monitor\`     — Monitor semua bot & sistem

⚙️ *Fitur Utama*
\`${prefix}shell\`       — Eksekusi shell command *
\`${prefix}plugin\`      — Plugin marketplace & install
\`${prefix}fix\`         — Auto-fix error (AI-powered)
\`${prefix}schedule\`    — Kelola scheduled tasks
\`${prefix}token\`       — Cek & kelola token

📊 *Info & Status*
\`${prefix}status\`      — Status sistem DLavie OS
\`${prefix}info\`        — Info bot & server
\`${prefix}ping\`        — Cek koneksi bot`;

    // Owner/Admin commands
    if (isOwner || isAdmin) {
      text += `\n\n👑 *OWNER / ADMIN*
\`${prefix}user\`        — Kelola user & RBAC
\`${prefix}audit\`       — Audit log aktivitas
\`${prefix}broadcast\`   — Broadcast ke semua user
\`${prefix}lockdown\`    — Emergency lockdown
\`${prefix}stealth\`     — Stealth mode
\`${prefix}config\`      — Lihat konfigurasi`;
    }

    text += `

━━━━━━━━━━━━━━━━━━━━━━━━
💡 *TIPS*
• \`${prefix}command help\` untuk detail tiap command
• *) Fitur Pro/Enterprise only
• Token refill otomatis 100/10 menit

🌐 Dashboard: ${config.web?.dashboardUrl || config.website?.dashboardUrl || 'Lihat di web DLavie OS'}

DLavie OS v${config.bot?.version || '2.0.0'} • Anti-Ban Active`;

    await safeSend(jid, { text });
  }
};
