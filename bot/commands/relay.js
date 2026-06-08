/**
 * DLavie OS — !relay command v2.1
 * Fixed: ownership check now uses ownerPhone + ownerWebUserId (was wrongly checking ownerUserId)
 */

const fs     = require('fs');
const path   = require('path');
const axios  = require('axios');
const { getEngine }  = require('../src/core/engine');
const { getWebAuth } = require('../src/auth/webAuth');
const { extractSenderNumber, isOwnerMsg } = require('../src/utils/ownerUtils');

const CONNECTIONS_FILE = path.join(__dirname, '../tmp/bot_connections.json');
const RELAY_TIMEOUT_MS = 30_000;

function loadConnections() {
  try {
    if (fs.existsSync(CONNECTIONS_FILE)) return JSON.parse(fs.readFileSync(CONNECTIONS_FILE, 'utf8'));
  } catch (_) {}
  return {};
}

function isBotOwner(botEntry, userId, session, config) {
  if (!botEntry) return false;
  const webUserId = session?.webUserId;
  const email     = session?.email;
  return (
    botEntry.ownerPhone     === userId ||
    botEntry.ownerUserId    === userId ||
    (webUserId && botEntry.ownerWebUserId === webUserId) ||
    (email && botEntry.ownerEmail === email) ||
    isOwnerMsg({ key: { remoteJid: `${userId}@s.whatsapp.net`, participant: `${userId}@s.whatsapp.net` } },
      config?.ownerNumber || config?.bot?.ownerNumber || process.env.OWNER_NUMBER)
  );
}

module.exports = {
  name: 'relay',
  aliases: ['mybot', 'botcmd', 'remote'],
  description: 'Relay command ke bot yang terhubung',

  execute: async (sock, msg, args, config, ctx = {}) => {
    const jid      = msg.key.remoteJid;
    const userId   = extractSenderNumber(msg);
    const safeSend = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));
    const engine   = getEngine();
    const tokenEng = engine.getSystem('token');
    const webAuth  = getWebAuth();
    const session  = webAuth.getSession(userId);

    const mode = (args[0] || 'help').toLowerCase();

    if (mode === 'help' || !args.length) {
      await safeSend(jid, {
        text:
          `*📡 Relay Command*\n\n` +
          `\`!relay list\` — Semua bot kamu\n` +
          `\`!relay <botId> <command>\` — Kirim command ke bot\n` +
          `\`!relay <botId> restart\` — Restart bot\n` +
          `\`!relay <botId> update\` — Update bot\n` +
          `\`!relay <botId> status\` — Status bot\n` +
          `\`!relay <botId> logs\` — Lihat log bot\n` +
          `\`!relay <botId> plugin list\` — Lihat plugin\n\n` +
          `💡 Contoh:\n\`!relay bot_abc123 restart\`\n\`!relay bot_abc123 plugin install repo/plugin\`\n\n` +
          `Cost: 5 token per relay`
      });
      return;
    }

    if (mode === 'list') {
      const connections = loadConnections();
      const webUserId   = session?.webUserId;
      const email       = session?.email;
      const userBots    = Object.values(connections).filter(c =>
        c.botId && (
          c.ownerPhone === userId ||
          c.ownerUserId === userId ||
          (webUserId && c.ownerWebUserId === webUserId) ||
          (email && c.ownerEmail === email)
        )
      );

      if (!userBots.length) {
        await safeSend(jid, { text: '🤖 Belum ada bot.\n\nGunakan `!connect generate` untuk menghubungkan bot kamu.\nAtau dari Web Panel → Bot Manager → Connect Bot.' });
        return;
      }

      const lines = userBots.map((b, i) => {
        const status = b.status === 'active' ? '🟢 Active' : '🔴 Offline';
        const since  = b.connectedAt ? new Date(b.connectedAt).toLocaleDateString('id-ID') : '-';
        return `${i + 1}. \`${b.botId}\`\n   📱 ${b.botNumber || '-'} | ${status}\n   🗓️ ${since}`;
      });
      await safeSend(jid, {
        text: `*🤖 Bot Kamu (${userBots.length})*\n\n${lines.join('\n\n')}\n\nGunakan: \`!relay <botId> <command>\``
      });
      return;
    }

    const botId  = args[0];
    const cmdArr = args.slice(1);
    const botCmd = cmdArr.join(' ');

    if (!botId || !botCmd) {
      await safeSend(jid, { text: 'Format: `!relay <botId> <command>`\n\nContoh: `!relay bot_abc123 restart`\nList bot: `!relay list`' });
      return;
    }

    const connections = loadConnections();
    const botEntry    = connections[botId];

    if (!botEntry) {
      await safeSend(jid, {
        text: `❌ Bot \`${botId}\` tidak ditemukan.\n\nGunakan \`!relay list\` untuk melihat bot kamu.\nPastikan bot sudah terkoneksi dengan \`!connect verify <token>\``
      });
      return;
    }

    if (!isBotOwner(botEntry, userId, session, config)) {
      await safeSend(jid, {
        text: `❌ Bot \`${botId}\` bukan milikmu.\n\nOwner bot ini berbeda. Gunakan \`!relay list\` untuk melihat bot milikmu.`
      });
      return;
    }

    if (tokenEng) {
      const tokenResult = tokenEng.spend(userId, 'relayCommand');
      if (!tokenResult.success) {
        await safeSend(jid, { text: `💰 Token tidak cukup.\n${tokenResult.error}\nSaldo: ${tokenResult.balance}` });
        return;
      }
    }

    const botApiUrl = botEntry.apiUrl || null;

    if (botApiUrl) {
      try {
        await safeSend(jid, { text: `📡 Mengirim command ke \`${botId}\`...\nCommand: \`${botCmd}\`` });

        const response = await axios.post(`${botApiUrl}/relay`, {
          command:    botCmd,
          fromUser:   userId,
          dlavieToken: botEntry.relayToken,
        }, { timeout: RELAY_TIMEOUT_MS });

        const result = response.data?.output || response.data?.result || JSON.stringify(response.data);
        await safeSend(jid, {
          text: `✅ *Relay Response*\nBot: \`${botId}\`\nCommand: \`${botCmd}\`\n\nOutput:\n${String(result).slice(0, 2500)}`
        });
      } catch (err) {
        await safeSend(jid, {
          text: `❌ Relay gagal:\n${err.message}\n\nPastikan bot user sedang aktif & API URL benar.`
        });
      }
    } else {
      const relayEntry = {
        id:        `relay_${Date.now()}`,
        botId,
        command:   botCmd,
        fromUser:  userId,
        status:    'pending',
        createdAt: Date.now(),
        expiresAt: Date.now() + RELAY_TIMEOUT_MS,
      };

      const RELAY_FILE = path.join(__dirname, '../tmp/relay_queue.json');
      let relayQueue   = [];
      try {
        if (fs.existsSync(RELAY_FILE)) relayQueue = JSON.parse(fs.readFileSync(RELAY_FILE, 'utf8'));
      } catch (_) {}
      relayQueue.push(relayEntry);
      if (relayQueue.length > 100) relayQueue = relayQueue.slice(-100);
      try {
        const dir = path.dirname(RELAY_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(RELAY_FILE, JSON.stringify(relayQueue, null, 2));
      } catch (_) {}

      await safeSend(jid, {
        text:
          `📤 *Command Dikirim ke Queue*\n\n` +
          `Bot: \`${botId}\`\nCommand: \`${botCmd}\`\nStatus: ⏳ Menunggu bot eksekusi\n\n` +
          `Bot perlu poll dari DLavie API untuk mengambil command pending.\n\n` +
          `Cek status: \`!relay ${botId} status\``
      });
    }

    try {
      const audit = engine.getSystem('audit');
      if (audit) audit.log('relay_command', userId, { botId, command: botCmd });
    } catch (_) {}
  }
};
