'use strict';
const fs   = require('fs');
const path = require('path');
const { isOwner } = require('../src/security/ownerGuard');

const POPUP_FILE = path.join(__dirname, '../tmp/popup.json');

function loadPopup() {
  try { if (fs.existsSync(POPUP_FILE)) return JSON.parse(fs.readFileSync(POPUP_FILE, 'utf8')); } catch(_) {}
  return { active: false, title: '', description: '', type: 'info', createdAt: null };
}
function savePopup(p) {
  try {
    const dir = path.dirname(POPUP_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(POPUP_FILE, JSON.stringify(p, null, 2));
  } catch(_) {}
}

module.exports = {
  name: 'popup',
  aliases: ['popups', 'notice', 'announcement'],
  description: 'Kelola popup web panel (owner only)',
  execute: async (sock, msg, args, config) => {
    const jid = msg.key.remoteJid;
    if (!isOwner(msg, config)) {
      await sock.sendMessage(jid, { text: '❌ Perintah ini hanya untuk owner.' });
      return;
    }

    const mode = (args.shift() || 'status').toLowerCase();

    if (mode === 'set') {
      // !popup set Judul | Deskripsi lengkap di sini
      const fullText = args.join(' ');
      const parts    = fullText.split('|');
      const title    = (parts[0] || '').trim();
      const desc     = (parts[1] || '').trim();
      if (!title) {
        await sock.sendMessage(jid, {
          text: `⚠️ *Format:*\n\`!popup set Judul | Deskripsi\`\n\n*Contoh:*\n\`!popup set 🔥 Promo Spesial | Dapatkan 10K token gratis untuk user baru! Berlaku hingga akhir bulan.\``
        });
        return;
      }
      const popup = { active: true, title, description: desc, type: 'info', createdAt: Date.now(), updatedAt: Date.now() };
      savePopup(popup);
      await sock.sendMessage(jid, {
        text: `✅ *Popup berhasil diset!*\n\n📌 *Judul:* ${title}\n📝 *Deskripsi:* ${desc || '(kosong)'}\n\n💡 Popup sudah aktif dan terlihat di web panel.`
      });
      return;
    }

    if (mode === 'on' || mode === 'aktif' || mode === 'enable') {
      const popup = loadPopup();
      if (!popup.title) {
        await sock.sendMessage(jid, { text: '⚠️ Set popup dulu dengan\n`!popup set Judul | Deskripsi`' });
        return;
      }
      popup.active = true; popup.updatedAt = Date.now();
      savePopup(popup);
      await sock.sendMessage(jid, { text: `✅ Popup *"${popup.title}"* diaktifkan.` });
      return;
    }

    if (mode === 'off' || mode === 'nonaktif' || mode === 'disable') {
      const popup = loadPopup();
      popup.active = false; popup.updatedAt = Date.now();
      savePopup(popup);
      await sock.sendMessage(jid, { text: `⏹️ Popup dinonaktifkan.` });
      return;
    }

    if (mode === 'clear' || mode === 'hapus' || mode === 'reset') {
      savePopup({ active: false, title: '', description: '', type: 'info', createdAt: null });
      await sock.sendMessage(jid, { text: '🗑️ Popup dihapus.' });
      return;
    }

    if (mode === 'type' || mode === 'tipe') {
      const t = (args[0] || '').toLowerCase();
      if (!['info', 'success', 'warning', 'error'].includes(t)) {
        await sock.sendMessage(jid, { text: `⚠️ Tipe valid: \`info\` | \`success\` | \`warning\` | \`error\`` });
        return;
      }
      const popup = loadPopup(); popup.type = t; popup.updatedAt = Date.now();
      savePopup(popup);
      await sock.sendMessage(jid, { text: `✅ Tipe popup diubah ke *${t}*` });
      return;
    }

    // status
    const popup = loadPopup();
    await sock.sendMessage(jid, {
      text: `📢 *Popup Status*\n\n` +
        `Status: ${popup.active ? '🟢 Aktif' : '🔴 Nonaktif'}\n` +
        `Judul: ${popup.title || '(belum diset)'}\n` +
        `Deskripsi: ${popup.description || '(kosong)'}\n` +
        `Tipe: ${popup.type || 'info'}\n` +
        (popup.createdAt ? `Dibuat: ${new Date(popup.createdAt).toLocaleString('id-ID')}\n` : '') +
        `\n*Commands:*\n` +
        `\`!popup set Judul | Deskripsi\` — Set popup baru\n` +
        `\`!popup on/off\` — Toggle aktif\n` +
        `\`!popup type [info|success|warning|error]\` — Ubah tipe\n` +
        `\`!popup clear\` — Hapus popup`
    });
  }
};
