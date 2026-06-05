/**
 * DLavie OS — !connect command v2.1
 * FIX: simpan ownerWebUserId agar bot muncul di web dashboard
 * FIX: instruksi step 2 lebih jelas
 */

const { getEngine }  = require('../src/core/engine');
const { getWebAuth } = require('../src/auth/webAuth');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

function getDashUrl() {
  if (process.env.DASHBOARD_URL) return process.env.DASHBOARD_URL;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  let cfg = {};
  try { cfg = require('../DLavieConfig'); } catch(_){}
  return cfg.web?.dashboardUrl || cfg.website?.dashboardUrl || 'https://dlavie-os.replit.app';
}

const CONNECTIONS_FILE = path.join(__dirname, '../tmp/bot_connections.json');

function loadConnections() {
  try {
    if (fs.existsSync(CONNECTIONS_FILE)) return JSON.parse(fs.readFileSync(CONNECTIONS_FILE, 'utf8'));
  } catch (_) {}
  return {};
}

function saveConnections(data) {
  try {
    fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(data, null, 2));
  } catch (_) {}
}

function digitsOnly(v) { return String(v || '').replace(/\D/g, ''); }
function senderId(msg) {
  return digitsOnly(msg.key.participant || msg.key.remoteJid || '');
}

module.exports = {
  name: 'connect',
  aliases: ['hubungkan', 'addbot', 'link'],
  description: 'Hubungkan bot user ke DLavie OS',

  execute: async (sock, msg, args, config, ctx = {}) => {
    const jid      = msg.key.remoteJid;
    const userId   = senderId(msg);
    const safeSend = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));
    const webAuth  = getWebAuth();
    const engine   = getEngine();
    const multiBot = engine.getSystem('multiBot');
    const tokenEng = engine.getSystem('token');

    const mode = (args[0] || 'help').toLowerCase();

    if (mode === 'help' || !args.length) {
      await safeSend(jid, {
        text: `*🔌 Connect Bot ke DLavie OS*\n\n\`!connect generate\` — Generate Connection Token\n\`!connect verify <token>\` — Verifikasi & hubungkan bot\n\`!connect list\` — Lihat bot yang terhubung\n\`!connect remove <botId>\` — Lepas koneksi bot\n\`!connect status <botId>\` — Status bot\n\nBot yang terhubung bisa dikontrol via \`!relay\` dan dashboard web.`
      });
      return;
    }

    // ─── Generate token koneksi ───
    if (mode === 'generate') {
      const session   = webAuth.getSession(userId);
      if (!session) {
        const dashUrl = getDashUrl();
        await safeSend(jid, {
          text: `⚠️ *Kamu belum login ke DLavie OS.*\n\n*Cara Login:*\n1️⃣ Buka: ${dashUrl}/register\n2️⃣ Daftar atau Login\n3️⃣ Di Dashboard, klik "Get Bot Code"\n4️⃣ Kirim: \`!login KODE\`\n\nSetelah itu jalankan \`!connect generate\` lagi.`
        });
        return;
      }

      const connections = loadConnections();
      const userConns   = Object.values(connections).filter(c =>
        (c.ownerUserId === userId || c.ownerWebUserId === session.webUserId) && c.botId
      );
      const plan    = session?.plan || 'free';
      const maxBots = { free: 1, starter: 3, pro: 10, enterprise: 999 }[plan] || 1;

      if (userConns.length >= maxBots) {
        const dashUrl = getDashUrl();
        await safeSend(jid, {
          text: `⚠️ Batas bot tercapai (${userConns.length}/${maxBots} untuk plan *${plan.toUpperCase()}*).\n\nUpgrade plan di ${dashUrl}/pricing untuk menambah lebih banyak bot!`
        });
        return;
      }

      const token = 'dlvc_' + crypto.randomBytes(24).toString('hex');
      if (!connections._pending) connections._pending = {};
      connections._pending[token] = {
        token,
        ownerUserId:    userId,            // WA phone digits
        ownerWebUserId: session.webUserId, // usr_xxx — INI KUNCI FIX DASHBOARD
        ownerEmail:     session.email || userId,
        plan,
        createdAt:  Date.now(),
        expiresAt:  Date.now() + (24 * 60 * 60 * 1000),
        used: false,
      };
      saveConnections(connections);

      const dashUrl = getDashUrl();
      await safeSend(jid, {
        text: `🔑 *Connection Token Generated*\n\n\`${token}\`\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `*Cara Menghubungkan Bot User:*\n\n` +
          `1️⃣ *Copy* token di atas\n\n` +
          `2️⃣ Buka WhatsApp bot *KAMU* (bot yang ingin dikontrol),\n` +
          `   lalu kirim pesan ini ke bot tersebut:\n` +
          `   \`!connect verify ${token}\`\n\n` +
          `   ⚠️ *PENTING:* Kirim command itu dari *bot kamu*, bukan dari sini!\n\n` +
          `3️⃣ Bot akan muncul otomatis di web panel:\n` +
          `   ${dashUrl}/bots\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `⏱️ Token berlaku *24 jam* • Bot: ${userConns.length}/${maxBots}`
      });
      return;
    }

    // ─── Verifikasi token (dari bot user) ───
    if (mode === 'verify') {
      const token = args[1];
      if (!token) {
        await safeSend(jid, { text: 'Format: `!connect verify <token>`' });
        return;
      }

      const connections = loadConnections();
      const pending = connections._pending?.[token];

      if (!pending) {
        await safeSend(jid, { text: '❌ Token tidak valid atau sudah digunakan.' });
        return;
      }

      if (Date.now() > pending.expiresAt) {
        delete connections._pending[token];
        saveConnections(connections);
        await safeSend(jid, { text: '❌ Token sudah kadaluarsa. Generate token baru.' });
        return;
      }

      // Cek apakah nomor ini sudah terhubung sebagai bot lain
      const existBot = Object.values(connections).find(c => c.botNumber === userId && c.botId);
      if (existBot) {
        await safeSend(jid, {
          text: `⚠️ Nomor ini sudah terhubung sebagai bot *${existBot.botId}*.\nGunakan \`!connect remove ${existBot.botId}\` dulu.`
        });
        return;
      }

      // Buat bot ID unik
      const botId = 'bot_' + crypto.randomBytes(8).toString('hex');
      const now   = Date.now();
      const botEntry = {
        botId,
        botNumber:      userId,
        ownerUserId:    pending.ownerUserId,    // WA phone (backward compat)
        ownerWebUserId: pending.ownerWebUserId, // usr_xxx — FIX WEB DASHBOARD
        ownerEmail:     pending.ownerEmail,
        connectedAt:    now,
        status:         'active',
        plan:           pending.plan,
        lastPing:       now,
        settings: { name: '', prefix: '!', bio: '', language: 'id', timezone: 'Asia/Jakarta' },
        stats:    { commandsTotal: 0, commandsToday: 0, lastCommand: null },
        metadata: {},
      };

      connections[botId] = botEntry;
      delete connections._pending[token];
      saveConnections(connections);

      // Register ke MultiBot Manager
      if (multiBot) {
        try {
          await multiBot.registerBot(botId, { number: userId, owner: pending.ownerUserId, plan: pending.plan });
        } catch (_) {}
      }

      // Notifikasi ke owner WA
      const dashUrl = getDashUrl();
      try {
        const ownerJid = `${pending.ownerUserId}@s.whatsapp.net`;
        await sock.sendMessage(ownerJid, {
          text: `🟢 *Bot Berhasil Terhubung!*\n\n` +
            `Bot ID: \`${botId}\`\nNomor Bot: +${userId}\n` +
            `Owner: ${pending.ownerEmail}\nPlan: ${pending.plan?.toUpperCase()}\n` +
            `Waktu: ${new Date(now).toLocaleString('id-ID')}\n\n` +
            `*Control Commands:*\n\`!relay ${botId} status\`\n\`!relay ${botId} restart\`\n\`!relay ${botId} plugin list\`\n\n` +
            `🌐 Dashboard: ${dashUrl}/bots`
        });
      } catch (_) {}

      await safeSend(jid, {
        text: `✅ *Berhasil Terhubung ke DLavie OS!*\n\n` +
          `Bot ID: \`${botId}\`\nOwner: ${pending.ownerEmail}\nPlan: ${pending.plan?.toUpperCase()}\n\n` +
          `Bot kamu sekarang bisa dikontrol via:\n` +
          `• WA: \`!relay ${botId} <command>\`\n` +
          `• Web: ${dashUrl}/bots\n\n` +
          `Bot muncul di panel owner dalam beberapa detik.`
      });
      return;
    }

    // ─── List bot ───
    if (mode === 'list') {
      const connections = loadConnections();
      const session     = webAuth.getSession(userId);
      const userBots    = Object.values(connections).filter(c =>
        (c.ownerUserId === userId || (session?.webUserId && c.ownerWebUserId === session.webUserId)) && c.botId
      );

      if (!userBots.length) {
        const dashUrl = getDashUrl();
        await safeSend(jid, {
          text: `Belum ada bot yang terhubung.\n\nGunakan \`!connect generate\` untuk membuat token.\nLihat panduan di: ${dashUrl}/bots`
        });
        return;
      }

      const plan    = session?.plan || 'free';
      const maxBots = { free: 1, starter: 3, pro: 10, enterprise: 999 }[plan] || 1;
      const lines   = userBots.map((b, i) =>
        `${i + 1}. *${b.botId}*\n   📱 +${b.botNumber} | ${b.status === 'active' ? '🟢' : '🔴'} ${b.status}\n   🕐 ${new Date(b.connectedAt).toLocaleDateString('id-ID')}`
      );

      const dashUrl = getDashUrl();
      await safeSend(jid, {
        text: `*🤖 Bot Terhubung (${userBots.length}/${maxBots})*\n\n${lines.join('\n\n')}\n\n🌐 Kelola di: ${dashUrl}/bots\nKontrol: \`!relay <botId> <command>\``
      });
      return;
    }

    // ─── Remove bot ───
    if (mode === 'remove') {
      const botId = args[1];
      if (!botId) { await safeSend(jid, { text: 'Format: `!connect remove <botId>`' }); return; }

      const connections = loadConnections();
      const botEntry    = connections[botId];
      const session     = webAuth.getSession(userId);

      if (!botEntry || (botEntry.ownerUserId !== userId && botEntry.ownerWebUserId !== session?.webUserId)) {
        await safeSend(jid, { text: '❌ Bot tidak ditemukan atau bukan milikmu.' });
        return;
      }

      delete connections[botId];
      saveConnections(connections);
      await safeSend(jid, { text: `✅ Bot \`${botId}\` berhasil dilepas dari DLavie OS.` });
      return;
    }

    // ─── Status bot ───
    if (mode === 'status') {
      const botId = args[1];
      if (!botId) { await safeSend(jid, { text: 'Format: `!connect status <botId>`' }); return; }

      const connections = loadConnections();
      const botEntry    = connections[botId];
      const session     = webAuth.getSession(userId);

      if (!botEntry || (botEntry.ownerUserId !== userId && botEntry.ownerWebUserId !== session?.webUserId)) {
        await safeSend(jid, { text: '❌ Bot tidak ditemukan atau bukan milikmu.' });
        return;
      }

      const uptime = Date.now() - botEntry.connectedAt;
      const h = Math.floor(uptime / 3600000), m = Math.floor((uptime % 3600000) / 60000);

      await safeSend(jid, {
        text: `*📊 Status Bot*\n\n` +
          `ID: \`${botEntry.botId}\`\nNomor: +${botEntry.botNumber}\n` +
          `Status: ${botEntry.status === 'active' ? '🟢 Active' : '🔴 Offline'}\n` +
          `Plan: ${(botEntry.plan || 'free').toUpperCase()}\n` +
          `Terhubung: ${new Date(botEntry.connectedAt).toLocaleString('id-ID')}\n` +
          `Uptime: ${h}j ${m}m\n` +
          `Total CMD: ${botEntry.stats?.commandsTotal || 0}\nHari Ini: ${botEntry.stats?.commandsToday || 0}`
      });
      return;
    }

    await safeSend(jid, { text: 'Format tidak valid. Ketik `!connect help` untuk bantuan.' });
  }
};
