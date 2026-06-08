/**
 * DLavie OS — !popup command
 * Kirim popup / notifikasi ke semua bot yang terhubung, atau tampilkan pesan penting ke owner.
 * Hanya Owner yang bisa menggunakan command ini.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { getEngine }  = require('../src/core/engine');
const { isOwnerMsg } = require('../src/utils/ownerUtils');

const CONNECTIONS_FILE = path.join(__dirname, '../tmp/bot_connections.json');

function loadConnections() {
  try {
    if (fs.existsSync(CONNECTIONS_FILE)) return JSON.parse(fs.readFileSync(CONNECTIONS_FILE, 'utf8'));
  } catch (_) {}
  return {};
}

module.exports = {
  name: 'popup',
  aliases: ['notify', 'alert', 'broadcast_popup'],
  description: 'Kirim popup / alert ke bot yang terhubung (Owner only)',

  execute: async (sock, msg, args, config, ctx = {}) => {
    const jid      = msg.key.remoteJid;
    const safeSend = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));

    // ─── Owner only ───
    if (!isOwnerMsg(msg, config.ownerNumber)) {
      await safeSend(jid, { text: '❌ Perintah ini hanya untuk owner.' });
      return;
    }

    const mode = (args[0] || 'help').toLowerCase();

    // ─── Help ───
    if (mode === 'help' || !args.length) {
      await safeSend(jid, {
        text: `*🔔 Popup / Notifikasi*\n\n` +
          `\`!popup send <pesan>\` — Kirim notifikasi ke semua bot terhubung\n` +
          `\`!popup bot <botId> <pesan>\` — Kirim ke bot tertentu\n` +
          `\`!popup test\` — Test notifikasi ke diri sendiri\n` +
          `\`!popup list\` — Lihat bot yang terhubung\n\n` +
          `*Contoh:*\n\`!popup send Server akan restart 5 menit lagi!\`\n\`!popup bot bot_abc123 Update plugin tersedia!\``
      });
      return;
    }

    // ─── Test popup ke owner sendiri ───
    if (mode === 'test') {
      const testMsg =
        `🔔 *DLavie OS — Test Popup*\n\n` +
        `✅ Popup system berfungsi dengan baik!\n` +
        `🕐 ${new Date().toLocaleString('id-ID')}\n` +
        `🤖 Bot: ${config.botName || 'DLavie OS'}`;
      await safeSend(jid, { text: testMsg });
      return;
    }

    // ─── Kirim ke semua bot ───
    if (mode === 'send') {
      const text = args.slice(1).join(' ');
      if (!text) {
        await safeSend(jid, { text: '❌ Format: `!popup send <pesan>`' });
        return;
      }

      const connections = loadConnections();
      const activeBots  = Object.values(connections).filter(c => c.botId && c.status === 'active');

      if (!activeBots.length) {
        await safeSend(jid, { text: '⚠️ Tidak ada bot aktif yang terhubung.\n\nGunakan `!connect generate` untuk menghubungkan bot.' });
        return;
      }

      const popupText =
        `🔔 *DLavie OS — Notifikasi dari Owner*\n\n` +
        `${text}\n\n` +
        `🕐 ${new Date().toLocaleString('id-ID')}`;

      let sent = 0, failed = 0;
      for (const bot of activeBots) {
        try {
          const botJid = `${bot.botNumber}@s.whatsapp.net`;
          await sock.sendMessage(botJid, { text: popupText });
          sent++;
        } catch (_) {
          failed++;
        }
      }

      await safeSend(jid, {
        text: `✅ *Popup Terkirim*\n\n📤 Terkirim: ${sent} bot\n❌ Gagal: ${failed} bot\n📝 Pesan: "${text}"`
      });
      return;
    }

    // ─── Kirim ke bot tertentu ───
    if (mode === 'bot') {
      const botId   = args[1];
      const popText = args.slice(2).join(' ');

      if (!botId || !popText) {
        await safeSend(jid, { text: '❌ Format: `!popup bot <botId> <pesan>`' });
        return;
      }

      const connections = loadConnections();
      const botEntry    = connections[botId];

      if (!botEntry) {
        await safeSend(jid, { text: `❌ Bot \`${botId}\` tidak ditemukan.\n\nGunakan \`!relay list\` untuk lihat bot kamu.` });
        return;
      }

      try {
        const botJid   = `${botEntry.botNumber}@s.whatsapp.net`;
        const notifMsg =
          `🔔 *DLavie OS — Notifikasi dari Owner*\n\n` +
          `${popText}\n\n` +
          `🕐 ${new Date().toLocaleString('id-ID')}`;
        await sock.sendMessage(botJid, { text: notifMsg });
        await safeSend(jid, { text: `✅ Notifikasi terkirim ke bot \`${botId}\` (${botEntry.botNumber})` });
      } catch (err) {
        await safeSend(jid, { text: `❌ Gagal kirim ke bot \`${botId}\`: ${err.message}` });
      }
      return;
    }

    // ─── List bot ───
    if (mode === 'list') {
      const connections = loadConnections();
      const bots = Object.values(connections).filter(c => c.botId);

      if (!bots.length) {
        await safeSend(jid, { text: 'Belum ada bot terhubung.' });
        return;
      }

      const lines = bots.map((b, i) =>
        `${i + 1}. \`${b.botId}\` — ${b.status === 'active' ? '🟢' : '🔴'} ${b.botNumber}`
      );
      await safeSend(jid, {
        text: `*🤖 Bot Terhubung (${bots.length})*\n\n${lines.join('\n')}\n\nGunakan \`!popup bot <botId> <pesan>\` untuk kirim ke bot tertentu.`
      });
      return;
    }

    await safeSend(jid, { text: '❓ Ketik `!popup help` untuk bantuan.' });
  }
};
