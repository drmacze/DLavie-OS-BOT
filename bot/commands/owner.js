/**
 * DLavie OS — !owner command
 * Info dan panel kontrol untuk owner.
 */

'use strict';

const { isOwnerMsg, extractSenderNumber } = require('../src/utils/ownerUtils');
const { getEngine } = require('../src/core/engine');

function isOwner(msg, config) { return isOwnerMsg(msg, config.ownerNumber); }

module.exports = {
  name: 'owner',
  aliases: ['admin', 'me'],
  description: 'Owner panel dan info sistem',

  execute: async (sock, msg, args, config, ctx = {}) => {
    const jid      = msg.key.remoteJid;
    const safeSend = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));
    const prefix   = config.botPrefix || '!';

    if (!isOwner(msg, config)) {
      await safeSend(jid, { text: '❌ Perintah ini hanya untuk owner.' });
      return;
    }

    const mode = (args.shift() || 'info').toLowerCase();

    // ─── Info ───
    if (mode === 'info') {
      const engine   = getEngine();
      const status   = await engine.getStatus().catch(() => ({}));
      const multiBot = engine.getSystem('multiBot');
      const botStatus = multiBot ? await multiBot.getStatus().catch(() => null) : null;
      const uptime   = status.startedAt
        ? Math.floor((Date.now() - status.startedAt) / 60000)
        : '—';

      await safeSend(jid, {
        text:
          `👑 *Owner Panel — DLavie OS v2.0*\n\n` +
          `📱 Bot: *${config.botName || 'DLavie OS'}*\n` +
          `📞 Bot Number: \`${config.botNumber || 'N/A'}\`\n` +
          `🔑 Owner Number: \`${config.ownerNumber || 'N/A'}\`\n` +
          `⏱️ Uptime: *${uptime} menit*\n` +
          `🤖 Bot Terhubung: *${botStatus?.totalBots ?? '—'}* (Online: ${botStatus?.onlineBots ?? '—'})\n` +
          `🔒 Lockdown: ${status.emergencyLockdown ? '🔴 AKTIF' : '✅ Off'}\n` +
          `🕵️ Stealth: ${config.security?.stealthMode ? '🟡 Aktif' : '✅ Off'}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `📋 *Command Owner:*\n` +
          `\`${prefix}owner\` — Panel ini\n` +
          `\`${prefix}status\` — Full system status\n` +
          `\`${prefix}popup\` — Kirim notif ke bot\n` +
          `\`${prefix}debug\` — Diagnostik JID & owner\n` +
          `\`${prefix}audit\` — Audit log aktivitas\n` +
          `\`${prefix}broadcast\` — Broadcast ke semua user\n` +
          `\`${prefix}lockdown\` — Emergency lockdown\n` +
          `\`${prefix}stealth\` — Stealth mode\n` +
          `\`${prefix}config\` — Konfigurasi sistem\n` +
          `\`${prefix}user\` — Manajemen user\n` +
          `\`${prefix}plugin\` — Plugin marketplace\n` +
          `\`${prefix}shell\` — Eksekusi shell\n` +
          `\`${prefix}fix\` — Auto-fix & repair\n` +
          `\`${prefix}schedule\` — Scheduled tasks\n` +
          `\`${prefix}bot\` — Multi-bot control`
      });
      return;
    }

    // ─── Emergency panel ───
    if (mode === 'emergency') {
      await safeSend(jid, {
        text:
          `🚨 *Emergency Commands*\n\n` +
          `\`${prefix}lockdown on\` — Kunci semua akses\n` +
          `\`${prefix}lockdown off\` — Buka kunci\n` +
          `\`${prefix}stealth on\` — Mode siluman\n` +
          `\`${prefix}stealth off\` — Matikan stealth\n` +
          `\`${prefix}fix apply\` — Jalankan auto-repair\n` +
          `\`${prefix}status\` — Full system check\n` +
          `\`${prefix}debug\` — Cek JID & owner status\n` +
          `\`${prefix}audit recent\` — Log aktivitas terbaru`
      });
      return;
    }

    // ─── Default: tampilkan help ───
    await safeSend(jid, {
      text:
        `👑 *Owner Command*\n\n` +
        `\`${prefix}owner\` atau \`${prefix}owner info\` — Panel owner\n` +
        `\`${prefix}owner emergency\` — Daftar emergency commands`
    });
  }
};
