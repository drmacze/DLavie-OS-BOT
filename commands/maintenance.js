'use strict';
const fs   = require('fs');
const path = require('path');
const { isOwner } = require('../src/security/ownerGuard');

const MAINT_FILE = path.join(__dirname, '../tmp/maintenance.json');

function loadMaint() {
  try { if (fs.existsSync(MAINT_FILE)) return JSON.parse(fs.readFileSync(MAINT_FILE, 'utf8')); } catch(_) {}
  return { bot: { active: false, description: '' }, panel: { active: false, description: '', scheduledAt: null } };
}
function saveMaint(m) {
  try {
    const dir = path.dirname(MAINT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MAINT_FILE, JSON.stringify(m, null, 2));
  } catch(_) {}
}

module.exports = {
  name: 'maintenance',
  aliases: ['maint', 'maintenance-mode'],
  description: 'Kelola maintenance mode bot/panel (owner only)',
  execute: async (sock, msg, args, config) => {
    const jid = msg.key.remoteJid;
    if (!isOwner(msg, config)) {
      await sock.sendMessage(jid, { text: '❌ Perintah ini hanya untuk owner.' });
      return;
    }

    const target = (args.shift() || 'status').toLowerCase(); // bot | panel | status
    const action = (args.shift() || '').toLowerCase();        // on | off | schedule | status
    const desc   = args.join(' ').trim();

    const maint = loadMaint();

    // !maintenance status
    if (target === 'status' || (!action && target !== 'bot' && target !== 'panel')) {
      await sock.sendMessage(jid, {
        text: `🔧 *Maintenance Status*\n\n` +
          `🤖 *Bot:* ${maint.bot?.active ? '🔴 MAINTENANCE' : '🟢 Normal'}\n` +
          (maint.bot?.active ? `   Keterangan: ${maint.bot.description || '(tidak ada)'}\n` : '') +
          `\n🌐 *Panel:* ${maint.panel?.active ? '🔴 MAINTENANCE' : '🟢 Normal'}\n` +
          (maint.panel?.active ? `   Keterangan: ${maint.panel.description || '(tidak ada)'}\n` : '') +
          (maint.panel?.scheduledAt ? `   Jadwal: ${new Date(maint.panel.scheduledAt).toLocaleString('id-ID')}\n` : '') +
          `\n*Commands:*\n` +
          `\`!maintenance bot on [keterangan]\` — Bot maintenance ON\n` +
          `\`!maintenance bot off\` — Bot maintenance OFF\n` +
          `\`!maintenance panel on [keterangan]\` — Panel maintenance ON\n` +
          `\`!maintenance panel off\` — Panel maintenance OFF\n` +
          `\`!maintenance panel schedule [DD/MM/YYYY HH:mm] [keterangan]\` — Jadwalkan`
      });
      return;
    }

    if (target !== 'bot' && target !== 'panel') {
      await sock.sendMessage(jid, { text: `⚠️ Target harus \`bot\` atau \`panel\`.\n\`!maintenance bot|panel on|off [keterangan]\`` });
      return;
    }

    if (action === 'on' || action === 'aktif' || action === 'mulai') {
      maint[target].active      = true;
      maint[target].description = desc || (target === 'bot' ? 'Bot sedang maintenance, harap tunggu.' : 'Panel sedang maintenance, harap tunggu.');
      maint[target].startedAt   = Date.now();
      maint[target].scheduledAt = null;
      saveMaint(maint);
      await sock.sendMessage(jid, {
        text: `🔴 *${target === 'bot' ? 'Bot' : 'Panel'} Maintenance AKTIF!*\n\n` +
          `📝 Keterangan: ${maint[target].description}\n` +
          `⏰ Dimulai: ${new Date().toLocaleString('id-ID')}\n\n` +
          `Matikan dengan: \`!maintenance ${target} off\``
      });
      return;
    }

    if (action === 'off' || action === 'nonaktif' || action === 'selesai') {
      maint[target].active      = false;
      maint[target].description = '';
      maint[target].startedAt   = null;
      maint[target].scheduledAt = null;
      maint[target].endedAt     = Date.now();
      saveMaint(maint);
      await sock.sendMessage(jid, {
        text: `✅ *${target === 'bot' ? 'Bot' : 'Panel'} kembali normal!*\n\nMaintenance telah dinonaktifkan.`
      });
      return;
    }

    if (action === 'schedule' || action === 'jadwal') {
      // !maintenance panel schedule 25/12/2025 02:00 Upgrade database
      // Parse: "DD/MM/YYYY HH:mm keterangan" or just "keterangan"
      let scheduledAt = null;
      let schedDesc   = desc;
      const dateMatch = desc.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{2}:\d{2})\s*(.*)/);
      if (dateMatch) {
        const [, datePart, timePart, restDesc] = dateMatch;
        const [d, mo, y] = datePart.split('/').map(Number);
        const [h, mi]    = timePart.split(':').map(Number);
        scheduledAt = new Date(y, mo - 1, d, h, mi).getTime();
        schedDesc   = restDesc.trim();
      }
      maint[target].scheduledAt = scheduledAt;
      maint[target].schedDesc   = schedDesc || 'Maintenance terjadwal';
      saveMaint(maint);

      await sock.sendMessage(jid, {
        text: `📅 *Maintenance Terjadwal!*\n\n` +
          `Target: ${target === 'bot' ? 'Bot' : 'Panel'}\n` +
          (scheduledAt ? `Waktu: ${new Date(scheduledAt).toLocaleString('id-ID')}\n` : 'Waktu: Segera\n') +
          `Keterangan: ${schedDesc || '(tidak ada)'}\n\n` +
          `💡 Jalankan \`!maintenance ${target} on\` untuk memulai secara manual.`
      });
      return;
    }

    if (action === 'desc' || action === 'keterangan') {
      maint[target].description = desc || '';
      saveMaint(maint);
      await sock.sendMessage(jid, { text: `✅ Keterangan maintenance diupdate: ${desc || '(kosong)'}` });
      return;
    }

    await sock.sendMessage(jid, {
      text: `⚠️ Aksi tidak dikenal.\nGunakan: \`on\` | \`off\` | \`schedule\` | \`status\``
    });
  }
};
