/**
 * DLavie OS — !maintenance command v1.0
 * Control web panel maintenance mode + popup from WhatsApp bot
 * Owner only — syncs with web server via shared tmp/ files
 */

'use strict';

const { isOwnerMsg } = require('../src/utils/ownerUtils');
const fs   = require('fs');
const path = require('path');

const MAINTENANCE_FILE = path.join(__dirname, '../tmp/maintenance.json');
const POPUP_FILE       = path.join(__dirname, '../tmp/popup.json');

function loadMaintenance() {
  try { if (fs.existsSync(MAINTENANCE_FILE)) return JSON.parse(fs.readFileSync(MAINTENANCE_FILE, 'utf8')); } catch (_) {}
  return {
    active: false,
    title: 'Maintenance',
    description: 'Sistem sedang dalam maintenance. Mohon tunggu.',
    schedule: '',
    estimatedEnd: '',
    updatedAt: null,
    updatedBy: '',
  };
}
function saveMaintenance(data) {
  try {
    const dir = path.dirname(MAINTENANCE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MAINTENANCE_FILE, JSON.stringify(data, null, 2));
  } catch (_) {}
}

function loadPopup() {
  try { if (fs.existsSync(POPUP_FILE)) return JSON.parse(fs.readFileSync(POPUP_FILE, 'utf8')); } catch (_) {}
  return {
    active: false,
    title: 'Pengumuman',
    message: '',
    buttonText: 'Tutup',
    icon: '📢',
    updatedAt: null,
  };
}
function savePopup(data) {
  try { fs.writeFileSync(POPUP_FILE, JSON.stringify(data, null, 2)); } catch (_) {}
}

module.exports = {
  name: 'maintenance',
  aliases: ['mtc', 'maint'],
  description: 'Kelola maintenance mode & popup web panel (Owner only)',
  ownerOnly: true,

  execute: async (sock, msg, args, config, ctx = {}) => {
    const jid      = msg.key.remoteJid;
    const safeSend = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));

    if (!isOwnerMsg(msg, config.ownerNumber || process.env.OWNER_NUMBER)) {
      await safeSend(jid, { text: '🚫 Hanya Owner DLavie OS yang bisa pakai command ini.' });
      return;
    }

    const sub  = (args[0] || 'status').toLowerCase();
    const rest = args.slice(1).join(' ');

    // ─── MAINTENANCE ───────────────────────────────────────
    if (sub === 'on' || sub === 'enable' || sub === 'aktif') {
      const m = loadMaintenance();
      m.active    = true;
      m.updatedAt = Date.now();
      m.updatedBy = msg.key.remoteJid;
      saveMaintenance(m);
      await safeSend(jid, {
        text: `🔧 *Maintenance Mode AKTIF*\n\nWeb panel sekarang menampilkan halaman maintenance ke semua user.\n\nGunakan \`!maintenance desc <deskripsi>\` untuk ubah pesan.\nGunakan \`!maintenance off\` untuk matikan.`
      });
      return;
    }

    if (sub === 'off' || sub === 'disable' || sub === 'nonaktif') {
      const m = loadMaintenance();
      m.active    = false;
      m.updatedAt = Date.now();
      m.updatedBy = msg.key.remoteJid;
      saveMaintenance(m);
      await safeSend(jid, { text: `✅ *Maintenance Mode DINONAKTIFKAN*\n\nWeb panel kembali normal. User bisa akses semua halaman.` });
      return;
    }

    if (sub === 'desc' || sub === 'deskripsi' || sub === 'msg' || sub === 'pesan') {
      if (!rest) { await safeSend(jid, { text: '❌ Format: `!maintenance desc <deskripsi>`' }); return; }
      const m = loadMaintenance();
      m.description = rest;
      m.updatedAt   = Date.now();
      saveMaintenance(m);
      await safeSend(jid, { text: `✅ Deskripsi maintenance diubah ke:\n\n_${rest}_` });
      return;
    }

    if (sub === 'title' || sub === 'judul') {
      if (!rest) { await safeSend(jid, { text: '❌ Format: `!maintenance title <judul>`' }); return; }
      const m = loadMaintenance();
      m.title     = rest;
      m.updatedAt = Date.now();
      saveMaintenance(m);
      await safeSend(jid, { text: `✅ Judul maintenance diubah ke: *${rest}*` });
      return;
    }

    if (sub === 'schedule' || sub === 'jadwal') {
      if (!rest) { await safeSend(jid, { text: '❌ Format: `!maintenance schedule <info jadwal>`\n\nContoh: `!maintenance schedule Sabtu, 10 Jan 2026 pukul 00:00 - 03:00 WIB`' }); return; }
      const m = loadMaintenance();
      m.schedule  = rest;
      m.updatedAt = Date.now();
      saveMaintenance(m);
      await safeSend(jid, { text: `✅ Jadwal maintenance diubah ke:\n\n_${rest}_` });
      return;
    }

    if (sub === 'time' || sub === 'waktu' || sub === 'end' || sub === 'selesai') {
      if (!rest) { await safeSend(jid, { text: '❌ Format: `!maintenance time <estimasi selesai>`\n\nContoh: `!maintenance time 2 jam lagi / pukul 03.00 WIB`' }); return; }
      const m = loadMaintenance();
      m.estimatedEnd = rest;
      m.updatedAt    = Date.now();
      saveMaintenance(m);
      await safeSend(jid, { text: `✅ Estimasi selesai diubah ke:\n\n_${rest}_` });
      return;
    }

    // ─── POPUP ─────────────────────────────────────────────
    if (sub === 'popup') {
      const popSub  = (args[1] || 'status').toLowerCase();
      const popRest = args.slice(2).join(' ');

      if (popSub === 'on' || popSub === 'aktif') {
        const p = loadPopup();
        if (!p.message && !p.title) { await safeSend(jid, { text: '⚠️ Set pesan popup dulu:\n`!maintenance popup msg <pesan>`\n`!maintenance popup title <judul>`' }); return; }
        p.active    = true;
        p.updatedAt = Date.now();
        savePopup(p);
        await safeSend(jid, { text: `✅ *Popup AKTIF*\n\nPopup sekarang muncul ke semua pengunjung web panel.\n\nMatikan: \`!maintenance popup off\`` });
        return;
      }

      if (popSub === 'off' || popSub === 'nonaktif') {
        const p = loadPopup();
        p.active    = false;
        p.updatedAt = Date.now();
        savePopup(p);
        await safeSend(jid, { text: '✅ Popup dinonaktifkan.' });
        return;
      }

      if (popSub === 'msg' || popSub === 'pesan') {
        if (!popRest) { await safeSend(jid, { text: '❌ Format: `!maintenance popup msg <pesan>`' }); return; }
        const p = loadPopup(); p.message = popRest; p.updatedAt = Date.now(); savePopup(p);
        await safeSend(jid, { text: `✅ Pesan popup diubah ke:\n\n_${popRest}_` });
        return;
      }

      if (popSub === 'title' || popSub === 'judul') {
        if (!popRest) { await safeSend(jid, { text: '❌ Format: `!maintenance popup title <judul>`' }); return; }
        const p = loadPopup(); p.title = popRest; p.updatedAt = Date.now(); savePopup(p);
        await safeSend(jid, { text: `✅ Judul popup diubah ke: *${popRest}*` });
        return;
      }

      if (popSub === 'btn' || popSub === 'button' || popSub === 'tombol') {
        if (!popRest) { await safeSend(jid, { text: '❌ Format: `!maintenance popup btn <teks tombol>`' }); return; }
        const p = loadPopup(); p.buttonText = popRest; p.updatedAt = Date.now(); savePopup(p);
        await safeSend(jid, { text: `✅ Tombol popup diubah ke: *${popRest}*` });
        return;
      }

      if (popSub === 'icon') {
        if (!popRest) { await safeSend(jid, { text: '❌ Format: `!maintenance popup icon 🎉`' }); return; }
        const p = loadPopup(); p.icon = popRest; p.updatedAt = Date.now(); savePopup(p);
        await safeSend(jid, { text: `✅ Icon popup diubah ke: ${popRest}` });
        return;
      }

      // Popup status
      const p = loadPopup();
      await safeSend(jid, {
        text: `*📢 Popup Status*\n\nStatus: ${p.active ? '🟢 AKTIF' : '🔴 Nonaktif'}\nJudul: ${p.title || '-'}\nPesan: ${p.message || '-'}\nTombol: ${p.buttonText || '-'}\nIcon: ${p.icon || '-'}\nUpdate: ${p.updatedAt ? new Date(p.updatedAt).toLocaleString('id-ID') : '-'}\n\n*Sub-commands popup:*\n\`!maintenance popup on|off\` — Toggle\n\`!maintenance popup title <judul>\`\n\`!maintenance popup msg <pesan>\`\n\`!maintenance popup btn <teks>\`\n\`!maintenance popup icon <emoji>\``
      });
      return;
    }

    // ─── STATUS ────────────────────────────────────────────
    if (sub === 'status' || sub === 'info') {
      const m = loadMaintenance();
      const p = loadPopup();
      await safeSend(jid, {
        text: `*🔧 Maintenance & Popup Status*\n\n` +
              `*Maintenance:* ${m.active ? '🔴 AKTIF' : '🟢 Nonaktif'}\n` +
              `├ Judul: ${m.title || '-'}\n` +
              `├ Deskripsi: ${m.description?.slice(0,80) || '-'}\n` +
              `├ Jadwal: ${m.schedule || '-'}\n` +
              `└ Estimasi selesai: ${m.estimatedEnd || '-'}\n\n` +
              `*Popup:* ${p.active ? '🟢 AKTIF' : '⚫ Nonaktif'}\n` +
              `├ Judul: ${p.title || '-'}\n` +
              `└ Pesan: ${p.message?.slice(0,60) || '-'}\n\n` +
              `*Commands:*\n` +
              `\`!maintenance on|off\` — Toggle maintenance\n` +
              `\`!maintenance desc <teks>\` — Ubah deskripsi\n` +
              `\`!maintenance title <teks>\` — Ubah judul\n` +
              `\`!maintenance schedule <info>\` — Jadwal maintenance\n` +
              `\`!maintenance time <estimasi>\` — Estimasi selesai\n` +
              `\`!maintenance popup ...\` — Kelola popup`
      });
      return;
    }

    await safeSend(jid, { text: 'Ketik `!maintenance status` untuk melihat semua commands.' });
  }
};
