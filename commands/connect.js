/**
 * DLavie OS — !connect command
 * Hubungkan bot user ke DLavie OS Control Panel
 * User bot harus generate Connection Token dari web DLavie OS
 */

const { getEngine }  = require('../src/core/engine');
const { getWebAuth } = require('../src/auth/webAuth');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

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
      const connections = loadConnections();
      const userConns = Object.values(connections).filter(c => c.ownerUserId === userId);
      const session   = webAuth.getSession(userId);
      const plan      = session?.plan || 'free';
      const maxBots   = { free: 1, starter: 3, pro: 10, enterprise: 999 }[plan] || 1;

      if (userConns.length >= maxBots) {
        await safeSend(jid, {
          text: `⚠️ Kamu sudah mencapai batas bot (${maxBots} bot untuk plan ${plan.toUpperCase()}).\n\nUpgrade plan untuk menambah lebih banyak bot!`
        });
        return;
      }

      const token = 'dlvc_' + crypto.randomBytes(24).toString('hex');
      const tokenEntry = {
        token,
        ownerUserId: userId,
        ownerEmail:  session?.email || userId,
        plan,
        createdAt:   Date.now(),
        expiresAt:   Date.now() + (24 * 60 * 60 * 1000), // 24 jam
        used: false,
      };

      // Simpan token pending
      if (!connections._pending) connections._pending = {};
      connections._pending[token] = tokenEntry;
      saveConnections(connections);

      await safeSend(jid, {
        text: `🔑 *Connection Token Generated*\n\n\`${token}\`\n\n*Cara pakai:*\n1. Copy token di atas\n2. Di bot user kamu, tambahkan kode:\n\`\`\`\n// Kirim ke DLavie OS bot:\n!connect verify ${token}\n\`\`\`\nAtau via API:\n\`\`\`\nPOST /api/bot/connect\n{ "token": "${token}" }\n\`\`\`\n\n⏱️ Token berlaku *24 jam*.\n📊 Bot terhubung: ${userConns.length}/${maxBots}`
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

      // Buat bot ID unik
      const botId = 'bot_' + crypto.randomBytes(8).toString('hex');
      const botEntry = {
        botId,
        botNumber: userId,
        ownerUserId: pending.ownerUserId,
        ownerEmail:  pending.ownerEmail,
        connectedAt: Date.now(),
        status: 'active',
        plan: pending.plan,
        lastPing: Date.now(),
        metadata: {},
      };

      connections[botId] = botEntry;
      delete connections._pending[token];
      saveConnections(connections);

      // Register ke MultiBot Manager
      if (multiBot) {
        try {
          await multiBot.registerBot(botId, {
            number: userId,
            owner:  pending.ownerUserId,
            plan:   pending.plan,
          });
        } catch (_) {}
      }

      // Notifikasi ke owner
      try {
        const ownerJid = `${pending.ownerUserId}@s.whatsapp.net`;
        await sock.sendMessage(ownerJid, {
          text: `🟢 *Bot Terhubung!*\n\nBot: ${userId}\nBot ID: \`${botId}\`\nWaktu: ${new Date().toLocaleString('id-ID')}\n\nGunakan \`!relay ${botId} <command>\` untuk kontrol bot ini.`
        });
      } catch (_) {}

      await safeSend(jid, {
        text: `✅ *Berhasil Terhubung ke DLavie OS!*\n\nBot ID: \`${botId}\`\nOwner: ${pending.ownerEmail}\n\nBot kamu sekarang terhubung ke DLavie OS Control Panel.\nOwner bisa mengontrol bot ini via \`!relay\` atau web dashboard.`
      });
      return;
    }

    // ─── List bot ───
    if (mode === 'list') {
      const connections = loadConnections();
      const userBots = Object.values(connections).filter(c => c.ownerUserId === userId && c.botId);

      if (!userBots.length) {
        await safeSend(jid, { text: 'Belum ada bot yang terhubung.\n\nGunakan `!connect generate` untuk membuat token koneksi.' });
        return;
      }

      const lines = userBots.map((b, i) =>
        `${i + 1}. *${b.botId}*\n   📱 ${b.botNumber} | ${b.status === 'active' ? '🟢' : '🔴'} ${b.status}\n   🕐 ${new Date(b.connectedAt).toLocaleDateString('id-ID')}`
      );

      await safeSend(jid, {
        text: `*🤖 Bot Terhubung (${userBots.length})*\n\n${lines.join('\n\n')}\n\nKontrol: \`!relay <botId> <command>\``
      });
      return;
    }

    // ─── Remove bot ───
    if (mode === 'remove') {
      const botId = args[1];
      if (!botId) {
        await safeSend(jid, { text: 'Format: `!connect remove <botId>`' });
        return;
      }

      const connections = loadConnections();
      const botEntry = connections[botId];

      if (!botEntry || botEntry.ownerUserId !== userId) {
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
      if (!botId) {
        await safeSend(jid, { text: 'Format: `!connect status <botId>`' });
        return;
      }

      const connections = loadConnections();
      const botEntry = connections[botId];

      if (!botEntry || botEntry.ownerUserId !== userId) {
        await safeSend(jid, { text: '❌ Bot tidak ditemukan atau bukan milikmu.' });
        return;
      }

      const uptime  = Date.now() - botEntry.connectedAt;
      const hours   = Math.floor(uptime / 3600000);
      const mins    = Math.floor((uptime % 3600000) / 60000);

      await safeSend(jid, {
        text: `*Status Bot*\n\nID: \`${botEntry.botId}\`\nNomor: ${botEntry.botNumber}\nStatus: ${botEntry.status === 'active' ? '🟢 Active' : '🔴 Offline'}\nTerhubung: ${new Date(botEntry.connectedAt).toLocaleString('id-ID')}\nUptime: ${hours}j ${mins}m\nPlan: ${botEntry.plan?.toUpperCase()}`
      });
      return;
    }

    await safeSend(jid, { text: 'Format tidak valid. Ketik `!connect help` untuk bantuan.' });
  }
};
