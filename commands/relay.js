/**
 * DLavie OS — !relay command
 * Relay / kirim command ke bot user yang terhubung
 * Centralized Command Relay System
 */

const fs     = require('fs');
const path   = require('path');
const axios  = require('axios');
const { getEngine }  = require('../src/core/engine');
const { getWebAuth } = require('../src/auth/webAuth');

const CONNECTIONS_FILE = path.join(__dirname, '../tmp/bot_connections.json');
const RELAY_TIMEOUT_MS = 30_000;

function loadConnections() {
  try {
    if (fs.existsSync(CONNECTIONS_FILE)) return JSON.parse(fs.readFileSync(CONNECTIONS_FILE, 'utf8'));
  } catch (_) {}
  return {};
}

function digitsOnly(v) { return String(v || '').replace(/\D/g, ''); }
function senderId(msg) {
  return digitsOnly(msg.key.participant || msg.key.remoteJid || '');
}

module.exports = {
  name: 'relay',
  aliases: ['mybot', 'botcmd', 'remote'],
  description: 'Relay command ke bot yang terhubung',

  execute: async (sock, msg, args, config, ctx = {}) => {
    const jid      = msg.key.remoteJid;
    const userId   = senderId(msg);
    const safeSend = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));
    const engine   = getEngine();
    const tokenEng = engine.getSystem('token');
    const webAuth  = getWebAuth();

    const mode = (args[0] || 'help').toLowerCase();

    if (mode === 'help' || !args.length) {
      await safeSend(jid, {
        text: `*📡 Relay Command*\n\n\`!relay <botId> <command>\` — Kirim command ke bot\n\`!relay <botId> restart\` — Restart bot\n\`!relay <botId> update\` — Update bot\n\`!relay <botId> status\` — Status bot\n\`!relay <botId> logs\` — Lihat log bot\n\`!relay <botId> plugin list\` — Lihat plugin\n\`!relay list\` — Semua bot kamu\n\nContoh:\n\`!relay bot_abc123 restart\`\n\`!relay bot_abc123 plugin install github/nama/plugin\`\n\nCost: 5 token per relay`
      });
      return;
    }

    if (mode === 'list') {
      const connections = loadConnections();
      const userBots = Object.values(connections).filter(c => c.ownerUserId === userId && c.botId);

      if (!userBots.length) {
        await safeSend(jid, { text: 'Belum ada bot.\n\nGunakan `!connect generate` untuk menghubungkan bot pertamamu.' });
        return;
      }

      const lines = userBots.map((b, i) =>
        `${i + 1}. \`${b.botId}\` — ${b.status === 'active' ? '🟢' : '🔴'} ${b.botNumber}`
      );
      await safeSend(jid, {
        text: `*🤖 Bot Kamu*\n\n${lines.join('\n')}\n\nGunakan: \`!relay <botId> <command>\``
      });
      return;
    }

    // Format: !relay <botId> <command...>
    const botId  = args[0];
    const cmdArr = args.slice(1);
    const botCmd = cmdArr.join(' ');

    if (!botId || !botCmd) {
      await safeSend(jid, { text: 'Format: `!relay <botId> <command>`\n\nContoh: `!relay bot_abc123 restart`' });
      return;
    }

    // Verifikasi bot milik user ini
    const connections = loadConnections();
    const botEntry = connections[botId];

    if (!botEntry) {
      await safeSend(jid, { text: `❌ Bot \`${botId}\` tidak ditemukan.\n\nGunakan \`!relay list\` untuk melihat bot kamu.` });
      return;
    }

    if (botEntry.ownerUserId !== userId) {
      const session = webAuth.getSession(userId);
      const isOwner = webAuth.isOwner(userId, config.ownerNumber || config.bot?.ownerNumber);
      if (!isOwner) {
        await safeSend(jid, { text: '❌ Bot ini bukan milikmu.' });
        return;
      }
    }

    // ─── Token check ───
    if (tokenEng) {
      const tokenResult = tokenEng.spend(userId, 'relayCommand');
      if (!tokenResult.success) {
        await safeSend(jid, { text: `💰 Token tidak cukup.\n${tokenResult.error}\nSaldo: ${tokenResult.balance}` });
        return;
      }
    }

    // ─── Kirim relay command ───
    const botApiUrl = botEntry.apiUrl || config.botApiUrl;

    if (botApiUrl) {
      // Mode: HTTP Relay ke bot user yang punya API endpoint
      try {
        await safeSend(jid, { text: `📡 Mengirim command ke \`${botId}\`...\nCommand: \`${botCmd}\`` });

        const response = await axios.post(`${botApiUrl}/relay`, {
          command: botCmd,
          fromUser: userId,
          dlavieToken: botEntry.relayToken,
        }, { timeout: RELAY_TIMEOUT_MS });

        const result = response.data?.output || response.data?.result || JSON.stringify(response.data);
        await safeSend(jid, {
          text: `✅ *Relay Response*\nBot: \`${botId}\`\nCommand: \`${botCmd}\`\n\nOutput:\n${String(result).slice(0, 2500)}`
        });
      } catch (err) {
        await safeSend(jid, {
          text: `❌ Relay gagal:\n${err.message}\n\nPastikan bot user sedang aktif.`
        });
      }
    } else {
      // Mode: Log relay (bot user perlu poll dari DLavie API)
      const relayEntry = {
        id:        `relay_${Date.now()}`,
        botId,
        command:   botCmd,
        fromUser:  userId,
        status:    'pending',
        createdAt: Date.now(),
        expiresAt: Date.now() + RELAY_TIMEOUT_MS,
      };

      // Simpan ke relay queue
      const RELAY_FILE = path.join(__dirname, '../tmp/relay_queue.json');
      let relayQueue = [];
      try {
        if (fs.existsSync(RELAY_FILE)) relayQueue = JSON.parse(fs.readFileSync(RELAY_FILE, 'utf8'));
      } catch (_) {}
      relayQueue.push(relayEntry);
      // Keep hanya 100 terakhir
      if (relayQueue.length > 100) relayQueue = relayQueue.slice(-100);
      try { fs.writeFileSync(RELAY_FILE, JSON.stringify(relayQueue, null, 2)); } catch (_) {}

      await safeSend(jid, {
        text: `📤 *Command Dikirim ke Queue*\n\nBot: \`${botId}\`\nCommand: \`${botCmd}\`\nStatus: ⏳ Menunggu bot eksekusi\n\nBot user perlu poll dari DLavie API untuk mengambil command.\n\nGunakan \`!relay status ${botId}\` untuk cek status.`
      });
    }

    // ─── Audit ───
    try {
      const audit = engine.getSystem('audit');
      if (audit) audit.log('relay_command', userId, { botId, command: botCmd });
    } catch (_) {}
  }
};
