/**
 * DLavie OS — !customize command v2.0
 * Supports: 20 menu types, 15 themes, 7 languages, thumbnail, personality
 */

'use strict';

const { isOwnerMsg, extractSenderNumber } = require('../src/utils/ownerUtils');
const { getWebAuth }    = require('../src/auth/webAuth');
const { getBotCustomization, DEFAULT_CONFIG } = require('../src/core/botCustomization');

const THEMES = [
  'dlavie_default','minimal','modern','premium','gaming','cyberpunk','neon',
  'dark_knight','sakura','ocean','fire','matrix','hacker','royal','space'
];
const MENU_TYPES = [
  'text','number','hybrid','search','dashboard','quickaction','rolebased',
  'pagination','recent','favorite','smart','contextual','cmdpalette','wizard',
  'media','card','compact','full','aiguided','terminal',
  'button','buttoncat'
];
const LANGS    = ['id','en','ms','ar','zh','jv','su'];
const PERSONAS = ['friendly','professional','ai_assistant','funny','savage','kawaii','custom'];

const THEME_DESC = {
  dlavie_default: '╔══╗ DLavie Classic',
  minimal:        'Teks bersih tanpa dekorasi',
  modern:         '┌──┐ Modern box',
  premium:        '╭─⋆ Premium elegant',
  gaming:         '🎮 ≪≪ Gaming style',
  cyberpunk:      '▣↳ Cyberpunk futuristik',
  neon:           '✦◈ Neon glowing',
  dark_knight:    '🦇██ Dark Knight',
  sakura:         '🌸～ Sakura kawaii',
  ocean:          '🌊≋ Ocean wave',
  fire:           '🔥▲ Fire blazing',
  matrix:         '⟦⟧ Matrix code',
  hacker:         '$_ Hacker terminal',
  royal:          '👑♚ Royal luxury',
  space:          '🚀✦ Space explorer',
};

const MENU_DESC = {
  text:        'Flat teks — paling stabil semua device',
  number:      'User pilih angka dari daftar',
  hybrid:      'Kategori + shortcut (rekomendasi)',
  search:      '!menu search <kata> — cari command',
  dashboard:   'Menu + status bot real-time',
  quickaction: 'Hanya command terpenting',
  rolebased:   'Beda menu per role: user/admin/owner',
  pagination:  '!menu 1, !menu 2 — halaman per halaman',
  recent:      'Command terakhir dipakai user',
  favorite:    'Command yang di-pin user',
  smart:       'Otomatis sesuai kondisi bot',
  contextual:  'Beda menu di grup vs private',
  cmdpalette:  '!menu cmd <kata> — gaya VS Code',
  wizard:      '!menu wizard — step-by-step setup',
  media:       'Dengan thumbnail gambar/video',
  card:        'Setiap fitur ditampilkan seperti kartu',
  compact:     'Super singkat untuk akses cepat',
  full:        'Semua command ditampilkan lengkap',
  aiguided:    '!menu ai <kebutuhan> — AI arahkan',
  terminal:    'Tampilan seperti OS/console',
  button:      'Tombol interaktif WA native (max 3 button)',
  buttoncat:   'List pesan dengan kategori — gaya list WA native',
};

const LANG_NAME = { id:'Indonesia 🇮🇩', en:'English 🇬🇧', ms:'Melayu 🇲🇾', ar:'العربية 🇸🇦', zh:'中文 🇨🇳', jv:'Jawa 🏝️', su:'Sunda 🌄' };
const PERSONA_DESC = {
  friendly:     '😊 Ramah dan hangat',
  professional: '💼 Formal dan elegan',
  ai_assistant: '🤖 Tech dan akurat',
  funny:        '😄 Lucu dan penuh emoji',
  savage:       '😏 Snarky dan sarkastik',
  kawaii:       '🌸 Imut dan anime style',
  custom:       '✏️ Custom greeting text',
};

module.exports = {
  name: 'customize',
  aliases: ['custom', 'setting', 'konfigurasi'],
  description: 'Kustomisasi tampilan dan perilaku bot (20 tipe menu, 15 tema, 7 bahasa)',

  execute: async (sock, msg, args, config, ctx = {}) => {
    const jid       = msg.key.remoteJid;
    const safeSend  = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));
    const userId    = extractSenderNumber(msg);
    const webAuth   = getWebAuth();
    const session   = webAuth.getSession(userId);
    const isOwner   = isOwnerMsg(msg, config.ownerNumber || process.env.OWNER_NUMBER);
    const isPro     = isOwner || ['pro','enterprise'].includes(session?.plan || 'free');
    const customize = getBotCustomization();
    const sub       = (args[0] || 'status').toLowerCase();

    // ─── status ───────────────────────────────────────────────────────────
    if (sub === 'status' || sub === 'info') {
      await safeSend(jid, { text: customize.renderStatus() });
      return;
    }

    // ─── Pro gate ─────────────────────────────────────────────────────────
    if (!isPro) {
      await safeSend(jid, {
        text:
          `⭐ *Fitur Premium*\n\n` +
          `Customisasi bot hanya untuk plan *Pro* dan *Enterprise*.\n\n` +
          `Upgrade di Web Panel → Upgrade Plan\nAtau ketik *!topup* untuk isi token.`
      });
      return;
    }

    // ─── theme ────────────────────────────────────────────────────────────
    if (sub === 'theme' || sub === 'tema') {
      const theme = args[1];
      if (!theme) {
        const list = THEMES.map((t, i) => `${i + 1}. \`${t}\` — ${THEME_DESC[t]}`).join('\n');
        await safeSend(jid, {
          text:
            `🎨 *Pilih Tema (${THEMES.length} tersedia):*\n\n${list}\n\n` +
            `Sekarang: *${customize.get('menu', 'theme')}*\n\nUbah: \`!customize theme <nama>\``
        });
        return;
      }
      if (!THEMES.includes(theme)) {
        await safeSend(jid, { text: `❌ Tema tidak valid.\n\nPilihan: ${THEMES.join(', ')}\n\nCek daftar: \`!customize theme\`` });
        return;
      }
      customize.set('menu', 'theme', theme);
      await safeSend(jid, { text: `✅ Tema bot → *${theme}* (${THEME_DESC[theme]})\n\nKetik !menu untuk melihat hasilnya.` });
      return;
    }

    // ─── name ─────────────────────────────────────────────────────────────
    if (sub === 'name' || sub === 'nama') {
      const newName = args.slice(1).join(' ');
      if (!newName) {
        await safeSend(jid, { text: `Nama bot sekarang: *${customize.getBotName()}*\n\nUbah: \`!customize name <nama baru>\`` });
        return;
      }
      if (newName.length > 50) { await safeSend(jid, { text: '❌ Nama maksimal 50 karakter.' }); return; }
      customize.set('identity', 'botName', newName);
      await safeSend(jid, { text: `✅ Nama bot → *${newName}*` });
      return;
    }

    // ─── owner ────────────────────────────────────────────────────────────
    if (sub === 'owner') {
      const newOwner = args.slice(1).join(' ');
      if (!newOwner) {
        await safeSend(jid, { text: `Owner sekarang: *${customize.get('identity', 'ownerName')}*\n\nUbah: \`!customize owner <nama>\`` });
        return;
      }
      customize.set('identity', 'ownerName', newOwner);
      await safeSend(jid, { text: `✅ Nama owner → *${newOwner}*` });
      return;
    }

    // ─── language ─────────────────────────────────────────────────────────
    if (sub === 'lang' || sub === 'language' || sub === 'bahasa') {
      const lang = args[1];
      if (!lang) {
        const list = LANGS.map((l, i) => `${i + 1}. \`${l}\` — ${LANG_NAME[l]}`).join('\n');
        await safeSend(jid, {
          text:
            `🌍 *Bahasa (${LANGS.length} tersedia):*\n\n${list}\n\n` +
            `Sekarang: *${customize.getLanguage()}* (${LANG_NAME[customize.getLanguage()]})\n\n` +
            `Ubah: \`!customize lang <kode>\`\nContoh: \`!customize lang en\``
        });
        return;
      }
      if (!LANGS.includes(lang)) {
        await safeSend(jid, { text: `❌ Bahasa valid: ${LANGS.join(', ')}\n\nCek daftar: \`!customize lang\`` });
        return;
      }
      customize.set('menu', 'language', lang);
      await safeSend(jid, { text: `✅ Bahasa → *${LANG_NAME[lang]}*` });
      return;
    }

    // ─── menu type ────────────────────────────────────────────────────────
    if (sub === 'menu' || sub === 'tipe') {
      const menuType = args[1];
      if (!menuType) {
        const list = MENU_TYPES.map((t, i) => `${i + 1}. \`${t}\` — ${MENU_DESC[t]}`).join('\n');
        await safeSend(jid, {
          text:
            `📋 *Tipe Menu (${MENU_TYPES.length} tersedia):*\n\n${list}\n\n` +
            `Sekarang: *${customize.get('menu', 'type')}*\n\n` +
            `Ubah: \`!customize menu <tipe>\`\nContoh: \`!customize menu hybrid\``
        });
        return;
      }
      if (!MENU_TYPES.includes(menuType)) {
        await safeSend(jid, { text: `❌ Tipe menu tidak valid.\n\nCek daftar: \`!customize menu\`` });
        return;
      }
      customize.set('menu', 'type', menuType);
      await safeSend(jid, {
        text: `✅ Tipe menu → *${menuType}*\n📖 ${MENU_DESC[menuType]}\n\nKetik \`!menu\` untuk melihat hasilnya.`
      });
      return;
    }

    // ─── personality ──────────────────────────────────────────────────────
    if (sub === 'personality' || sub === 'persona') {
      const p = args[1];
      if (!p) {
        const list = PERSONAS.map((px, i) => `${i + 1}. \`${px}\` — ${PERSONA_DESC[px]}`).join('\n');
        await safeSend(jid, {
          text:
            `🎭 *Personality (${PERSONAS.length} tersedia):*\n\n${list}\n\n` +
            `Sekarang: *${customize.get('menu', 'personality')}*\n\n` +
            `Ubah: \`!customize personality <nama>\``
        });
        return;
      }
      if (!PERSONAS.includes(p)) {
        await safeSend(jid, { text: `❌ Personality valid: ${PERSONAS.join(', ')}` });
        return;
      }
      customize.set('menu', 'personality', p);
      customize.set('ai', 'personality', p);
      if (p === 'custom') {
        const customText = args.slice(2).join(' ');
        if (customText) customize.set('menu', 'customPersonalityText', customText);
        await safeSend(jid, {
          text:
            `✅ Personality → *custom*\n\n` +
            `Set teks greeting: \`!customize personality custom <teks greeting kamu>\`\n` +
            `Contoh: \`!customize personality custom Selamat datang kak! Ada yang bisa dibantu?\``
        });
      } else {
        await safeSend(jid, { text: `✅ Personality → *${p}* (${PERSONA_DESC[p]})` });
      }
      return;
    }

    // ─── thumbnail ────────────────────────────────────────────────────────
    if (sub === 'thumbnail' || sub === 'thumb') {
      const action = args[1] || '';
      const val    = args.slice(2).join(' ');
      if (!action) {
        const th = customize.getThumbnail();
        await safeSend(jid, {
          text:
            `🖼️ *Thumbnail Settings:*\n\n` +
            `Enabled: ${th.enabled ? '✅ Ya' : '❌ Tidak'}\n` +
            `Type: ${th.type || 'none'}\n` +
            `URL: ${th.url || '-'}\n` +
            `Caption: ${th.caption || '-'}\n\n` +
            `Command:\n` +
            `\`!customize thumbnail on\` — Aktifkan\n` +
            `\`!customize thumbnail off\` — Nonaktifkan\n` +
            `\`!customize thumbnail url <url>\` — Set URL gambar\n` +
            `\`!customize thumbnail caption <teks>\` — Set caption`
        });
        return;
      }
      if (action === 'on')  { customize.set('thumbnail', 'enabled', true);  await safeSend(jid, { text: '✅ Thumbnail diaktifkan' }); return; }
      if (action === 'off') { customize.set('thumbnail', 'enabled', false); await safeSend(jid, { text: '✅ Thumbnail dinonaktifkan' }); return; }
      if (action === 'url' && val) {
        customize.set('thumbnail', 'url', val);
        customize.set('thumbnail', 'type', 'url');
        customize.set('thumbnail', 'enabled', true);
        await safeSend(jid, { text: `✅ Thumbnail URL → ${val}\n\nThumbnail akan muncul di tipe menu *Media*.` });
        return;
      }
      if (action === 'caption' && val) {
        customize.set('thumbnail', 'caption', val);
        await safeSend(jid, { text: `✅ Caption thumbnail → ${val}` });
        return;
      }
      await safeSend(jid, { text: '❌ Format: `!customize thumbnail <on|off|url|caption> [nilai]`' });
      return;
    }

    // ─── footer ───────────────────────────────────────────────────────────
    if (sub === 'footer') {
      const newFooter = args.slice(1).join(' ');
      if (!newFooter) {
        await safeSend(jid, { text: `Footer sekarang: ${customize.get('menu', 'footer') || 'Default'}\n\nUbah: \`!customize footer <teks>\`` });
        return;
      }
      customize.set('menu', 'footer', newFooter);
      await safeSend(jid, { text: `✅ Footer → ${newFooter}` });
      return;
    }

    // ─── watermark ────────────────────────────────────────────────────────
    if (sub === 'watermark') {
      const val = args.slice(1).join(' ');
      if (!val) {
        await safeSend(jid, { text: `Watermark sekarang: ${customize.get('identity', 'watermark')}\n\nUbah: \`!customize watermark <teks>\`` });
        return;
      }
      customize.set('identity', 'watermark', val);
      await safeSend(jid, { text: `✅ Watermark → ${val}` });
      return;
    }

    // ─── ai ───────────────────────────────────────────────────────────────
    if (sub === 'ai') {
      const field = args[1];
      const val   = args[2];
      const aiCfg = customize.get('ai');
      if (!field || !val) {
        await safeSend(jid, {
          text:
            `*⚡ AI Settings:*\n\n` +
            `Primary: *${aiCfg.primary}*\nSecondary: *${aiCfg.secondary}*\nFallback: *${aiCfg.fallback}*\n\n` +
            `Ubah: \`!customize ai primary <chatgpt|gemini|grok>\``
        });
        return;
      }
      if (!['primary','secondary','fallback'].includes(field)) { await safeSend(jid, { text: '❌ Field valid: primary, secondary, fallback' }); return; }
      if (!['chatgpt','gemini','grok'].includes(val)) { await safeSend(jid, { text: '❌ Provider valid: chatgpt, gemini, grok' }); return; }
      customize.set('ai', field, val);
      await safeSend(jid, { text: `✅ AI ${field} → *${val}*` });
      return;
    }

    // ─── github ───────────────────────────────────────────────────────────
    if (sub === 'github') {
      const repo = args[1];
      if (!repo) {
        const cur = customize.getGithubRepo();
        await safeSend(jid, { text: `GitHub Repo: ${cur || 'Belum diset'}\n\nUbah: \`!customize github <URL>\`` });
        return;
      }
      if (!repo.startsWith('http') && !repo.startsWith('git@')) {
        await safeSend(jid, { text: '❌ Format: https://github.com/user/repo' });
        return;
      }
      customize.set('advanced', 'githubRepo', repo);
      await safeSend(jid, { text: `✅ GitHub repo → *${repo}*\n\nGunakan \`!update run\` untuk auto-pull.` });
      return;
    }

    // ─── message ──────────────────────────────────────────────────────────
    if (sub === 'msg' || sub === 'message' || sub === 'pesan') {
      const key  = args[1];
      const val  = args.slice(2).join(' ');
      const msgs = customize.get('messages');
      if (!key) {
        const keys = Object.keys(msgs).map((k, i) => `${i + 1}. \`${k}\`: ${String(msgs[k]).slice(0, 45)}...`).join('\n');
        await safeSend(jid, {
          text: `*💬 Custom Messages:*\n\n${keys}\n\nUbah: \`!customize msg <key> <teks>\`\nVariabel: {botName}, {ownerName}`
        });
        return;
      }
      if (!msgs[key]) { await safeSend(jid, { text: `❌ Key tidak valid. Tersedia: ${Object.keys(msgs).join(', ')}` }); return; }
      if (!val) { await safeSend(jid, { text: `*${key}*: ${msgs[key]}\n\nUbah: \`!customize msg ${key} <teks baru>\`` }); return; }
      customize.set('messages', key, val);
      await safeSend(jid, { text: `✅ Pesan *${key}* → ${val}` });
      return;
    }

    // ─── set (generic) ────────────────────────────────────────────────────
    if (sub === 'set') {
      const dotKey = args[1];
      const val    = args.slice(2).join(' ');
      if (!dotKey || !val) {
        await safeSend(jid, {
          text:
            `Format: \`!customize set <section>.<key> <value>\`\n\n` +
            `Contoh:\n\`!customize set identity.ownerName Budi\`\n` +
            `\`!customize set menu.pageSize 10\`\n` +
            `\`!customize set advanced.githubRepo https://github.com/user/repo\`\n\n` +
            `Section tersedia: ${Object.keys(DEFAULT_CONFIG).join(', ')}`
        });
        return;
      }
      const [section, key] = dotKey.split('.');
      if (!section || !key) { await safeSend(jid, { text: '❌ Format: section.key (contoh: identity.botName)' }); return; }
      const current = customize.get(section);
      if (!current && current !== false) {
        await safeSend(jid, { text: `❌ Section tidak valid: ${section}. Tersedia: ${Object.keys(DEFAULT_CONFIG).join(', ')}` });
        return;
      }
      // Auto-convert type
      let finalVal = val;
      if (val === 'true')  finalVal = true;
      if (val === 'false') finalVal = false;
      if (!isNaN(val) && val.trim() !== '') finalVal = Number(val);
      customize.set(section, key, finalVal);
      await safeSend(jid, { text: `✅ ${section}.${key} → *${finalVal}*` });
      return;
    }

    // ─── reset ────────────────────────────────────────────────────────────
    if (sub === 'reset' && isOwner) {
      if (args[1] !== 'confirm') {
        await safeSend(jid, { text: '⚠️ Reset SEMUA kustomisasi ke default!\n\nKonfirmasi: `!customize reset confirm`' });
        return;
      }
      const fs   = require('fs');
      const path = require('path');
      const file = path.join(__dirname, '../tmp/bot_config.json');
      try { fs.unlinkSync(file); } catch (_) {}
      const inst = getBotCustomization();
      inst.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      inst.save();
      await safeSend(jid, { text: '✅ Kustomisasi direset ke default.' });
      return;
    }

    // ─── help ─────────────────────────────────────────────────────────────
    await safeSend(jid, {
      text:
        `*🎨 !customize v2.0 — Kustomisasi Bot*\n\n` +
        `\`!customize status\` — Lihat semua pengaturan\n` +
        `\`!customize name <nama>\` — Ubah nama bot\n` +
        `\`!customize owner <nama>\` — Ubah nama owner\n` +
        `\`!customize theme [nama]\` — Tema menu (${THEMES.length} tersedia)\n` +
        `\`!customize lang [kode]\` — Bahasa (${LANGS.length} tersedia)\n` +
        `\`!customize menu [tipe]\` — Tipe menu (${MENU_TYPES.length} tersedia)\n` +
        `\`!customize personality [nama]\` — Personality bot\n` +
        `\`!customize thumbnail\` — Settings thumbnail/media\n` +
        `\`!customize footer <teks>\` — Footer menu\n` +
        `\`!customize watermark <teks>\` — Watermark bot\n` +
        `\`!customize ai primary <provider>\` — AI provider\n` +
        `\`!customize github <url>\` — Set GitHub repo\n` +
        `\`!customize msg [key] [teks]\` — Custom pesan\n` +
        `\`!customize set <section.key> <value>\` — Set apapun\n` +
        `\`!customize reset confirm\` — Reset ke default (Owner only)\n\n` +
        `Tema: ${THEMES.length} tema tersedia\n` +
        `Bahasa: ${LANGS.join('|')}\n` +
        `Personality: ${PERSONAS.join('|')}\n\n` +
        `Atau kustomisasi via *Web Panel → Customize Bot*`
    });
  }
};
