/**
 * DLavie OS — Bot Customization Engine v2.0
 * ID: DLAVIE-CUSTOMIZE-002
 * Extended: 20 menu types, 15 themes, 7 languages, thumbnail/media support, personality
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../../tmp/bot_config.json');

try {
  const tmpDir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
} catch (_) {}

const DEFAULT_CONFIG = {
  identity: {
    botName:       process.env.BOT_NAME || 'DLavie OS',
    ownerName:     'Owner',
    supportContact: process.env.OWNER_NUMBER || '',
    brandName:     'DLavie OS',
    websiteUrl:    '',
    watermark:     '⚡ DLavie OS',
    copyrightText: '© 2026 DLavie OS',
    description:   'WhatsApp Multi-Bot Control Platform',
    tagline:       'Kelola Bot WhatsApp Tanpa Ribet',
  },
  menu: {
    type: 'hybrid',
    // text|number|hybrid|search|dashboard|quickaction|rolebased|pagination|
    // recent|favorite|smart|contextual|cmdpalette|wizard|media|card|compact|full|aiguided|terminal
    theme: 'dlavie_default',
    // dlavie_default|minimal|modern|premium|gaming|cyberpunk|neon|dark_knight|
    // sakura|ocean|fire|matrix|hacker|royal|space
    language:    'id',
    // id|en|ms|ar|zh|jv|su
    personality: 'friendly',
    // friendly|professional|ai_assistant|funny|savage|kawaii|custom
    header:      '',
    footer:      '⚡ DLavie OS | Powered by DLavie',
    showCategories: true,
    showRecent:     true,
    showFavorites:  true,
    pagination:     true,
    pageSize:       10,
    customPersonalityText: '',
  },
  thumbnail: {
    enabled:   false,
    type:      'none',       // none|url|emoji
    url:       '',
    caption:   '',
    useForMenu: false,
  },
  messages: {
    welcome:     'Selamat datang di {botName}! Ketik !menu untuk melihat fitur.',
    goodbye:     'Sampai jumpa! Terima kasih telah menggunakan {botName}.',
    error:       '❌ Terjadi kesalahan. Silakan coba lagi.',
    success:     '✅ Berhasil!',
    maintenance: '🔧 Bot sedang maintenance. Mohon tunggu.',
    premium:     '⭐ Fitur ini khusus untuk pengguna Premium.',
    noPermission:'🚫 Kamu tidak punya akses untuk command ini.',
    notFound:    '❓ Command tidak ditemukan. Ketik !menu untuk melihat daftar command.',
    rateLimit:   '⏳ Terlalu cepat! Tunggu sebentar ya.',
    tokenLow:    '💰 Token hampir habis! Ketik !topup untuk isi ulang.',
  },
  security: {
    antiSpam:   true,
    antiFlood:  true,
    antiLink:   false,
    antiCall:   false,
    antiDelete: false,
    antiCrash:  true,
    antiBot:    false,
  },
  ai: {
    primary:      'chatgpt',
    secondary:    'gemini',
    fallback:     'grok',
    personality:  'friendly',
    responseStyle:'concise',
  },
  advanced: {
    githubRepo:    '',
    pluginSandbox: true,
    autoUpdate:    false,
    debugMode:     false,
    logLevel:      'info',
    maxRetries:    3,
  },
  updatedAt: null,
};

const LANGS = {
  id: { greeting: 'Halo', commands: 'Command', tips: 'Tips', owner: 'Owner', status: 'Status', search: 'Cari', back: 'Kembali', next: 'Lanjut', page: 'Halaman', noResult: 'Tidak ditemukan', favorites: 'Favorit', recent: 'Terkini', quickAction: 'Aksi Cepat', dashboard: 'Dashboard', all: 'Semua' },
  en: { greeting: 'Hello', commands: 'Commands', tips: 'Tips', owner: 'Owner', status: 'Status', search: 'Search', back: 'Back', next: 'Next', page: 'Page', noResult: 'Not found', favorites: 'Favorites', recent: 'Recent', quickAction: 'Quick Actions', dashboard: 'Dashboard', all: 'All' },
  ms: { greeting: 'Helo', commands: 'Arahan', tips: 'Tips', owner: 'Pemilik', status: 'Status', search: 'Cari', back: 'Balik', next: 'Seterusnya', page: 'Halaman', noResult: 'Tidak dijumpai', favorites: 'Kegemaran', recent: 'Terbaru', quickAction: 'Tindakan Pantas', dashboard: 'Papan Pemuka', all: 'Semua' },
  ar: { greeting: 'مرحبا', commands: 'الأوامر', tips: 'نصائح', owner: 'المالك', status: 'الحالة', search: 'بحث', back: 'رجوع', next: 'التالي', page: 'صفحة', noResult: 'لم يوجد', favorites: 'المفضلة', recent: 'الأخيرة', quickAction: 'إجراءات سريعة', dashboard: 'لوحة التحكم', all: 'الكل' },
  zh: { greeting: '你好', commands: '命令', tips: '提示', owner: '主人', status: '状态', search: '搜索', back: '返回', next: '下一页', page: '页面', noResult: '未找到', favorites: '收藏', recent: '最近', quickAction: '快速操作', dashboard: '仪表盘', all: '全部' },
  jv: { greeting: 'Sugeng', commands: 'Printah', tips: 'Tips', owner: 'Pemilik', status: 'Status', search: 'Goleki', back: 'Bali', next: 'Lanjut', page: 'Kaca', noResult: 'Ora ketemu', favorites: 'Favorit', recent: 'Anyar', quickAction: 'Aksi Cepet', dashboard: 'Dashboard', all: 'Kabeh' },
  su: { greeting: 'Wilujeng', commands: 'Paréntah', tips: 'Tips', owner: 'Juragan', status: 'Status', search: 'Milarian', back: 'Balik', next: 'Salajengna', page: 'Kaca', noResult: 'Teu kapendak', favorites: 'Favorit', recent: 'Panganyarna', quickAction: 'Aksi Gancang', dashboard: 'Dashboard', all: 'Sadayana' },
};

class BotCustomization {
  constructor() {
    this.lastLoadTime = 0;
    this.config = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const mtime = fs.statSync(CONFIG_FILE).mtimeMs;
        const saved  = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        this.lastLoadTime = mtime;
        return this._merge(DEFAULT_CONFIG, saved);
      }
    } catch (_) {}
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  _reloadIfStale() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const mtime = fs.statSync(CONFIG_FILE).mtimeMs;
        if (mtime > this.lastLoadTime) {
          const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
          this.config = this._merge(DEFAULT_CONFIG, saved);
          this.lastLoadTime = mtime;
        }
      }
    } catch (_) {}
  }

  _merge(defaults, overrides) {
    const result = JSON.parse(JSON.stringify(defaults));
    for (const [key, val] of Object.entries(overrides || {})) {
      if (val !== null && val !== undefined && typeof val === 'object' && !Array.isArray(val) && typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) {
        result[key] = this._merge(defaults[key] || {}, val);
      } else if (val !== undefined) {
        result[key] = val;
      }
    }
    return result;
  }

  save() {
    try {
      const dir = path.dirname(CONFIG_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      this.config.updatedAt = new Date().toISOString();
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
      this._saveToDB().catch(() => {});
      return true;
    } catch (err) {
      console.error('[DLAVIE][CUSTOMIZE] Save error:', err.message);
      return false;
    }
  }

  async _saveToDB() {
    try {
      const { query, isConnected } = require('../database/replitPg');
      if (!isConnected()) return;
      const ownerPhone = process.env.OWNER_NUMBER || 'system';
      await query(
        `INSERT INTO dlavie_bot_customization (owner_phone, config, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (owner_phone) DO UPDATE SET config = $2, updated_at = NOW()`,
        [ownerPhone, JSON.stringify(this.config)]
      );
    } catch (_) {}
  }

  async loadFromDB(ownerPhone) {
    try {
      const { query, isConnected } = require('../database/replitPg');
      if (!isConnected()) return;
      const res = await query('SELECT config FROM dlavie_bot_customization WHERE owner_phone = $1', [ownerPhone]);
      if (res.rows[0]?.config) {
        this.config = this._merge(DEFAULT_CONFIG, res.rows[0].config);
        this.save();
      }
    } catch (_) {}
  }

  get(section, key) {
    this._reloadIfStale();
    if (key) return this.config[section]?.[key];
    return this.config[section] || {};
  }

  set(section, key, value) {
    if (!this.config[section]) this.config[section] = {};
    this.config[section][key] = value;
    return this.save();
  }

  setSection(section, values) {
    if (!this.config[section]) this.config[section] = {};
    Object.assign(this.config[section], values);
    return this.save();
  }

  getAll() {
    this._reloadIfStale();
    return this.config;
  }

  getBotName() {
    this._reloadIfStale();
    return this.config.identity.botName;
  }

  getTheme() {
    this._reloadIfStale();
    return this.config.menu.theme;
  }

  getLanguage() {
    this._reloadIfStale();
    return this.config.menu.language;
  }

  getLang() {
    this._reloadIfStale();
    const lang = this.config.menu.language || 'id';
    return LANGS[lang] || LANGS['id'];
  }

  getPersonality() {
    this._reloadIfStale();
    return this.config.menu.personality || 'friendly';
  }

  getGithubRepo() {
    this._reloadIfStale();
    return this.config.advanced.githubRepo;
  }

  getThumbnail() {
    this._reloadIfStale();
    return this.config.thumbnail || {};
  }

  formatMessage(msgKey, vars = {}) {
    let msg = this.config.messages[msgKey] || '';
    msg = msg.replace(/\{botName\}/g, this.config.identity.botName);
    msg = msg.replace(/\{ownerName\}/g, this.config.identity.ownerName);
    for (const [k, v] of Object.entries(vars)) {
      msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return msg;
  }

  renderStatus() {
    const c = this.config;
    return (
      `🎨 *Bot Customization v2.0*\n\n` +
      `*🤖 Identitas:*\n` +
      `• Nama: ${c.identity.botName}\n` +
      `• Owner: ${c.identity.ownerName}\n` +
      `• Brand: ${c.identity.brandName}\n` +
      `• Website: ${c.identity.websiteUrl || '-'}\n\n` +
      `*📋 Menu & Tampilan:*\n` +
      `• Tipe: ${c.menu.type}\n` +
      `• Tema: ${c.menu.theme}\n` +
      `• Bahasa: ${c.menu.language}\n` +
      `• Personality: ${c.menu.personality}\n\n` +
      `*🖼️ Thumbnail:*\n` +
      `• Enabled: ${c.thumbnail?.enabled ? 'Ya' : 'Tidak'}\n` +
      `• Type: ${c.thumbnail?.type || 'none'}\n\n` +
      `*⚡ AI:*\n` +
      `• Primary: ${c.ai.primary}\n` +
      `• Secondary: ${c.ai.secondary}\n` +
      `• Fallback: ${c.ai.fallback}\n\n` +
      `Ubah: \`!customize set <section>.<key> <value>\``
    );
  }
}

let instance = null;
function getBotCustomization() {
  if (!instance) {
    instance = new BotCustomization();
    if (!fs.existsSync(CONFIG_FILE)) {
      try {
        const { isConnected } = require('../database/replitPg');
        if (isConnected()) {
          instance.loadFromDB(process.env.OWNER_NUMBER || 'system').catch(() => {});
        }
      } catch (_) {}
    }
  }
  return instance;
}

module.exports = { BotCustomization, getBotCustomization, DEFAULT_CONFIG, LANGS };
