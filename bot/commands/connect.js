/**
 * DLavie OS — !connect command v2.1
 * Fixed: ownerWebUserId uses webUserId (usr_xxx) from session, not WA phone
 * This means web panel can now correctly show connected bots.
 */

const { getEngine }  = require('../src/core/engine');
const { getWebAuth } = require('../src/auth/webAuth');
const { isOwnerMsg, extractSenderNumber } = require('../src/utils/ownerUtils');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const { query, isConnected: isPgConnected } = require('../src/database/replitPg');

const CONNECTIONS_FILE = path.join(__dirname, '../tmp/bot_connections.json');
const PENDING_FILE     = path.join(__dirname, '../tmp/connect_pending.json');

function loadConnections() {
  try { if (fs.existsSync(CONNECTIONS_FILE)) return JSON.parse(fs.readFileSync(CONNECTIONS_FILE, 'utf8')); } catch (_) {}
  return {};
}
function saveConnections(data) {
  try {
    const dir = path.dirname(CONNECTIONS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(data, null, 2));
  } catch (_) {}
}
function loadPending() {
  try { if (fs.existsSync(PENDING_FILE)) return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8')); } catch (_) {}
  return {};
}
function savePending(data) {
  try {
    fs.writeFileSync(PENDING_FILE, JSON.stringify(data, null, 2));
  } catch (_) {}
}

// Save bot connection to DB
async function saveConnectionToDB(botEntry) {
  if (!isPgConnected()) return;
  try {
    await query(
      `INSERT INTO dlavie_bot_connections (bot_id, bot_number, owner_web_user_id, owner_email, owner_phone, plan, status, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (bot_id) DO UPDATE SET status=$6, last_ping=NOW(), metadata=$8`,
      [botEntry.botId, botEntry.botNumber, botEntry.ownerWebUserId, botEntry.ownerEmail,
       botEntry.ownerPhone, botEntry.plan, botEntry.status, JSON.stringify(botEntry.metadata || {})]
    );
  } catch (err) {
    console.warn('[CONNECT] DB save error:', err.message);
  }
}

async function removeConnectionFromDB(botId) {
  if (!isPgConnected()) return;
  try {
    await query('UPDATE dlavie_bot_connections SET status=$1 WHERE bot_id=$2', ['removed', botId]);
  } catch (_) {}
}

module.exports = {
  name: 'connect',
  aliases: ['hubungkan', 'addbot', 'link'],
  description: 'Hubungkan bot user ke DLavie OS Control Panel',

  execute: async (sock, msg, args, config, ctx = {}) => {
    const jid      = msg.key.remoteJid;
    const userId   = extractSenderNumber(msg);
    const safeSend = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));
    const webAuth  = getWebAuth();
    const engine   = getEngine();
    const multiBot = engine.getSystem('multiBot');

    const mode = (args[0] || 'help').toLowerCase();

    if (mode === 'help' || !args.length) {
      await safeSend(jid, {
        text: `*🔌 Connect Bot ke DLavie OS*\n\n` +
              `\`!connect generate\` — Generate token koneksi\n` +
              `\`!connect verify <token>\` — Hubungkan bot dengan token\n` +
              `\`!connect list\` — Lihat bot yang terhubung\n` +
              `\`!connect remove <botId>\` — Lepas koneksi bot\n` +
              `\`!connect status <botId>\` — Status bot\n\n` +
              `💡 *Cara terbaik*: Generate token dari Web Panel → Bot Manager → *Connect Bot*\n` +
              `Lalu paste token ke bot kamu: \`!connect verify <token>\``
      });
      return;
    }

    // ─── Generate token koneksi ───
    if (mode === 'generate') {
      const session = webAuth.getSession(userId);
      const webUserId = session?.webUserId; // usr_xxx
      const plan      = session?.plan || 'free';
      const email     = session?.email || null;

      const connections = loadConnections();
      // Count user's bots by webUserId (if logged in) or by ownerPhone
      const userConns = Object.values(connections).filter(c =>
        (webUserId && c.ownerWebUserId === webUserId) ||
        (!webUserId && c.ownerPhone === userId)
      );
      const maxBots = { free: 1, starter: 3, pro: 10, enterprise: 999 }[plan] || 1;

      if (userConns.length >= maxBots) {
        await safeSend(jid, {
          text: `⚠️ Kamu sudah mencapai batas bot (${maxBots} bot untuk plan ${plan.toUpperCase()}).\n\nUpgrade plan untuk tambah bot lebih banyak!`
        });
        return;
      }

      const token = 'dlvc_' + crypto.randomBytes(24).toString('hex');
      const pending = loadPending();
      pending[token] = {
        token,
        ownerWebUserId: webUserId || null, // KEY FIX: use usr_xxx
        ownerPhone:     userId,
        ownerEmail:     email,
        plan,
        createdAt: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000),
        used: false,
      };
      savePending(pending);

      const loginNote = webUserId ? '' : '\n\n⚠️ *Login ke web dulu!* Kamu belum !login — bot yang terhubung mungkin tidak muncul di web panel.\nKetik `!login KODE` dulu.';

      await safeSend(jid, {
        text: `🔑 *Connection Token*\n\n\`${token}\`\n\n*Cara pakai:*\n1. Copy token di atas\n2. Di bot kamu, kirim ke DLavie OS:\n   \`!connect verify ${token}\`\n\n⏱️ Token berlaku *24 jam*\n📊 Bot: ${userConns.length}/${maxBots}${loginNote}`
      });
      return;
    }

    // ─── Verifikasi token (dari bot user) ───
    if (mode === 'verify') {
      const token = args[1];
      if (!token) {
        await safeSend(jid, { text: '❌ Format: `!connect verify <token>`' });
        return;
      }

      // Check pending from file
      const pending = loadPending();
      let pendingEntry = pending[token];

      // Also check old format (in connections._pending)
      if (!pendingEntry) {
        const conns = loadConnections();
        pendingEntry = conns._pending?.[token];
      }

      // Also check DB
      if (!pendingEntry && isPgConnected()) {
        try {
          const res = await query(
            'SELECT * FROM dlavie_connect_tokens WHERE token=$1 AND used=false AND expires_at > NOW()',
            [token]
          );
          if (res.rows[0]) {
            pendingEntry = {
              ownerWebUserId: res.rows[0].owner_web_user_id,
              ownerPhone: res.rows[0].owner_phone,
              ownerEmail: res.rows[0].owner_email,
              plan: res.rows[0].plan,
              expiresAt: new Date(res.rows[0].expires_at).getTime(),
            };
          }
        } catch (_) {}
      }

      if (!pendingEntry) {
        await safeSend(jid, { text: '❌ Token tidak valid atau sudah digunakan.\n\nGenerate token baru: `!connect generate`' });
        return;
      }

      if (Date.now() > pendingEntry.expiresAt) {
        delete pending[token];
        savePending(pending);
        await safeSend(jid, { text: '❌ Token sudah kadaluarsa (> 24 jam). Generate token baru.' });
        return;
      }

      const botId = 'bot_' + crypto.randomBytes(8).toString('hex');
      const botEntry = {
        botId,
        botNumber:      userId,
        ownerWebUserId: pendingEntry.ownerWebUserId, // usr_xxx — CRITICAL FIX
        ownerPhone:     pendingEntry.ownerPhone,
        ownerEmail:     pendingEntry.ownerEmail,
        connectedAt:    Date.now(),
        status:         'active',
        plan:           pendingEntry.plan || 'free',
        lastPing:       Date.now(),
        metadata:       { connectedVia: 'wa_bot' },
      };

      // Save to file
      const connections = loadConnections();
      connections[botId] = botEntry;
      saveConnections(connections);

      // Remove pending
      delete pending[token];
      savePending(pending);

      // Save to DB
      await saveConnectionToDB(botEntry);

      // Mark DB token as used
      if (isPgConnected()) {
        try { await query('UPDATE dlavie_connect_tokens SET used=true WHERE token=$1', [token]); } catch (_) {}
      }

      // Register ke MultiBot Manager
      if (multiBot) {
        try {
          await multiBot.registerBot(botId, {
            number: userId, owner: pendingEntry.ownerWebUserId || pendingEntry.ownerPhone, plan: pendingEntry.plan,
          });
        } catch (_) {}
      }

      // Notify owner via WA
      const ownerPhone = pendingEntry.ownerPhone;
      if (ownerPhone && ownerPhone !== userId) {
        try {
          await sock.sendMessage(`${ownerPhone}@s.whatsapp.net`, {
            text: `🟢 *Bot Terhubung!*\n\nBot: ${userId}\nBot ID: \`${botId}\`\nWaktu: ${new Date().toLocaleString('id-ID')}\n\nGunakan \`!relay ${botId} <command>\` untuk kontrol bot.\nAtau cek Web Panel → Bot Manager.`
          });
        } catch (_) {}
      }

      // Notify OS owner
      const osOwner = process.env.OWNER_NUMBER;
      if (osOwner && osOwner !== userId && osOwner !== ownerPhone) {
        try {
          await sock.sendMessage(`${osOwner}@s.whatsapp.net`, {
            text: `📢 *Bot Baru Terhubung*\n\nOwner: ${pendingEntry.ownerEmail || ownerPhone}\nBot: ${userId}\nID: ${botId}\nPlan: ${pendingEntry.plan}`
          });
        } catch (_) {}
      }

      await safeSend(jid, {
        text: `✅ *Berhasil Terhubung ke DLavie OS!*\n\nBot ID: \`${botId}\`\nOwner: ${pendingEntry.ownerEmail || pendingEntry.ownerPhone || 'Unknown'}\n\nBot kamu sekarang muncul di Web Panel → Bot Manager.\nOwner bisa kontrol via \`!relay\` atau web dashboard.`
      });
      return;
    }

    // ─── List bot ───
    if (mode === 'list') {
      const session = webAuth.getSession(userId);
      const webUserId = session?.webUserId;
      const connections = loadConnections();

      // Match by webUserId or ownerPhone
      const userBots = Object.values(connections).filter(c =>
        c.botId && (
          (webUserId && c.ownerWebUserId === webUserId) ||
          c.ownerPhone === userId ||
          c.ownerEmail === session?.email
        )
      );

      if (!userBots.length) {
        await safeSend(jid, { text: '🤖 Belum ada bot yang terhubung.\n\nGenerate token: `!connect generate`\nAtau dari Web Panel → Bot Manager → Connect Bot' });
        return;
      }

      const lines = userBots.map((b, i) =>
        `${i+1}. \`${b.botId}\`\n   📱 ${b.botNumber} | ${b.status === 'active' ? '🟢' : '🔴'} ${b.status}\n   🕐 ${new Date(b.connectedAt).toLocaleDateString('id-ID')}`
      );
      await safeSend(jid, { text: `*🤖 Bot Terhubung (${userBots.length})*\n\n${lines.join('\n\n')}\n\nKontrol: \`!relay <botId> <command>\`` });
      return;
    }

    // ─── Remove bot ───
    if (mode === 'remove') {
      const botId = args[1];
      if (!botId) { await safeSend(jid, { text: '❌ Format: `!connect remove <botId>`' }); return; }

      const session = webAuth.getSession(userId);
      const webUserId = session?.webUserId;
      const connections = loadConnections();
      const botEntry = connections[botId];

      const isOwner = botEntry && (
        botEntry.ownerPhone === userId ||
        (webUserId && botEntry.ownerWebUserId === webUserId) ||
        botEntry.ownerEmail === session?.email ||
        isOwnerMsg(msg, process.env.OWNER_NUMBER)
      );

      if (!botEntry || !isOwner) {
        await safeSend(jid, { text: '❌ Bot tidak ditemukan atau bukan milikmu.' });
        return;
      }

      delete connections[botId];
      saveConnections(connections);
      await removeConnectionFromDB(botId);
      await safeSend(jid, { text: `✅ Bot \`${botId}\` berhasil dilepas dari DLavie OS.` });
      return;
    }

    // ─── Status bot ───
    if (mode === 'status') {
      const botId = args[1];
      if (!botId) { await safeSend(jid, { text: '❌ Format: `!connect status <botId>`' }); return; }

      const connections = loadConnections();
      const botEntry = connections[botId];

      if (!botEntry) { await safeSend(jid, { text: '❌ Bot tidak ditemukan.' }); return; }

      const uptime = Date.now() - botEntry.connectedAt;
      const hours  = Math.floor(uptime / 3600000);
      const mins   = Math.floor((uptime % 3600000) / 60000);

      await safeSend(jid, {
        text: `*Status Bot*\n\nID: \`${botEntry.botId}\`\nNomor: ${botEntry.botNumber}\nStatus: ${botEntry.status === 'active' ? '🟢 Active' : '🔴 Offline'}\nTerhubung: ${new Date(botEntry.connectedAt).toLocaleString('id-ID')}\nUptime: ${hours}j ${mins}m\nPlan: ${botEntry.plan?.toUpperCase()}`
      });
      return;
    }

    await safeSend(jid, { text: '❌ Format tidak valid. Ketik `!connect help`' });
  }
};
