/**
 * DLavie OS — !menu command v3.0
 * 20 Menu Types: text|number|hybrid|search|dashboard|quickaction|rolebased|
 *   pagination|recent|favorite|smart|contextual|cmdpalette|wizard|media|card|
 *   compact|full|aiguided|terminal
 * 15 Themes | 7 Languages | Personality | Thumbnail Support
 * Universal iOS & Android compatible (text fallback always available)
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { getWebAuth }         = require('../src/auth/webAuth');
const { getEngine }          = require('../src/core/engine');
const { getBotCustomization, LANGS } = require('../src/core/botCustomization');
const { extractSenderNumber, isOwnerMsg } = require('../src/utils/ownerUtils');

const HISTORY_FILE   = path.join(__dirname, '../tmp/menu_history.json');
const FAVORITES_FILE = path.join(__dirname, '../tmp/menu_favorites.json');
const WIZARD_FILE    = path.join(__dirname, '../tmp/menu_wizard.json');

function ensureDir(f) {
  const d = path.dirname(f);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function loadJson(file, def = {}) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) {}
  return typeof def === 'function' ? def() : def;
}
function saveJson(file, data) {
  try { ensureDir(file); fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch (_) {}
}

function recordHistory(userId, cmdName) {
  const h = loadJson(HISTORY_FILE, {});
  if (!h[userId]) h[userId] = [];
  h[userId] = [cmdName, ...h[userId].filter(x => x !== cmdName)].slice(0, 10);
  saveJson(HISTORY_FILE, h);
}

function getHistory(userId) {
  return (loadJson(HISTORY_FILE, {})[userId] || []).slice(0, 5);
}

function getFavorites(userId) {
  return loadJson(FAVORITES_FILE, {})[userId] || [];
}

function setFavorite(userId, cmdName, add = true) {
  const f = loadJson(FAVORITES_FILE, {});
  if (!f[userId]) f[userId] = [];
  if (add) { if (!f[userId].includes(cmdName)) f[userId].unshift(cmdName); f[userId] = f[userId].slice(0, 10); }
  else { f[userId] = f[userId].filter(x => x !== cmdName); }
  saveJson(FAVORITES_FILE, f);
}

// ─── Theme Header Builder ───────────────────────────────────────────────────
function buildHeader(c) {
  const name  = c.identity?.botName   || 'DLavie OS';
  const brand = c.identity?.brandName || 'Multi-Bot Control';
  const theme = c.menu?.theme         || 'dlavie_default';

  switch (theme) {
    case 'minimal':     return `*${name}*\n${brand}`;
    case 'modern':      return `┌──────────────────────────┐\n│ ⚡ *${name}*\n│ ${brand}\n└──────────────────────────┘`;
    case 'premium':     return `╭─ ⋆ 💎 *${name}* 💎 ⋆\n│ ${brand}\n╰───────────────────────────`;
    case 'gaming':      return `🎮 ≪≪ *${name}* ≫≫ 🎮\n▸ ${brand}`;
    case 'cyberpunk':   return `▣ *${name}*\n↳ ${brand}\n↳ SYSTEM/ONLINE`;
    case 'neon':        return `✦ ◈ *${name}* ◈ ✦\n◈ ${brand} ◈`;
    case 'dark_knight': return `🦇 ██ *${name}* ██ 🦇\n▓ ${brand} ▓`;
    case 'sakura':      return `🌸 ～ *${name}* ～ 🌸\n✿ ${brand} ✿`;
    case 'ocean':       return `🌊 ≋≋ *${name}* ≋≋ 🌊\n〜 ${brand} 〜`;
    case 'fire':        return `🔥 ▲▲ *${name}* ▲▲ 🔥\n▲ ${brand} ▲`;
    case 'matrix':      return `⟦ *${name}* ⟧\n⟦ ${brand} ⟧`;
    case 'hacker':      return `$ _${name}_\n> ${brand}\n> STATUS: ONLINE`;
    case 'royal':       return `👑 ♚ *${name}* ♚ 👑\n♜ ${brand} ♜`;
    case 'space':       return `🚀 ✦ *${name}* ✦ 🚀\n✦ ${brand} ✦`;
    default:
      return `╔══════════════════════════════╗\n║   ⚡  *${name}*  ⚡\n║  ${brand}\n╚══════════════════════════════╝`;
  }
}

// ─── Personality Greeting ───────────────────────────────────────────────────
function personalityGreeting(c, displayName) {
  const p = c.menu?.personality || 'friendly';
  const n = displayName.split('—')[0].trim();
  switch (p) {
    case 'professional': return `Selamat datang, ${n}. Silakan pilih layanan yang Anda butuhkan.`;
    case 'ai_assistant': return `🤖 Sistem online. User: ${n} teridentifikasi. Memuat command list...`;
    case 'funny':        return `Halo ${n}! 😂 Kamu kesini lagi? Aku kangen! 🥺 Yuk, mau ngapain hari ini?`;
    case 'savage':       return `Oh, ${n} dateng. Akhirnya. Nggak nyasar kan? 😏`;
    case 'kawaii':       return `Kyaa~ ${n}-chan datang! (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧ Halo halo~! 🌸`;
    case 'custom':       return c.menu?.customPersonalityText || `Halo, ${n}!`;
    default:             return `Halo ${n}! 😊 Ada yang bisa dibantu?`;
  }
}

// ─── Separator based on theme ───────────────────────────────────────────────
function sep(c) {
  const t = c.menu?.theme || 'dlavie_default';
  if (['matrix','hacker'].includes(t))  return '─────────────────────────';
  if (['gaming','cyberpunk','neon'].includes(t)) return '━━━━━━━━━━━━━━━━━━━━━━━━';
  if (['sakura','ocean'].includes(t))   return '〜〜〜〜〜〜〜〜〜〜〜〜〜';
  if (['royal','premium'].includes(t))  return '═══════════════════════════';
  return '━━━━━━━━━━━━━━━━━━━━━━━━';
}

// ─── Language helper ─────────────────────────────────────────────────────────
function L(c) {
  const lang = c.menu?.language || 'id';
  return LANGS[lang] || LANGS['id'];
}

// ─── All commands data ───────────────────────────────────────────────────────
function allCmds(prefix, isOwner, isAdmin, c) {
  const l = L(c);
  return {
    auth: [
      { cmd: `${prefix}login KODE`, label: 'Login',  desc: 'Login dengan kode dari web' },
      { cmd: `${prefix}logout`,     label: 'Logout', desc: 'Logout dari DLavie OS' },
    ],
    bot: [
      { cmd: `${prefix}connect`,  label: 'Connect',  desc: 'Hubungkan bot ke DLavie OS' },
      { cmd: `${prefix}relay`,    label: 'Relay',    desc: 'Kirim command ke bot terhubung' },
      { cmd: `${prefix}monitor`,  label: 'Monitor',  desc: 'Monitor semua bot & sistem' },
      { cmd: `${prefix}bot`,      label: 'Bot',      desc: 'Multi-bot control panel' },
    ],
    features: [
      { cmd: `${prefix}shell`,    label: 'Shell',    desc: 'Eksekusi shell command' },
      { cmd: `${prefix}plugin`,   label: 'Plugin',   desc: 'Plugin marketplace & install' },
      { cmd: `${prefix}fix`,      label: 'Fix',      desc: 'AI-powered auto-fix error' },
      { cmd: `${prefix}schedule`, label: 'Schedule', desc: 'Kelola scheduled tasks' },
      { cmd: `${prefix}token`,    label: 'Token',    desc: 'Cek & kelola token' },
      { cmd: `${prefix}customize`,label: 'Customize',desc: 'Kustomisasi tampilan bot' },
    ],
    info: [
      { cmd: `${prefix}status`, label: 'Status', desc: 'Status sistem DLavie OS' },
      { cmd: `${prefix}info`,   label: 'Info',   desc: 'Info bot & server' },
      { cmd: `${prefix}ping`,   label: 'Ping',   desc: 'Cek koneksi bot' },
    ],
    ...(isOwner || isAdmin ? {
      admin: [
        { cmd: `${prefix}owner`,     label: 'Owner',     desc: 'Panel kontrol owner' },
        { cmd: `${prefix}approve`,   label: 'Approve',   desc: 'Approve top-up / plan' },
        { cmd: `${prefix}reject`,    label: 'Reject',    desc: 'Reject pembayaran' },
        { cmd: `${prefix}user`,      label: 'User',      desc: 'Kelola user & RBAC' },
        { cmd: `${prefix}broadcast`, label: 'Broadcast', desc: 'Broadcast ke semua user' },
        { cmd: `${prefix}audit`,     label: 'Audit',     desc: 'Audit log aktivitas' },
        { cmd: `${prefix}lockdown`,  label: 'Lockdown',  desc: 'Emergency lockdown' },
        { cmd: `${prefix}popup`,     label: 'Popup',     desc: 'Kirim notifikasi' },
        { cmd: `${prefix}stealth`,   label: 'Stealth',   desc: 'Stealth mode' },
        { cmd: `${prefix}config`,    label: 'Config',    desc: 'Lihat konfigurasi' },
      ],
    } : {}),
  };
}

function flatCmds(cats) {
  return Object.values(cats).flat();
}

// ─── User info block ─────────────────────────────────────────────────────────
function infoBlock(displayName, plan, balance, isQueue, c) {
  const l = L(c);
  return (
    `👤 *${displayName}*\n` +
    `📦 Plan: *${plan}*  🪙 Token: *${balance}*\n` +
    (isQueue
      ? `⏳ Mode antrian aktif — Upgrade ke Pro untuk priority!\n`
      : `⚡ Priority Access — NO queue!\n`)
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────
function footer(c, config) {
  return c.menu?.footer || c.identity?.watermark || `DLavie OS v${config?.bot?.version || '2.0.0'} • Anti-Ban Active`;
}

// ════════════════════════════════════════════════════════════════════════════
// MENU TYPE 1: TEXT — flat text, paling stabil untuk semua device
// ════════════════════════════════════════════════════════════════════════════
function menuText(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config) {
  const cats = allCmds(prefix, isOwner, isAdmin, c);
  const all  = flatCmds(cats).map(x => `\`${x.cmd}\``).join('  ');
  return {
    text:
      `${buildHeader(c)}\n\n` +
      `${personalityGreeting(c, displayName)}\n\n` +
      infoBlock(displayName, plan, balance, isQueue, c) +
      `\n${sep(c)}\n📋 *${L(c).commands}*\n${sep(c)}\n\n` +
      all +
      `\n\n💡 Tips: Ketik command di atas langsung\n` +
      `🌐 ${c.identity?.websiteUrl || 'Buka web DLavie OS'}\n` +
      `\n${footer(c, config)}`
  };
}

// ════════════════════════════════════════════════════════════════════════════
// MENU TYPE 2: NUMBER — user pilih angka
// ════════════════════════════════════════════════════════════════════════════
function menuNumber(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config) {
  const all = flatCmds(allCmds(prefix, isOwner, isAdmin, c));
  const lines = all.map((x, i) => `${i + 1}. ${x.label} — ${x.desc}`).join('\n');
  return {
    text:
      `${buildHeader(c)}\n\n` +
      `${personalityGreeting(c, displayName)}\n\n` +
      infoBlock(displayName, plan, balance, isQueue, c) +
      `\n${sep(c)}\n📋 *${L(c).commands}*\n${sep(c)}\n\n` +
      lines +
      `\n\n💡 Ketik command langsung, contoh: \`${prefix}status\`\n` +
      `\n${footer(c, config)}`
  };
}

// ════════════════════════════════════════════════════════════════════════════
// MENU TYPE 3: HYBRID — categories + shortcuts (default)
// ════════════════════════════════════════════════════════════════════════════
function menuHybrid(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config) {
  const cats = allCmds(prefix, isOwner, isAdmin, c);
  const l    = L(c);
  let text =
    `${buildHeader(c)}\n\n` +
    `${personalityGreeting(c, displayName)}\n\n` +
    infoBlock(displayName, plan, balance, isQueue, c) + '\n' +
    `${sep(c)}\n🔑 *Autentikasi*\n${sep(c)}\n` +
    cats.auth.map(x => `\`${x.cmd}\` — ${x.desc}`).join('\n') + '\n\n' +
    `${sep(c)}\n🤖 *Bot Management*\n${sep(c)}\n` +
    cats.bot.map(x => `\`${x.cmd}\` — ${x.desc}`).join('\n') + '\n\n' +
    `${sep(c)}\n⚙️ *Fitur Utama*\n${sep(c)}\n` +
    cats.features.map(x => `\`${x.cmd}\` — ${x.desc}`).join('\n') + '\n\n' +
    `${sep(c)}\n📊 *Info & Status*\n${sep(c)}\n` +
    cats.info.map(x => `\`${x.cmd}\` — ${x.desc}`).join('\n');

  if (cats.admin) {
    text += `\n\n${sep(c)}\n👑 *Owner / Admin*\n${sep(c)}\n` +
      cats.admin.map(x => `\`${x.cmd}\` — ${x.desc}`).join('\n');
  }

  text +=
    `\n\n${sep(c)}\n💡 *Tips*\n` +
    `• Token refill otomatis tiap 10 menit\n` +
    `• \`${prefix}customize\` untuk ubah tampilan menu ini\n` +
    `\n🌐 ${c.identity?.websiteUrl || 'Buka web DLavie OS'}\n${footer(c, config)}`;

  return { text };
}

// ════════════════════════════════════════════════════════════════════════════
// MENU TYPE 4: SEARCH — filter command
// ════════════════════════════════════════════════════════════════════════════
function menuSearch(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, query = '') {
  const all = flatCmds(allCmds(prefix, isOwner, isAdmin, c));
  if (!query) {
    return {
      text:
        `${buildHeader(c)}\n\n` +
        `🔍 *Search Menu*\n\nCari command: \`${prefix}menu search <kata>\`\nContoh: \`${prefix}menu search status\`\n\n` +
        infoBlock(displayName, plan, balance, isQueue, c) +
        `\n${footer(c, config)}`
    };
  }
  const q       = query.toLowerCase();
  const results = all.filter(x => x.label.toLowerCase().includes(q) || x.desc.toLowerCase().includes(q) || x.cmd.toLowerCase().includes(q));
  if (!results.length) {
    return { text: `${buildHeader(c)}\n\n🔍 Tidak ada command yang cocok dengan "*${query}*"\n\nCoba: \`${prefix}menu search status\`` };
  }
  return {
    text:
      `${buildHeader(c)}\n\n🔍 *Hasil pencarian: "${query}"* (${results.length} ditemukan)\n\n` +
      results.map(x => `\`${x.cmd}\` — ${x.desc}`).join('\n') +
      `\n\n${footer(c, config)}`
  };
}

// ════════════════════════════════════════════════════════════════════════════
// MENU TYPE 5: DASHBOARD — menu + status bot real-time
// ════════════════════════════════════════════════════════════════════════════
async function menuDashboard(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, engine) {
  let sysInfo = '';
  try {
    const health = engine?.getSystem?.('health');
    const st     = health?.getStatus?.() || {};
    const mem    = process.memoryUsage();
    const memMB  = Math.round(mem.heapUsed / 1024 / 1024);
    const upSec  = Math.round(process.uptime());
    const h = Math.floor(upSec / 3600), m = Math.floor((upSec % 3600) / 60), s = upSec % 60;
    sysInfo =
      `\n${sep(c)}\n📊 *System Dashboard*\n${sep(c)}\n` +
      `🟢 Uptime: ${h}h ${m}m ${s}s\n` +
      `💾 Memory: ${memMB} MB\n` +
      `📡 WA Status: ${st.waStatus || 'connected'}\n` +
      `🔧 Auto-Fix: Ready\n` +
      `🪙 Token Kamu: ${balance}\n`;
  } catch (_) {
    sysInfo = `\n${sep(c)}\n📊 System: Online\n`;
  }

  const cats = allCmds(prefix, isOwner, isAdmin, c);
  return {
    text:
      `${buildHeader(c)}\n\n` +
      `${personalityGreeting(c, displayName)}\n\n` +
      infoBlock(displayName, plan, balance, isQueue, c) +
      sysInfo +
      `\n${sep(c)}\n⚡ *Quick Commands*\n${sep(c)}\n` +
      [...cats.info, ...cats.bot.slice(0, 3)].map(x => `\`${x.cmd}\` — ${x.desc}`).join('\n') +
      `\n\n🌐 ${c.identity?.websiteUrl || 'Buka web DLavie OS'}\n${footer(c, config)}`
  };
}

// ════════════════════════════════════════════════════════════════════════════
// MENU TYPE 6: QUICK ACTION — command penting saja
// ════════════════════════════════════════════════════════════════════════════
function menuQuickAction(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config) {
  const quick = [
    `\`${prefix}status\`   — Cek status bot`,
    `\`${prefix}connect\`  — Hubungkan bot baru`,
    `\`${prefix}relay\`    — Kontrol bot terhubung`,
    `\`${prefix}fix\`      — Auto-fix error`,
    `\`${prefix}plugin\`   — Kelola plugin`,
    `\`${prefix}token\`    — Cek token`,
    `\`${prefix}monitor\`  — Monitor sistem`,
    ...(isOwner ? [`\`${prefix}owner\`    — Owner panel`, `\`${prefix}broadcast\` — Broadcast`] : []),
  ];
  return {
    text:
      `${buildHeader(c)}\n\n` +
      `⚡ *${L(c).quickAction}*\n\n` +
      infoBlock(displayName, plan, balance, isQueue, c) + '\n' +
      quick.join('\n') +
      `\n\n💡 Full menu: \`${prefix}menu\`\n${footer(c, config)}`
  };
}

// ════════════════════════════════════════════════════════════════════════════
// MENU TYPE 7: ROLE-BASED — menu berbeda per role
// ════════════════════════════════════════════════════════════════════════════
function menuRoleBased(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config) {
  let roleSection = '';
  let roleTitle   = '👤 User';

  if (isOwner) {
    roleTitle = '👑 Owner';
    roleSection =
      `${sep(c)}\n👑 *Owner Panel*\n${sep(c)}\n` +
      `\`${prefix}owner\`      — Panel owner lengkap\n` +
      `\`${prefix}approve\`    — Approve payment\n` +
      `\`${prefix}broadcast\`  — Broadcast ke semua\n` +
      `\`${prefix}lockdown\`   — Emergency lockdown\n` +
      `\`${prefix}audit\`      — Audit log\n` +
      `\`${prefix}user\`       — Manajemen user\n` +
      `\`${prefix}config\`     — System config\n` +
      `\`${prefix}shell\`      — Shell access\n` +
      `\`${prefix}terminal\`   — Terminal mode`;
  } else if (isAdmin) {
    roleTitle = '⚙️ Admin';
    roleSection =
      `${sep(c)}\n⚙️ *Admin Panel*\n${sep(c)}\n` +
      `\`${prefix}approve\`    — Approve payment\n` +
      `\`${prefix}broadcast\`  — Broadcast\n` +
      `\`${prefix}audit\`      — Audit log\n` +
      `\`${prefix}user\`       — Kelola user`;
  } else {
    roleTitle = plan === 'FREE' ? '🆓 Free User' : `⭐ ${plan} User`;
    roleSection =
      `${sep(c)}\n🌟 *Fitur Kamu (${plan})*\n${sep(c)}\n` +
      `\`${prefix}connect\`    — Hubungkan bot\n` +
      `\`${prefix}relay\`      — Kontrol bot\n` +
      `\`${prefix}plugin\`     — Plugin\n` +
      `\`${prefix}token\`      — Token & topup\n` +
      (plan === 'FREE' ? `\n⬆️ Upgrade ke Pro untuk akses penuh!` : '');
  }

  return {
    text:
      `${buildHeader(c)}\n\n` +
      `${personalityGreeting(c, displayName)}\n\n` +
      infoBlock(displayName, plan, balance, isQueue, c) +
      `\n🎭 Role: *${roleTitle}*\n\n` +
      roleSection +
      `\n\n${sep(c)}\n📋 *Command Umum*\n${sep(c)}\n` +
      `\`${prefix}status\` \`${prefix}info\` \`${prefix}ping\` \`${prefix}fix\`\n` +
      `\n${footer(c, config)}`
  };
}

// ════════════════════════════════════════════════════════════════════════════
// MENU TYPE 8: PAGINATION — halaman menu
// ════════════════════════════════════════════════════════════════════════════
function menuPagination(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, page = 1) {
  const all      = flatCmds(allCmds(prefix, isOwner, isAdmin, c));
  const pageSize = c.menu?.pageSize || 8;
  const totalPages = Math.ceil(all.length / pageSize);
  const pg       = Math.max(1, Math.min(page, totalPages));
  const slice    = all.slice((pg - 1) * pageSize, pg * pageSize);

  return {
    text:
      `${buildHeader(c)}\n\n` +
      infoBlock(displayName, plan, balance, isQueue, c) +
      `\n${sep(c)}\n📋 *Menu — Halaman ${pg}/${totalPages}*\n${sep(c)}\n\n` +
      slice.map((x, i) => `${(pg - 1) * pageSize + i + 1}. \`${x.cmd}\` — ${x.desc}`).join('\n') +
      `\n\n` +
      (pg > 1 ? `◀ Prev: \`${prefix}menu ${pg - 1}\`  ` : '') +
      (pg < totalPages ? `▶ Next: \`${prefix}menu ${pg + 1}\`` : '') +
      `\n\n${footer(c, config)}`
  };
}

// ════════════════════════════════════════════════════════════════════════════
// MENU TYPE 9: RECENT — command terakhir dipakai
// ════════════════════════════════════════════════════════════════════════════
function menuRecent(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, userId) {
  const history = getHistory(userId);
  const allList = flatCmds(allCmds(prefix, isOwner, isAdmin, c));
  const recentItems = history.length
    ? history.map(cmd => {
        const found = allList.find(x => x.label.toLowerCase() === cmd.toLowerCase() || x.cmd.includes(cmd));
        return found ? `\`${found.cmd}\` — ${found.desc}` : `\`${prefix}${cmd}\``;
      })
    : ['Belum ada riwayat command.'];

  return {
    text:
      `${buildHeader(c)}\n\n` +
      `🕐 *${L(c).recent}*\n\n` +
      infoBlock(displayName, plan, balance, isQueue, c) + '\n' +
      recentItems.join('\n') +
      `\n\n${sep(c)}\n💡 Full menu: \`${prefix}menu\`\n${footer(c, config)}`
  };
}

// ════════════════════════════════════════════════════════════════════════════
// MENU TYPE 10: FAVORITE — command yang di-pin user
// ════════════════════════════════════════════════════════════════════════════
function menuFavorite(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, userId) {
  const favs    = getFavorites(userId);
  const allList = flatCmds(allCmds(prefix, isOwner, isAdmin, c));
  const favItems = favs.length
    ? favs.map(cmd => {
        const found = allList.find(x => x.label.toLowerCase() === cmd.toLowerCase() || x.cmd.includes(cmd));
        return found ? `⭐ \`${found.cmd}\` — ${found.desc}` : `⭐ \`${prefix}${cmd}\``;
      })
    : ['Belum ada favorit.\n\n💡 Tambah: `!fav add <command>`'];

  return {
    text:
      `${buildHeader(c)}\n\n` +
      `⭐ *${L(c).favorites}*\n\n` +
      infoBlock(displayName, plan, balance, isQueue, c) + '\n' +
      favItems.join('\n') +
      `\n\n💡 Tambah: \`${prefix}fav add status\`  Hapus: \`${prefix}fav rm status\`\n${footer(c, config)}`
  };
}

// ════════════════════════════════════════════════════════════════════════════
// MENU TYPE 11: SMART — menu berubah sesuai kondisi bot
// ════════════════════════════════════════════════════════════════════════════
async function menuSmart(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, engine) {
  let smartSection = '';
  let issues = [];

  try {
    const errAgg = engine?.getSystem?.('errorAggregator');
    const errors = errAgg?.getRecent?.(3) || [];
    if (errors.length) {
      issues.push('🔴 Ada error terdeteksi');
      smartSection +=
        `${sep(c)}\n⚠️ *Error Terdeteksi — Command Disarankan*\n${sep(c)}\n` +
        `\`${prefix}fix\`       — Auto-fix error sekarang\n` +
        `\`${prefix}monitor\`   — Lihat detail error\n` +
        `\`${prefix}status\`    — Cek status sistem\n\n`;
    }
  } catch (_) {}

  if (plan === 'FREE' && !isOwner) {
    smartSection +=
      `${sep(c)}\n💡 *Rekomendasi Untuk Kamu*\n${sep(c)}\n` +
      `\`${prefix}token\`     — Cek & isi ulang token\n` +
      `\`${prefix}connect\`   — Hubungkan bot pertamamu\n` +
      `\`${prefix}plugin\`    — Eksplor plugin gratis\n\n`;
  }

  if (!smartSection) {
    smartSection =
      `${sep(c)}\n✅ *Sistem Normal — Command Populer*\n${sep(c)}\n` +
      `\`${prefix}status\`   — Status bot\n` +
      `\`${prefix}relay\`    — Kontrol bot\n` +
      `\`${prefix}plugin\`   — Plugin\n` +
      `\`${prefix}fix\`      — Auto-fix\n\n`;
  }

  return {
    text:
      `${buildHeader(c)}\n\n` +
      `🧠 *Smart Menu*\n${issues.length ? issues.join('\n') : '✅ Semua sistem normal'}\n\n` +
      infoBlock(displayName, plan, balance, isQueue, c) + '\n' +
      smartSection +
      `${sep(c)}\n💡 Full menu: \`${prefix}menu\`\n${footer(c, config)}`
  };
}

// ════════════════════════════════════════════════════════════════════════════
// MENU TYPE 12: CONTEXTUAL — grup vs private
// ════════════════════════════════════════════════════════════════════════════
function menuContextual(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, jid) {
  const isGroup = jid.endsWith('@g.us');
  const ctx     = isGroup ? '👥 Grup' : '👤 Personal';
  const cmds    = isGroup
    ? [
        `\`${prefix}relay\`     — Kontrol bot`,
        `\`${prefix}monitor\`   — Monitor grup`,
        `\`${prefix}plugin\`    — Plugin grup`,
        `\`${prefix}status\`    — Status bot`,
        ...(isOwner || isAdmin ? [`\`${prefix}broadcast\`  — Broadcast ke grup`] : []),
      ]
    : [
        `\`${prefix}login\`     — Login ke DLavie OS`,
        `\`${prefix}connect\`   — Hubungkan bot baru`,
        `\`${prefix}relay\`     — Kontrol bot kamu`,
        `\`${prefix}token\`     — Cek token & topup`,
        `\`${prefix}customize\` — Kustomisasi bot`,
        `\`${prefix}fix\`       — Auto-fix error`,
      ];

  return {
    text:
      `${buildHeader(c)}\n\n` +
      `📍 *Contextual Menu — ${ctx}*\n\n` +
      infoBlock(displayName, plan, balance, isQueue, c) + '\n' +
      cmds.join('\n') +
      `\n\n💡 Full menu: \`${prefix}menu\`\n${footer(c, config)}`
  };
}

// ════════════════════════════════════════════════════════════════════════════
// MENU TYPE 13: COMMAND PALETTE — !cmd <search> gaya VS Code
// ════════════════════════════════════════════════════════════════════════════
function menuCmdPalette(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, query = '') {
  const all = flatCmds(allCmds(prefix, isOwner, isAdmin, c));
  if (!query) {
    return {
      text:
        `${buildHeader(c)}\n\n` +
        `🎯 *Command Palette*\n\n` +
        `Cari command: \`${prefix}menu cmd <kata>\`\n` +
        `Contoh: \`${prefix}menu cmd fix\`, \`${prefix}menu cmd plugin\`\n\n` +
        infoBlock(displayName, plan, balance, isQueue, c) +
        `\n${footer(c, config)}`
    };
  }
  const q       = query.toLowerCase();
  const results = all.filter(x =>
    x.label.toLowerCase().startsWith(q) ||
    x.cmd.toLowerCase().includes(q) ||
    x.desc.toLowerCase().includes(q)
  ).slice(0, 8);

  if (!results.length) return { text: `🎯 *Command Palette*\n\nTidak ada hasil untuk "*${query}*"\n\nCoba kata lain.` };

  return {
    text:
      `🎯 *Command Palette — "${query}"*\n\n` +
      results.map((x, i) => `${i + 1}. \`${x.cmd}\`\n   ${x.desc}`).join('\n\n') +
      `\n\n${footer(c, config)}`
  };
}

// ════════════════════════════════════════════════════════════════════════════
// MENU TYPE 14: WIZARD — step-by-step setup
// ════════════════════════════════════════════════════════════════════════════
function menuWizard(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, userId, step = 0) {
  const wizardSteps = [
    { title: '1️⃣ Login ke DLavie OS',    cmd: `${prefix}login KODE`,    desc: 'Dapatkan kode dari web panel, lalu ketik command ini.' },
    { title: '2️⃣ Generate Token Bot',   cmd: `${prefix}connect generate`, desc: 'Buat token untuk menghubungkan bot kamu.' },
    { title: '3️⃣ Verifikasi Bot',        cmd: `${prefix}connect verify TOKEN`, desc: 'Di bot kamu, kirim command ini dengan token dari langkah 2.' },
    { title: '4️⃣ Cek Bot Terhubung',    cmd: `${prefix}relay list`,     desc: 'Lihat semua bot yang sudah terhubung.' },
    { title: '5️⃣ Kontrol Bot Pertama',  cmd: `${prefix}relay BOT_ID status`, desc: 'Kirim command ke bot kamu.' },
    { title: '6️⃣ Kustomisasi Tampilan', cmd: `${prefix}customize status`, desc: 'Ubah nama, tema, dan tampilan bot.' },
  ];

  const s       = Math.max(0, Math.min(step, wizardSteps.length - 1));
  const current = wizardSteps[s];
  const next    = wizardSteps[s + 1];
  const prev    = wizardSteps[s - 1];

  return {
    text:
      `${buildHeader(c)}\n\n` +
      `🧙 *Setup Wizard* — Langkah ${s + 1}/${wizardSteps.length}\n\n` +
      `${current.title}\n\n` +
      `Command:\n\`${current.cmd}\`\n\n` +
      `📖 ${current.desc}\n\n` +
      (prev ? `◀ Sebelumnya: \`${prefix}menu wizard ${s - 1}\`\n` : '') +
      (next ? `▶ Selanjutnya: \`${prefix}menu wizard ${s + 1}\` — ${next.title}` : '✅ Setup selesai! Ketik `!menu` untuk melihat semua fitur.') +
      `\n\n${footer(c, config)}`
  };
}

// ════════════════════════════════════════════════════════════════════════════
// MENU TYPE 15: MEDIA — dengan thumbnail gambar
// ════════════════════════════════════════════════════════════════════════════
async function menuMedia(sock, jid, c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, safeSend) {
  const cats   = allCmds(prefix, isOwner, isAdmin, c);
  const thumb  = c.thumbnail || {};
  const caption =
    `${buildHeader(c)}\n\n` +
    `${personalityGreeting(c, displayName)}\n\n` +
    infoBlock(displayName, plan, balance, isQueue, c) + '\n' +
    `${sep(c)}\n⚡ *Fitur Utama*\n${sep(c)}\n` +
    cats.features.map(x => `\`${x.cmd}\` — ${x.desc}`).join('\n') +
    `\n\n${sep(c)}\n🤖 *Bot Management*\n${sep(c)}\n` +
    cats.bot.slice(0, 3).map(x => `\`${x.cmd}\` — ${x.desc}`).join('\n') +
    `\n\n💡 Full: \`${prefix}menu\`\n${footer(c, config)}`;

  if (thumb.enabled && thumb.url) {
    try {
      await sock.sendMessage(jid, { image: { url: thumb.url }, caption });
      return null;
    } catch (_) {}
  }

  return { text: caption };
}

// ════════════════════════════════════════════════════════════════════════════
// MENU TYPE 16: CARD — setiap fitur seperti kartu
// ════════════════════════════════════════════════════════════════════════════
function menuCard(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config) {
  const cards = [
    { icon: '🤖', name: 'Bot Manager',   status: 'Active', access: 'All',       cmd: `${prefix}bot` },
    { icon: '📡', name: 'Relay',         status: 'Active', access: 'All',       cmd: `${prefix}relay` },
    { icon: '🔧', name: 'Auto-Fix',      status: 'Ready',  access: 'All',       cmd: `${prefix}fix` },
    { icon: '🧩', name: 'Plugin',        status: 'Active', access: 'All',       cmd: `${prefix}plugin` },
    { icon: '📊', name: 'Monitor',       status: 'Active', access: 'All',       cmd: `${prefix}monitor` },
    { icon: '🪙', name: 'Token',         status: 'Active', access: 'All',       cmd: `${prefix}token` },
    { icon: '🎨', name: 'Customize',     status: 'Active', access: 'Pro+',      cmd: `${prefix}customize` },
    ...(isOwner || isAdmin ? [
      { icon: '👑', name: 'Owner Panel', status: 'Active', access: 'Owner',     cmd: `${prefix}owner` },
      { icon: '📢', name: 'Broadcast',   status: 'Active', access: 'Admin+',    cmd: `${prefix}broadcast` },
    ] : []),
  ];

  const cardLines = cards.map(card =>
    `┌─────────────────────────\n` +
    `│ ${card.icon} *${card.name}*\n` +
    `│ Status: ${card.status} | Akses: ${card.access}\n` +
    `│ Command: \`${card.cmd}\`\n` +
    `└─────────────────────────`
  ).join('\n');

  return {
    text:
      `${buildHeader(c)}\n\n` +
      infoBlock(displayName, plan, balance, isQueue, c) + '\n' +
      cardLines +
      `\n\n${footer(c, config)}`
  };
}

// ════════════════════════════════════════════════════════════════════════════
// MENU TYPE 17: COMPACT — sangat pendek untuk akses cepat
// ════════════════════════════════════════════════════════════════════════════
function menuCompact(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config) {
  const name = c.identity?.botName || 'DLavie OS';
  return {
    text:
      `⚡ *${name}*\n` +
      `👤 ${displayName.split('—')[0].trim()} | 📦 ${plan} | 🪙 ${balance}\n\n` +
      `\`${prefix}status\` \`${prefix}connect\` \`${prefix}relay\` \`${prefix}fix\` \`${prefix}plugin\` \`${prefix}token\`\n` +
      (isOwner || isAdmin ? `\`${prefix}owner\` \`${prefix}approve\` \`${prefix}broadcast\`\n` : '') +
      `\n💡 Detail: \`${prefix}menu hybrid\`\n${footer(c, config)}`
  };
}

// ════════════════════════════════════════════════════════════════════════════
// MENU TYPE 18: FULL — semua command lengkap
// ════════════════════════════════════════════════════════════════════════════
function menuFull(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config) {
  const cats = allCmds(prefix, isOwner, isAdmin, c);
  const sections = [
    { title: '🔑 Autentikasi', items: cats.auth },
    { title: '🤖 Bot Management', items: cats.bot },
    { title: '⚙️ Fitur Utama', items: cats.features },
    { title: '📊 Info & Status', items: cats.info },
    ...(cats.admin ? [{ title: '👑 Owner / Admin', items: cats.admin }] : []),
  ];

  let text =
    `${buildHeader(c)}\n\n` +
    `📋 *Full Command List*\n\n` +
    infoBlock(displayName, plan, balance, isQueue, c);

  for (const s of sections) {
    text += `\n${sep(c)}\n${s.title}\n${sep(c)}\n`;
    text += s.items.map(x => `• \`${x.cmd}\`\n  ↳ ${x.desc}`).join('\n') + '\n';
  }

  text +=
    `\n${sep(c)}\n💡 Tips:\n` +
    `• \`${prefix}menu search <kata>\` — Cari command\n` +
    `• \`${prefix}menu wizard\` — Setup step-by-step\n` +
    `\n🌐 ${c.identity?.websiteUrl || 'Buka web DLavie OS'}\n${footer(c, config)}`;

  return { text };
}

// ════════════════════════════════════════════════════════════════════════════
// MENU TYPE 19: AI GUIDED — user ketik kebutuhan, AI arahkan
// ════════════════════════════════════════════════════════════════════════════
function menuAiGuided(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, query = '') {
  if (!query) {
    return {
      text:
        `${buildHeader(c)}\n\n` +
        `🤖 *AI Guided Menu*\n\n` +
        `Ketik kebutuhanmu:\n\`${prefix}menu ai <kebutuhan>\`\n\n` +
        `Contoh:\n` +
        `• \`${prefix}menu ai connect bot\`\n` +
        `• \`${prefix}menu ai fix error\`\n` +
        `• \`${prefix}menu ai cek token\`\n` +
        `• \`${prefix}menu ai install plugin\`\n\n` +
        `${footer(c, config)}`
    };
  }

  const q = query.toLowerCase();
  const rules = [
    { keywords: ['connect', 'hubung', 'tambah bot', 'link'],      cmds: [`${prefix}connect generate`, `${prefix}connect verify`], reason: 'Untuk menghubungkan bot baru' },
    { keywords: ['error', 'fix', 'rusak', 'masalah', 'crash'],    cmds: [`${prefix}fix`, `${prefix}monitor`, `${prefix}status`],   reason: 'Untuk memperbaiki error' },
    { keywords: ['plugin', 'install', 'fitur baru'],               cmds: [`${prefix}plugin list`, `${prefix}plugin install`],      reason: 'Untuk mengelola plugin' },
    { keywords: ['token', 'saldo', 'topup', 'isi ulang'],          cmds: [`${prefix}token`, `${prefix}topup`],                    reason: 'Untuk cek & isi ulang token' },
    { keywords: ['relay', 'kontrol', 'kirim command', 'remote'],   cmds: [`${prefix}relay list`, `${prefix}relay BOT_ID cmd`],    reason: 'Untuk mengontrol bot' },
    { keywords: ['customize', 'tampilan', 'tema', 'nama bot'],     cmds: [`${prefix}customize status`, `${prefix}customize name`], reason: 'Untuk kustomisasi bot' },
    { keywords: ['status', 'cek', 'info', 'ping'],                 cmds: [`${prefix}status`, `${prefix}info`, `${prefix}ping`],   reason: 'Untuk cek status sistem' },
    { keywords: ['update', 'perbarui', 'upgrade'],                  cmds: [`${prefix}update`, `${prefix}plugin update`],           reason: 'Untuk update bot' },
    { keywords: ['schedule', 'jadwal', 'otomatis', 'cron'],        cmds: [`${prefix}schedule list`, `${prefix}schedule add`],     reason: 'Untuk jadwal otomatis' },
    { keywords: ['broadcast', 'kirim ke semua', 'notif'],          cmds: [`${prefix}broadcast`],                                  reason: 'Untuk kirim pesan ke semua user' },
  ];

  let matched = null;
  for (const r of rules) {
    if (r.keywords.some(kw => q.includes(kw))) { matched = r; break; }
  }

  if (!matched) {
    return {
      text:
        `🤖 *AI Guided Menu*\n\nHmm, saya kurang paham kebutuhanmu 🤔\n\n` +
        `Coba cari dengan: \`${prefix}menu search ${query}\`\nAtau lihat semua: \`${prefix}menu full\`\n\n${footer(c, config)}`
    };
  }

  return {
    text:
      `🤖 *AI Guided — "${query}"*\n\n` +
      `✅ ${matched.reason}:\n\n` +
      matched.cmds.map((cmd, i) => `${i + 1}. \`${cmd}\``).join('\n') +
      `\n\n💡 Tip: Ketik \`${prefix}menu ai <kebutuhan lain>\` untuk saran lain\n${footer(c, config)}`
  };
}

// ════════════════════════════════════════════════════════════════════════════
// MENU TYPE 20: TERMINAL STYLE — tampilan seperti OS/console
// ════════════════════════════════════════════════════════════════════════════
function menuTerminal(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config) {
  const name = c.identity?.botName || 'DLavie OS';
  const cats  = allCmds(prefix, isOwner, isAdmin, c);
  const all   = flatCmds(cats);

  return {
    text:
      `\`\`\`\n` +
      `DLavie OS v2.0 — Terminal Mode\n` +
      `User: ${displayName.split('—')[0].trim()}\n` +
      `Plan: ${plan} | Token: ${balance}\n` +
      `────────────────────────────\n` +
      `$ ls commands/\n` +
      all.map(x => `  ${x.label.toLowerCase().padEnd(12)} # ${x.desc}`).join('\n') +
      `\n────────────────────────────\n` +
      `$ echo "${isQueue ? 'QUEUE MODE' : 'PRIORITY MODE'}"\n` +
      `> ${isQueue ? 'QUEUE MODE — upgrade to Pro!' : 'PRIORITY MODE — no queue!'}\n` +
      `────────────────────────────\n` +
      `Hint: Use prefix '${prefix}' before any command\n` +
      `\`\`\``
  };
}

// ════════════════════════════════════════════════════════════════════════════
// MENU TYPE 21: BUTTON — interactiveMessage + nativeFlowMessage (quick_reply)
// Requires binary node injection via additionalNodes (biz/interactive/native_flow)
// Falls back to styled text if WA rejects the interactive format
// ════════════════════════════════════════════════════════════════════════════
async function menuButton(sock, jid, c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, safeSend) {
  const { sendInteractiveMsg } = require('../src/utils/interactiveMsg');
  const botName = c.identity?.botName || 'DLavie OS';

  const body =
    `${buildHeader(c)}\n\n` +
    `${personalityGreeting(c, displayName)}\n\n` +
    infoBlock(displayName, plan, balance, isQueue, c);

  const buttons = [
    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '📊 Status Bot',  id: `${prefix}status`  }) },
    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🪙 Cek Token',   id: `${prefix}token`   }) },
    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🤖 Connect Bot', id: `${prefix}connect` }) },
  ];

  if (isOwner || isAdmin) {
    buttons.push(
      { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🎨 Customize', id: `${prefix}customize` }) },
      { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🔧 Auto-Fix',  id: `${prefix}fix`       }) },
    );
  }

  const ok = await sendInteractiveMsg(sock, jid, {
    body,
    title:  botName,
    footer: footer(c, config),
    buttons,
  });

  if (ok) return null; // sudah terkirim via interactiveMessage

  // Fallback: styled text jika interactiveMessage gagal
  const div = '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄';
  let text =
    `${buildHeader(c)}\n\n` +
    `${personalityGreeting(c, displayName)}\n\n` +
    infoBlock(displayName, plan, balance, isQueue, c) + '\n' +
    `${div}\n` +
    `┌─────────────────────────────┐\n` +
    `│ 📊  \`${prefix}status\`  — Status Bot   │\n` +
    `│ 🪙  \`${prefix}token\`   — Cek Token    │\n` +
    `│ 🤖  \`${prefix}connect\` — Connect Bot  │\n` +
    `│ 🎨  \`${prefix}customize\` — Tampilan   │\n` +
    `│ 🔌  \`${prefix}plugin\`  — Plugin        │\n` +
    `│ 🔧  \`${prefix}fix\`     — Auto-Fix      │\n` +
    `│ 🔗  \`${prefix}relay\`   — Multi-Bot     │\n` +
    `└─────────────────────────────┘\n`;

  if (isOwner || isAdmin) {
    text += `\n┌─────────────────────────────┐\n` +
      `│ 👑  \`${prefix}owner\`    — Owner Panel │\n` +
      `│ 📢  \`${prefix}broadcast\` — Broadcast  │\n` +
      `└─────────────────────────────┘\n`;
  }

  text += `\n${div}\n💡 Semua command: \`${prefix}menu full\`\n${footer(c, config)}`;
  return { text };
}

// ════════════════════════════════════════════════════════════════════════════
// MENU TYPE 22: BUTTONCAT — interactiveMessage + nativeFlowMessage (single_select)
// Dropdown list per kategori — requires binary node injection
// Falls back to sectioned text if WA rejects the interactive format
// ════════════════════════════════════════════════════════════════════════════
async function menuButtonCat(sock, jid, c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, safeSend) {
  const { sendInteractiveMsg } = require('../src/utils/interactiveMsg');
  const cats    = allCmds(prefix, isOwner, isAdmin, c);
  const botName = c.identity?.botName || 'DLavie OS';

  // Build sections for single_select dropdown
  const sections = [];
  if (cats.auth?.length)     sections.push({ title: '🔑 Autentikasi',  rows: cats.auth.map(x     => ({ header: x.label, title: x.cmd, description: x.desc, id: x.cmd })) });
  if (cats.bot?.length)      sections.push({ title: '🤖 Bot Control',  rows: cats.bot.map(x      => ({ header: x.label, title: x.cmd, description: x.desc, id: x.cmd })) });
  if (cats.features?.length) sections.push({ title: '⚙️ Fitur Utama', rows: cats.features.map(x => ({ header: x.label, title: x.cmd, description: x.desc, id: x.cmd })) });
  if (cats.info?.length)     sections.push({ title: '📊 Info & Status',rows: cats.info.map(x     => ({ header: x.label, title: x.cmd, description: x.desc, id: x.cmd })) });
  if (cats.admin?.length)    sections.push({ title: '👑 Owner/Admin',  rows: cats.admin.map(x    => ({ header: x.label, title: x.cmd, description: x.desc, id: x.cmd })) });

  const body =
    `${buildHeader(c)}\n\n` +
    `${personalityGreeting(c, displayName)}\n\n` +
    infoBlock(displayName, plan, balance, isQueue, c);

  const ok = await sendInteractiveMsg(sock, jid, {
    body,
    title:  `⚡ ${botName} — Menu`,
    footer: footer(c, config),
    buttons: [
      {
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title:    '📋 Pilih Kategori Command',
          sections,
        }),
      },
    ],
  });

  if (ok) return null; // sudah terkirim via interactiveMessage

  // Fallback: sectioned text
  const div = '━━━━━━━━━━━━━━━━━━━━━━━━━━';
  const renderCat = (emoji, title, items) => {
    if (!items?.length) return '';
    return (
      `\n*${emoji} ${title}*\n${div}\n` +
      items.map(x => `  \`${x.cmd}\` — ${x.desc}`).join('\n') + '\n'
    );
  };

  let text =
    `${buildHeader(c)}\n\n` +
    `${personalityGreeting(c, displayName)}\n\n` +
    infoBlock(displayName, plan, balance, isQueue, c) +
    renderCat('🔑', 'Autentikasi', cats.auth) +
    renderCat('🤖', 'Bot Control', cats.bot) +
    renderCat('⚙️', 'Fitur Utama', cats.features) +
    renderCat('📊', 'Info & Status', cats.info);

  if (cats.admin?.length) text += renderCat('👑', 'Owner / Admin', cats.admin);
  text += `\n${div}\n💡 Ketik command langsung atau: \`${prefix}menu <tipe>\`\n${footer(c, config)}`;
  return { text };
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN EXECUTE
// ════════════════════════════════════════════════════════════════════════════
module.exports = {
  name: 'menu',
  aliases: ['help', 'm', 'fav'],
  description: 'Tampilkan menu DLavie OS (20 tipe)',

  execute: async (sock, msg, args, config, ctx = {}) => {
    const jid       = msg.key.remoteJid;
    const userId    = extractSenderNumber(msg);
    const safeSend  = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));
    const webAuth   = getWebAuth();
    const customize = getBotCustomization();
    const c         = customize.getAll();
    const prefix    = config.botPrefix || config.bot?.prefix || '!';

    const ownerNum  = config.ownerNumber || config.bot?.ownerNumber || '';
    const isOwner   = isOwnerMsg(msg, ownerNum);
    const session   = webAuth.getSession(userId);
    const plan      = (session?.plan || (isOwner ? 'ENTERPRISE' : 'FREE')).toUpperCase();
    const isAdmin   = session?.role === 'admin';
    const isQueue   = !isOwner && ['FREE', 'STARTER'].includes(plan);
    const engine    = getEngine();

    const tokenEng = engine.getSystem('token');
    let balance    = '—';
    try {
      if (tokenEng && !isOwner) balance = (tokenEng.getBalance?.(userId) || 0).toLocaleString('id-ID');
      else if (isOwner) balance = '∞';
    } catch (_) {}

    const displayName = isOwner
      ? `👑 ${c.identity?.ownerName || 'Owner'} — ${ownerNum || ''}`
      : (session?.email || userId);

    // ─── Handle fav subcommand ────────────────────────────────────────────
    const cmdName = msg.key.fromMe ? 'menu' : (args[-1] || 'menu');
    if (msg.key.remoteJid && args[0] === 'fav' || (module.exports.aliases.includes('fav') && msg.message?.conversation?.startsWith(`${prefix}fav`))) {
      const action = args[1] || '';
      const target = args[2] || '';
      if (action === 'add' && target) { setFavorite(userId, target, true); await safeSend(jid, { text: `⭐ \`${target}\` ditambahkan ke favorit!` }); return; }
      if (action === 'rm'  && target) { setFavorite(userId, target, false); await safeSend(jid, { text: `🗑️ \`${target}\` dihapus dari favorit.` }); return; }
    }

    // ─── Determine menu type from args or config ──────────────────────────
    const arg0 = (args[0] || '').toLowerCase();
    let menuType = c.menu?.type || 'hybrid';

    // Allow !menu <type> to override
    const validTypes = ['text','number','hybrid','search','dashboard','quickaction','rolebased',
      'pagination','recent','favorite','smart','contextual','cmdpalette','wizard','media',
      'card','compact','full','aiguided','terminal','button','buttoncat'];

    if (validTypes.includes(arg0)) {
      menuType = arg0;
      args = args.slice(1);
    }

    // Pagination number shortcut: !menu 2 → pagination page 2
    const pageNum = parseInt(arg0, 10);
    if (!isNaN(pageNum) && pageNum > 0) {
      menuType = 'pagination';
      args = [String(pageNum)];
    }

    // Special subcommands
    if (arg0 === 'search' || arg0 === 'cari') { menuType = 'search'; args = args.slice(1); }
    if (arg0 === 'cmd')                        { menuType = 'cmdpalette'; args = args.slice(1); }
    if (arg0 === 'ai')                         { menuType = 'aiguided'; args = args.slice(1); }
    if (arg0 === 'wizard')                     { menuType = 'wizard'; args = args.slice(1); }

    recordHistory(userId, 'menu');

    let payload = null;

    switch (menuType) {
      case 'text':
        payload = menuText(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config);
        break;
      case 'number':
        payload = menuNumber(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config);
        break;
      case 'search':
        payload = menuSearch(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, args.join(' '));
        break;
      case 'dashboard':
        payload = await menuDashboard(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, engine);
        break;
      case 'quickaction':
        payload = menuQuickAction(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config);
        break;
      case 'rolebased':
        payload = menuRoleBased(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config);
        break;
      case 'pagination':
        payload = menuPagination(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, parseInt(args[0] || '1', 10));
        break;
      case 'recent':
        payload = menuRecent(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, userId);
        break;
      case 'favorite':
        payload = menuFavorite(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, userId);
        break;
      case 'smart':
        payload = await menuSmart(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, engine);
        break;
      case 'contextual':
        payload = menuContextual(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, jid);
        break;
      case 'cmdpalette':
        payload = menuCmdPalette(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, args.join(' '));
        break;
      case 'wizard':
        payload = menuWizard(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, userId, parseInt(args[0] || '0', 10));
        break;
      case 'media':
        payload = await menuMedia(sock, jid, c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, safeSend);
        break;
      case 'card':
        payload = menuCard(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config);
        break;
      case 'compact':
        payload = menuCompact(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config);
        break;
      case 'full':
        payload = menuFull(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config);
        break;
      case 'aiguided':
        payload = menuAiGuided(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, args.join(' '));
        break;
      case 'terminal':
        payload = menuTerminal(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config);
        break;
      case 'button':
        payload = await menuButton(sock, jid, c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, safeSend);
        break;
      case 'buttoncat':
        payload = await menuButtonCat(sock, jid, c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config, safeSend);
        break;
      default:
        payload = menuHybrid(c, prefix, displayName, plan, balance, isOwner, isAdmin, isQueue, config);
    }

    if (payload) {
      await safeSend(jid, payload);
    }
  },
};
