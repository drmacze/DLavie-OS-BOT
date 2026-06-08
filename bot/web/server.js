/**
 * DLavie OS — Web Dashboard Server
 * Express server untuk web dashboard terintegrasi
 * Port: 5000 (Replit webview)
 */

'use strict';

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const path       = require('path');
const fs         = require('fs');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const crypto     = require('crypto');
const rateLimit  = require('express-rate-limit');
const compression = require('compression');
const { getWebAuth } = require('../src/auth/webAuth');
const { isConnected: isPgConnected, query } = require('../src/database/replitPg');
const { createPaymentTx, uploadProof, notifyOwner, cekStruk, getPaymentsByUser } = require('../src/core/paymentEngine');
const multer = require('multer');
const objStorage = (() => { try { return require('../src/core/objectStorage'); } catch (_) { return null; } })();
const botMode    = (() => { try { return require('../src/core/botMode'); } catch (_) { return null; } })();

let cfg;
try { cfg = require('../DLavieConfig'); } catch (_) { cfg = {}; }
try { require('dotenv').config(); } catch (_) {}

const JWT_SECRET   = process.env.JWT_SECRET      || cfg.auth?.jwtSecret || 'dlavie-web-secret-change-me';
const WEB_PORT     = parseInt(process.env.WEB_PORT|| '') || cfg.web?.port || 5000;
const API_BASE_URL = `http://localhost:${process.env.API_PORT || 8080}`;

// Email yang otomatis mendapat role OWNER penuh
const AUTO_OWNER_EMAILS = ['dev@dlavie.com'];
function isAutoOwner(email) {
  return AUTO_OWNER_EMAILS.includes(String(email || '').toLowerCase().trim());
}

// ─── Storage: Replit PostgreSQL (fallback ke local file) ───
const USERS_FILE = path.join(__dirname, '../tmp/web_users.json');
function USE_PG() { return isPgConnected(); }

function loadUsersLocal() {
  try { if (fs.existsSync(USERS_FILE)) return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch (_) {}
  return {};
}
function saveUsersLocal(u) {
  try { fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2)); } catch (_) {}
}

async function loadUsers() {
  if (USE_PG()) {
    try {
      const result = await query('SELECT * FROM dlavie_web_users');
      const users = {};
      for (const row of result.rows) {
        users[row.email] = {
          userId: row.user_id,
          email: row.email,
          name: row.name,
          passwordHash: row.password_hash,
          plan: row.plan || 'free',
          tokens: row.tokens || 5000,
          createdAt: new Date(row.created_at).getTime(),
          lastLogin: row.last_login ? new Date(row.last_login).getTime() : null,
          bots: row.bots || [],
          recentActivity: row.recent_activity || [],
          tokenHistory: row.token_history || [],
          tokenUsedToday: row.token_used_today || 0,
          commandsToday: row.commands_today || 0,
        };
      }
      return users;
    } catch (err) {
      console.warn('[DLAVIE][WEB] PG loadUsers failed, falling back:', err.message);
    }
  }
  return loadUsersLocal();
}

async function saveUsers(users) {
  if (USE_PG()) {
    try {
      for (const [email, user] of Object.entries(users)) {
        await query(
          `INSERT INTO dlavie_web_users (user_id, email, name, password_hash, plan, tokens, bots, recent_activity, token_history, token_used_today, commands_today, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, '{}')
           ON CONFLICT (email) DO UPDATE SET
             name = EXCLUDED.name,
             password_hash = EXCLUDED.password_hash,
             plan = EXCLUDED.plan,
             tokens = EXCLUDED.tokens,
             bots = EXCLUDED.bots,
             recent_activity = EXCLUDED.recent_activity,
             token_history = EXCLUDED.token_history,
             token_used_today = EXCLUDED.token_used_today,
             commands_today = EXCLUDED.commands_today`,
          [
            user.userId, email, user.name, user.passwordHash, user.plan, user.tokens,
            JSON.stringify(user.bots || []),
            JSON.stringify(user.recentActivity || []),
            JSON.stringify(user.tokenHistory || []),
            user.tokenUsedToday || 0,
            user.commandsToday || 0,
          ]
        );
      }
      return;
    } catch (err) {
      console.warn('[DLAVIE][WEB] PG saveUsers failed, falling back:', err.message);
    }
  }
  saveUsersLocal(users);
}

// ─── App ───
const app = express();

// Replit runs behind a reverse proxy — trust it for rate-limit & IP detection
app.set('trust proxy', 1);

app.use(compression());
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for dashboard
}));
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ─── Maintenance middleware (block non-API/non-auth when active) ───
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path === '/health' || req.path === '/ping' || req.path === '/maintenance') return next();
  try {
    const m = loadMaintenanceData();
    if (m.active) return res.sendFile(path.join(__dirname, 'views', 'maintenance.html'));
  } catch (_) {}
  next();
});

// ─── Multer: upload bukti pembayaran ───
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ─── Additional imports for new features ───
const { execSync, spawn } = require('child_process');
const { getBotCustomization } = require('../src/core/botCustomization');
const { isOwnerById } = require('../src/utils/ownerUtils');

// ─── Maintenance & Popup helpers ───
const MAINTENANCE_FILE = path.join(__dirname, '../tmp/maintenance.json');
const POPUP_FILE       = path.join(__dirname, '../tmp/popup.json');

function loadMaintenanceData() {
  try { if (fs.existsSync(MAINTENANCE_FILE)) return JSON.parse(fs.readFileSync(MAINTENANCE_FILE, 'utf8')); } catch (_) {}
  return { active: false, title: 'Maintenance', description: 'Sistem sedang dalam maintenance.', schedule: '', estimatedEnd: '' };
}
function loadPopupData() {
  try { if (fs.existsSync(POPUP_FILE)) return JSON.parse(fs.readFileSync(POPUP_FILE, 'utf8')); } catch (_) {}
  return { active: false, title: 'Pengumuman', message: '', buttonText: 'Tutup', icon: '📢' };
}
function saveMaintenanceData(data) {
  try { if (!fs.existsSync(path.dirname(MAINTENANCE_FILE))) fs.mkdirSync(path.dirname(MAINTENANCE_FILE), { recursive: true }); fs.writeFileSync(MAINTENANCE_FILE, JSON.stringify(data, null, 2)); } catch (_) {}
}
function savePopupData(data) {
  try { fs.writeFileSync(POPUP_FILE, JSON.stringify(data, null, 2)); } catch (_) {}
}

// ─── Rate limiting ───
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.' } });
const apiLimiter  = rateLimit({ windowMs: 60 * 1000, max: 100 });
app.use('/api/auth', authLimiter);
app.use('/api/', apiLimiter);

// ─── Owner middleware ───
function requireOwner(req, res, next) {
  const ownerNum = process.env.OWNER_NUMBER;
  if (!ownerNum) { next(); return; } // No owner set = allow
  if (req.user?.role === 'owner' || isOwnerById(req.user?.email, ownerNum)) { next(); return; }
  // Also check email
  const AUTO_OWNER_EMAILS_OWN = ['dev@dlavie.com'];
  if (AUTO_OWNER_EMAILS_OWN.includes(String(req.user?.email||'').toLowerCase())) { next(); return; }
  return res.status(403).json({ error: 'Hanya Owner yang bisa mengakses fitur ini' });
}

// ─── JWT Middleware ───
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.headers['x-token'];
  if (!token) return res.status(401).json({ error: 'Token diperlukan' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (_) {
    return res.status(401).json({ error: 'Token tidak valid atau sudah expire' });
  }
}

// ═══════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, password, dan nama wajib diisi' });
    if (password.length < 8) return res.status(400).json({ error: 'Password minimal 8 karakter' });

    const users = await loadUsers();
    const emailKey = email.toLowerCase().trim();

    if (users[emailKey]) return res.status(409).json({ error: 'Email sudah terdaftar' });

    const hash = await bcrypt.hash(password, 12);
    const userId = 'usr_' + crypto.randomBytes(12).toString('hex');
    const autoOwner = isAutoOwner(emailKey);
    const plan      = autoOwner ? 'enterprise' : 'free';
    const role      = autoOwner ? 'owner' : 'user';
    const tokens    = autoOwner ? 999999 : 5000;
    users[emailKey] = {
      userId, email: emailKey, name,
      passwordHash: hash,
      plan, role, tokens,
      createdAt: Date.now(),
      lastLogin: null,
      bots: [],
    };
    await saveUsers(users);

    const token = jwt.sign({ userId, email: emailKey, name, plan, role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { userId, email: emailKey, name, plan, role, tokens } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib' });

    const users = await loadUsers();
    const emailKey = email.toLowerCase().trim();
    const user = users[emailKey];

    if (!user) return res.status(401).json({ error: 'Email atau password salah' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Email atau password salah' });

    // Auto-elevate owner emails setiap login
    if (isAutoOwner(emailKey)) {
      user.role  = 'owner';
      user.plan  = 'enterprise';
      user.tokens = Math.max(user.tokens || 0, 999999);
    }
    user.lastLogin = Date.now();
    await saveUsers(users);

    const role = user.role || 'user';
    const token = jwt.sign(
      { userId: user.userId, email: emailKey, name: user.name, plan: user.plan, role },
      JWT_SECRET, { expiresIn: '7d' }
    );
    res.json({
      success: true, token,
      user: { userId: user.userId, email: emailKey, name: user.name, plan: user.plan, role, tokens: user.tokens }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user
app.get('/api/auth/me', requireAuth, async (req, res) => {
  const users = await loadUsers();
  const user  = users[req.user.email];
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  const { passwordHash, ...safe } = user;
  res.json({ user: safe });
});

// Update profile
app.put('/api/auth/profile', requireAuth, async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const users = await loadUsers();
    const user  = users[req.user.email];
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

    if (name) user.name = name.trim();

    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ error: 'Password lama diperlukan' });
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return res.status(401).json({ error: 'Password lama salah' });
      if (newPassword.length < 8) return res.status(400).json({ error: 'Password baru minimal 8 karakter' });
      user.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    await saveUsers(users);
    const { passwordHash, ...safe } = user;
    res.json({ success: true, user: safe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════
// BOT CODE ROUTES
// ═══════════════════════════════════════════════

// Generate bot login code
app.post('/api/bot/code', requireAuth, async (req, res) => {
  try {
    const webAuth = getWebAuth();
    // Load user dari DB untuk ambil token balance terkini
    let tokenBalance = null;
    try {
      const users = await loadUsers();
      const u = users[req.user.email];
      if (u) tokenBalance = u.tokens || 5000;
    } catch (_) {}

    const { code, expiresAt } = webAuth.generateBotCode(
      req.user.userId,
      req.user.email,
      req.user.plan  || 'free',
      req.user.role  || 'user',
      tokenBalance
    );
    res.json({ success: true, code, expiresAt, expiresInMin: 10 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check login status (apakah WA bot user sudah login)
app.get('/api/bot/sessions', requireAuth, async (req, res) => {
  const webAuth  = getWebAuth();
  const sessions = webAuth.getActiveSessions().filter(s => {
    return s.webUserId === req.user.userId;
  });
  res.json({ sessions });
});

// ═══════════════════════════════════════════════
// DASHBOARD STATS
// ═══════════════════════════════════════════════

app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const users = await loadUsers();
    const user  = users[req.user.email];
    const webAuth = getWebAuth();
    const CONN_FILE = path.join(__dirname, '../tmp/bot_connections.json');
    let connections = {};
    try { if (fs.existsSync(CONN_FILE)) connections = JSON.parse(fs.readFileSync(CONN_FILE, 'utf8')); } catch (_) {}
    const myBots = Object.values(connections).filter(c =>
      c.botId && (c.ownerWebUserId === user?.userId || c.ownerEmail === user?.email)
    );
    const activeBots = myBots.filter(b => b.status === 'active').length;

    res.json({
      user: { name: user?.name, email: user?.email, plan: user?.plan, tokens: user?.tokens || 0 },
      stats: {
        totalBots:  myBots.length,
        activeBots,
        tokenBalance: user?.tokens || 0,
        tokenUsedToday: user?.tokenUsedToday || 0,
        commandsToday: user?.commandsToday || 0,
      },
      bots: myBots.slice(0, 5),
      recentActivity: user?.recentActivity || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════
// BOTS MANAGEMENT
// ═══════════════════════════════════════════════

// ─── Helper: load connections from file + DB merge ───
async function loadBotConnections() {
  const CONN_FILE = path.join(__dirname, '../tmp/bot_connections.json');
  let fileConns = {};
  try { if (fs.existsSync(CONN_FILE)) fileConns = JSON.parse(fs.readFileSync(CONN_FILE, 'utf8')); } catch (_) {}

  // Remove internal keys
  const connections = Object.fromEntries(
    Object.entries(fileConns).filter(([k]) => !k.startsWith('_'))
  );

  // Merge with DB
  if (isPgConnected()) {
    try {
      const res = await query('SELECT * FROM dlavie_bot_connections WHERE status != $1', ['removed']);
      for (const row of res.rows) {
        if (!connections[row.bot_id]) {
          connections[row.bot_id] = {
            botId: row.bot_id, botNumber: row.bot_number,
            ownerWebUserId: row.owner_web_user_id, ownerEmail: row.owner_email,
            ownerPhone: row.owner_phone, plan: row.plan, status: row.status,
            connectedAt: new Date(row.connected_at).getTime(),
            lastPing: new Date(row.last_ping).getTime(),
            metadata: row.metadata || {},
          };
        }
      }
    } catch (_) {}
  }
  return connections;
}

// Get bots for current user — matches by webUserId OR email
app.get('/api/bots', requireAuth, async (req, res) => {
  try {
    const connections = await loadBotConnections();
    const myBots = Object.values(connections).filter(c =>
      c.botId && (
        c.ownerWebUserId === req.user.userId ||
        c.ownerEmail === req.user.email
      )
    );
    res.json({ bots: myBots, total: myBots.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/bots/:botId', requireAuth, async (req, res) => {
  try {
    const connections = await loadBotConnections();
    const bot = connections[req.params.botId];
    if (!bot || (bot.ownerWebUserId !== req.user.userId && bot.ownerEmail !== req.user.email)) {
      return res.status(404).json({ error: 'Bot tidak ditemukan atau bukan milikmu' });
    }
    const CONN_FILE = path.join(__dirname, '../tmp/bot_connections.json');
    let fileConns = {};
    try { if (fs.existsSync(CONN_FILE)) fileConns = JSON.parse(fs.readFileSync(CONN_FILE, 'utf8')); } catch (_) {}
    delete fileConns[req.params.botId];
    try { fs.writeFileSync(CONN_FILE, JSON.stringify(fileConns, null, 2)); } catch (_) {}
    if (isPgConnected()) {
      try { await query('UPDATE dlavie_bot_connections SET status=$1 WHERE bot_id=$2', ['removed', req.params.botId]); } catch (_) {}
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Generate connection token from web panel ───
app.post('/api/connect/generate', requireAuth, async (req, res) => {
  try {
    const connections = await loadBotConnections();
    const users = await loadUsers();
    const user  = users[req.user.email];
    const plan  = user?.plan || req.user.plan || 'free';
    const maxBots = { free: 1, starter: 3, pro: 10, enterprise: 999 }[plan] || 1;

    const myBots = Object.values(connections).filter(c =>
      c.botId && (c.ownerWebUserId === req.user.userId || c.ownerEmail === req.user.email)
    );
    if (myBots.length >= maxBots) {
      return res.status(400).json({ error: `Batas bot tercapai (${maxBots} bot untuk plan ${plan.toUpperCase()}). Upgrade plan untuk tambah bot.` });
    }

    const token = 'dlvc_' + crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    // Save to DB
    if (isPgConnected()) {
      try {
        await query(
          `INSERT INTO dlavie_connect_tokens (token, owner_web_user_id, owner_email, plan, expires_at)
           VALUES ($1,$2,$3,$4,$5)`,
          [token, req.user.userId, req.user.email, plan, new Date(expiresAt).toISOString()]
        );
      } catch (_) {}
    }

    // Save to pending file
    const PENDING_FILE = path.join(__dirname, '../tmp/connect_pending.json');
    let pending = {};
    try { if (fs.existsSync(PENDING_FILE)) pending = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8')); } catch (_) {}
    pending[token] = {
      token, ownerWebUserId: req.user.userId, ownerEmail: req.user.email,
      plan, createdAt: Date.now(), expiresAt, used: false,
    };
    try { fs.writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2)); } catch (_) {}

    res.json({
      success: true, token, expiresAt, expiresInHours: 24,
      usage: `Kirim ke DLavie OS Bot: !connect verify ${token}`,
      currentBots: myBots.length, maxBots, plan,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════
// CUSTOMIZATION SETTINGS
// ═══════════════════════════════════════════════

app.get('/api/customization', requireAuth, (req, res) => {
  try {
    const customize = getBotCustomization();
    res.json({ config: customize.getAll() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/customization', requireAuth, async (req, res) => {
  try {
    const ownerNum = process.env.OWNER_NUMBER || '';
    const isOwnerUser = req.user.role === 'owner' || isOwnerById(req.user.email, ownerNum) || isAutoOwner(req.user.email);
    const users = await loadUsers();
    const user  = users[req.user.email];
    const plan  = user?.plan || req.user.plan || 'free';
    if (!isOwnerUser && !['pro','enterprise','owner'].includes(plan)) {
      return res.status(403).json({ error: 'Customization hanya untuk plan Pro & Enterprise' });
    }
    const customize = getBotCustomization();
    const { section, key, value, config: fullConfig } = req.body;
    if (fullConfig && typeof fullConfig === 'object') {
      for (const [sec, vals] of Object.entries(fullConfig)) {
        if (typeof vals === 'object') customize.setSection(sec, vals);
      }
    } else if (section && key !== undefined && value !== undefined) {
      customize.set(section, key, value);
    }
    res.json({ success: true, config: customize.getAll() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings', requireAuth, async (req, res) => {
  try {
    const users    = await loadUsers();
    const user     = users[req.user.email];
    const customize = getBotCustomization();
    res.json({
      profile: { name: user?.name, email: user?.email, plan: user?.plan },
      github: { repo: customize.getGithubRepo() },
      bot: { name: customize.getBotName(), theme: customize.getTheme(), language: customize.getLanguage() },
      ai: customize.get('ai'),
      advanced: customize.get('advanced'),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/settings/github', requireAuth, async (req, res) => {
  try {
    const { repo } = req.body;
    if (!repo) return res.status(400).json({ error: 'repo diperlukan' });
    if (!repo.startsWith('http') && !repo.startsWith('git@')) {
      return res.status(400).json({ error: 'URL repo tidak valid' });
    }
    const customize = getBotCustomization();
    customize.set('advanced', 'githubRepo', repo);
    res.json({ success: true, repo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════
// TERMINAL (Owner only)
// ═══════════════════════════════════════════════

// ─── Terminal tier helpers ───
const PLAN_TIER = { free: 0, starter: 1, pro: 2, enterprise: 3 };
function planTier(plan) { return PLAN_TIER[plan] ?? 0; }

const TERMINAL_SANDBOX_ALLOWED = [
  /^ls(\s|$)/, /^pwd$/, /^echo /, /^cat /, /^head /, /^tail /,
  /^git (status|log|diff|branch|show)/, /^npm (list|ls|outdated)/,
  /^node -[ve]/, /^npm -v/, /^df( |$)/, /^free( |$)/,
  /^ps( |$)/, /^uptime$/, /^which /, /^whoami$/, /^date$/,
  /^env$/, /^printenv/, /^uname/, /^hostname$/,
];
const TERMINAL_BLOCKED_ALWAYS = [
  'rm -rf /', 'rm -rf /*', 'mkfs', 'dd if=', ':(){:|:&};:',
  'chmod 777 /', 'chown -R',
];
const TERMINAL_BLOCKED_SANDBOX = [
  'rm ', 'chmod', 'chown', 'curl ', 'wget ', 'ssh ', 'sudo ', 'su ',
  'npm install', 'npm i ', 'yarn ', 'pip ', 'apt ', 'kill ', 'pkill ',
  'node ', 'python', ' > ', ' >> ', ' | ', '`', '$(',
];

app.post('/api/terminal/exec', requireAuth, async (req, res) => {
  try {
    const plan = req.user?.plan || 'free';
    const role = req.user?.role || 'user';
    const isOwner = role === 'owner';
    const tier = planTier(plan);

    if (!isOwner && tier === 0) {
      return res.status(403).json({ error: 'Terminal memerlukan plan berbayar. Upgrade ke Starter atau lebih tinggi.' });
    }

    const { command, cwd: reqCwd } = req.body;
    if (!command) return res.status(400).json({ error: 'command diperlukan' });

    // Block always-dangerous commands
    if (TERMINAL_BLOCKED_ALWAYS.some(b => command.includes(b))) {
      return res.status(403).json({ error: 'Command ini diblokir untuk keamanan sistem.' });
    }

    const hasFullAccess = isOwner || tier >= 3;

    // Sandbox for starter/pro
    if (!hasFullAccess) {
      if (TERMINAL_BLOCKED_SANDBOX.some(b => command.includes(b))) {
        return res.status(403).json({ error: 'Command ini diblokir pada sandbox. Upgrade ke Enterprise untuk akses penuh.' });
      }
      const allowed = TERMINAL_SANDBOX_ALLOWED.some(p => p.test(command.trim()));
      if (!allowed) {
        return res.status(403).json({ error: 'Command tidak diizinkan pada plan ' + plan + '. Lihat help untuk daftar command yang tersedia.' });
      }
    }

    const ROOT = path.join(__dirname, '..');
    const cwd  = reqCwd ? path.resolve(ROOT, reqCwd) : ROOT;

    await new Promise((resolve) => {
      const proc = spawn('/bin/sh', ['-c', command], {
        cwd: fs.existsSync(cwd) ? cwd : ROOT,
        env: { ...process.env, TERM: 'xterm' },
        timeout: 30000,
      });
      let stdout = '', stderr = '';
      proc.stdout?.on('data', d => { stdout += d.toString(); });
      proc.stderr?.on('data', d => { stderr += d.toString(); });
      proc.on('close', code => { res.json({ stdout, stderr, exitCode: code, cwd }); resolve(); });
      proc.on('error', err => { res.json({ stdout: '', stderr: err.message, exitCode: -1, cwd }); resolve(); });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Terminal capability info (for frontend to show correct UI)
app.get('/api/terminal/capabilities', requireAuth, (req, res) => {
  const plan = req.user?.plan || 'free';
  const role = req.user?.role || 'user';
  const isOwner = role === 'owner';
  const tier = planTier(plan);
  res.json({
    shell: isOwner || tier >= 1,
    fullShell: isOwner || tier >= 3,
    fileManager: isOwner || tier >= 2,
    fileWrite: isOwner,
    sandbox: !isOwner && tier >= 1 && tier < 3,
    plan, role,
  });
});

app.get('/api/terminal/files', requireAuth, async (req, res) => {
  try {
    const plan = req.user?.plan || 'free';
    const role = req.user?.role || 'user';
    const isOwner = role === 'owner';
    const tier = planTier(plan);

    if (!isOwner && tier < 2) {
      return res.status(403).json({ error: 'File Manager memerlukan plan Pro atau lebih tinggi.' });
    }

    const ROOT      = path.join(__dirname, '..');
    const reqPath   = req.query.path || '.';
    const fullPath  = path.resolve(ROOT, reqPath);

    if (!fullPath.startsWith(ROOT)) return res.status(403).json({ error: 'Akses di luar direktori project tidak diizinkan' });
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Path tidak ditemukan' });

    const stat = fs.statSync(fullPath);
    if (!stat.isDirectory()) {
      const content = fs.readFileSync(fullPath);
      if (content.length > 102400) {
        return res.json({ type: 'file', path: reqPath, content: content.slice(0, 102400).toString('utf8') + '\n... [truncated]', size: content.length });
      }
      return res.json({ type: 'file', path: reqPath, content: content.toString('utf8'), size: content.length });
    }

    // Non-owner: hide sensitive paths
    const HIDDEN_FOR_NON_OWNER = ['.env', 'tmp', 'node_modules'];
    const items = fs.readdirSync(fullPath).filter(name => {
      if (!isOwner && HIDDEN_FOR_NON_OWNER.some(h => name === h || name.startsWith('.'))) return false;
      return true;
    }).map(name => {
      try {
        const itemPath = path.join(fullPath, name);
        const itemStat = fs.statSync(itemPath);
        return { name, type: itemStat.isDirectory() ? 'dir' : 'file', size: itemStat.size, modified: itemStat.mtime.toISOString(), path: path.join(reqPath, name) };
      } catch (_) { return { name, type: 'unknown', size: 0 }; }
    }).sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    res.json({ type: 'dir', path: reqPath, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/terminal/files', requireAuth, requireOwner, (req, res) => {
  try {
    const ROOT     = path.join(__dirname, '..');
    const { filePath, content } = req.body;
    if (!filePath || content === undefined) return res.status(400).json({ error: 'filePath dan content diperlukan' });
    const full = path.resolve(ROOT, filePath);
    if (!full.startsWith(ROOT)) return res.status(403).json({ error: 'Akses ditolak' });
    const dir = path.dirname(full);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
    res.json({ success: true, path: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════
// OBJECT STORAGE — File Upload/Management
// ═══════════════════════════════════════════════

app.get('/api/storage/status', requireAuth, (req, res) => {
  res.json({ available: !!(objStorage && objStorage.isAvailable()), bucketId: process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ? 'configured' : null });
});

app.post('/api/storage/upload-url', requireAuth, async (req, res) => {
  try {
    const plan = req.user?.plan || 'free';
    const role = req.user?.role || 'user';
    if (role !== 'owner' && planTier(plan) < 1) {
      return res.status(403).json({ error: 'Upload file memerlukan plan Starter atau lebih tinggi.' });
    }
    if (!objStorage || !objStorage.isAvailable()) {
      return res.status(503).json({ error: 'Object Storage belum dikonfigurasi.' });
    }
    const { name, contentType, size } = req.body;
    if (!name) return res.status(400).json({ error: 'name diperlukan' });
    if (size > 50 * 1024 * 1024) return res.status(413).json({ error: 'File maksimal 50MB' });
    const result = await objStorage.getSignedUploadUrl({ name, contentType, userId: req.user.userId });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/storage/files', requireAuth, async (req, res) => {
  try {
    if (!objStorage || !objStorage.isAvailable()) {
      return res.json({ files: [], available: false });
    }
    const files = await objStorage.listUserObjects(req.user.userId);
    res.json({ files, available: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/storage/files', requireAuth, async (req, res) => {
  try {
    const { objectPath } = req.body;
    if (!objectPath) return res.status(400).json({ error: 'objectPath diperlukan' });
    if (!objectPath.includes(req.user.userId) && req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Tidak bisa hapus file milik user lain' });
    }
    if (!objStorage || !objStorage.isAvailable()) return res.status(503).json({ error: 'Storage tidak tersedia' });
    await objStorage.deleteObject(objectPath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/objects/:objectPath(*)', async (req, res) => {
  try {
    if (!objStorage || !objStorage.isAvailable()) return res.status(503).json({ error: 'Storage tidak tersedia' });
    await objStorage.streamObject(req.path, res);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════
// LOGS — Bot activity log viewer
// ═══════════════════════════════════════════════

app.get('/api/logs/bot', requireAuth, async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit || 100), 500);
    const offset = parseInt(req.query.offset || 0);
    const type   = req.query.type || 'all';

    if (USE_PG()) {
      try {
        let q = 'SELECT * FROM dlavie_activity_log WHERE 1=1';
        const params = [];
        if (req.user.role !== 'owner') { q += ` AND user_email = $${params.length+1}`; params.push(req.user.email); }
        if (type !== 'all') { q += ` AND event_type = $${params.length+1}`; params.push(type); }
        q += ` ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
        params.push(limit, offset);
        const result = await query(q, params);
        return res.json({ logs: result.rows, total: result.rowCount });
      } catch (_) {}
    }

    // Fallback: read from log file if exists
    const logFile = path.join(__dirname, '../tmp/activity.log');
    if (fs.existsSync(logFile)) {
      const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean).reverse();
      const parsed = lines.slice(offset, offset + limit).map(l => { try { return JSON.parse(l); } catch (_) { return { raw: l }; } });
      return res.json({ logs: parsed, total: lines.length });
    }
    res.json({ logs: [], total: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════
// ANALYTICS — Usage statistics
// ═══════════════════════════════════════════════

app.get('/api/analytics/overview', requireAuth, async (req, res) => {
  try {
    const plan = req.user?.plan || 'free';
    const role = req.user?.role || 'user';
    if (role !== 'owner' && planTier(plan) < 2) {
      return res.status(403).json({ error: 'Analytics tersedia untuk plan Pro+' });
    }

    const users = await loadUsers();
    const isOwner = role === 'owner';
    const userEmails = isOwner ? Object.keys(users) : [req.user.email];
    const totalUsers = isOwner ? Object.keys(users).length : 1;
    const paidUsers = isOwner ? Object.values(users).filter(u => u.plan !== 'free').length : null;
    const totalTokens = isOwner ? Object.values(users).reduce((s, u) => s + (u.tokens || 0), 0) : (users[req.user.email]?.tokens || 0);
    const tokensUsedToday = isOwner
      ? Object.values(users).reduce((s, u) => s + (u.tokenUsedToday || 0), 0)
      : (users[req.user.email]?.tokenUsedToday || 0);
    const commandsToday = isOwner
      ? Object.values(users).reduce((s, u) => s + (u.commandsToday || 0), 0)
      : (users[req.user.email]?.commandsToday || 0);

    let waStatus = { connected: false };
    try { waStatus = require('../src/bot').getConnectionState(); } catch (_) {}

    let memInfo = {};
    try {
      const mem = process.memoryUsage();
      memInfo = { heapUsedMB: Math.round(mem.heapUsed/1024/1024), heapTotalMB: Math.round(mem.heapTotal/1024/1024), rssMB: Math.round(mem.rss/1024/1024) };
    } catch (_) {}

    res.json({
      summary: { totalUsers: isOwner ? totalUsers : undefined, paidUsers: isOwner ? paidUsers : undefined, totalTokens, tokensUsedToday, commandsToday },
      waStatus,
      memory: memInfo,
      uptime: Math.round(process.uptime()),
      node: process.version,
      storageAvailable: !!(objStorage && objStorage.isAvailable()),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════
// NOTIFICATIONS — Notification center
// ═══════════════════════════════════════════════

const _notifs = new Map();

app.get('/api/notifications', requireAuth, async (req, res) => {
  const key = req.user.userId;
  const all = _notifs.get(key) || [];
  const system = [
    { id: 'sys-1', type: 'info', title: 'DLavie OS v2.0', message: 'Object Storage, Terminal multi-tier, dan File Manager kini aktif.', read: false, createdAt: Date.now() - 3600000 },
  ];
  res.json({ notifications: [...all, ...system].slice(0, 50) });
});

app.put('/api/notifications/:id/read', requireAuth, async (req, res) => {
  const key = req.user.userId;
  const all = _notifs.get(key) || [];
  const updated = all.map(n => n.id === req.params.id ? { ...n, read: true } : n);
  _notifs.set(key, updated);
  res.json({ success: true });
});

app.delete('/api/notifications', requireAuth, async (req, res) => {
  _notifs.set(req.user.userId, []);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════
// TOKEN MANAGEMENT
// ═══════════════════════════════════════════════

app.get('/api/tokens', requireAuth, async (req, res) => {
  const users = await loadUsers();
  const user  = users[req.user.email];
  res.json({
    balance: user?.tokens || 0,
    plan: user?.plan || 'free',
    history: user?.tokenHistory || [],
    usageToday: user?.tokenUsedToday || 0,
    packages: cfg.payment?.tokenPackages || [
      { id: 'token_5k',   tokens: 5000,   priceIdr: 10000,  label: '5K Token' },
      { id: 'token_15k',  tokens: 15000,  priceIdr: 25000,  label: '15K Token' },
      { id: 'token_50k',  tokens: 50000,  priceIdr: 70000,  label: '50K Token' },
      { id: 'token_150k', tokens: 150000, priceIdr: 180000, label: '150K Token' },
    ],
    qrisImage: cfg.payment?.qris?.imageUrl || process.env.QRIS_IMAGE_URL || '',
  });
});

// Topup request — supports packageId OR custom amount (1 IDR = 1 token)
app.post('/api/tokens/topup', requireAuth, async (req, res) => {
  try {
    const { packageId, customAmount } = req.body;

    const packages = cfg.payment?.tokenPackages || [
      { id: 'token_5k',   tokens: 5000,   priceIdr: 5000 },
      { id: 'token_15k',  tokens: 15000,  priceIdr: 15000 },
      { id: 'token_50k',  tokens: 50000,  priceIdr: 50000 },
      { id: 'token_150k', tokens: 150000, priceIdr: 150000 },
    ];

    let tokens, priceIdr, label;

    if (customAmount) {
      // Custom amount: 1 IDR = 1 token, minimum 1000 IDR
      const amt = parseInt(customAmount);
      if (isNaN(amt) || amt < 1000) return res.status(400).json({ error: 'Minimum topup Rp 1.000 (= 1.000 token)' });
      if (amt > 10000000) return res.status(400).json({ error: 'Maximum topup Rp 10.000.000' });
      tokens   = amt;  // 1 IDR = 1 token
      priceIdr = amt;
      label    = `Custom ${amt.toLocaleString('id-ID')} Token`;
    } else if (packageId) {
      const pkg = packages.find(p => p.id === packageId);
      if (!pkg) return res.status(400).json({ error: 'Package tidak valid' });
      tokens   = pkg.tokens;
      priceIdr = pkg.priceIdr;
      label    = pkg.label;
    } else {
      return res.status(400).json({ error: 'packageId atau customAmount diperlukan' });
    }

    // Create payment transaction
    const tx = await createPaymentTx({
      userEmail: req.user.email,
      waUserId: req.body.waUserId || '',
      type: 'topup',
      plan: null,
      amount: priceIdr,
      amountTokens: tokens,
      nama: req.user.name,
    });

    const qrisImage = cfg.payment?.qris?.imageUrl || process.env.QRIS_IMAGE_URL || '';
    res.json({
      success: true,
      strukId: tx?.struk_id || 'ERR',
      tokens,
      priceIdr,
      label,
      message: `Topup ${tokens.toLocaleString()} token (Rp ${priceIdr.toLocaleString('id-ID')}) berhasil dibuat. Upload bukti pembayaran untuk konfirmasi.`,
      qrisImage,
      note: '1 IDR = 1 Token. Konfirmasi otomatis setelah upload bukti.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════
// PRICING
// ═══════════════════════════════════════════════

app.get('/api/pricing', (req, res) => {
  const plans = cfg.payment?.plans || {
    free:       { name: 'Free',       priceIdr: 0,      tokens: 5000,   maxBots: 1,  queuePriority: false, features: ['1 Bot', '5K Token/bulan', 'Basic Commands', 'Antrian Queue', 'Community Support'] },
    starter:    { name: 'Starter',    priceIdr: 29000,  tokens: 25000,  maxBots: 3,  queuePriority: false, features: ['3 Bot', '25K Token/bulan', 'Plugin Marketplace', 'Auto-Fix Basic', 'Antrian Queue', 'Email Support'] },
    pro:        { name: 'Pro',        priceIdr: 79000,  tokens: 100000, maxBots: 10, queuePriority: true,  features: ['10 Bot', '100K Token/bulan', 'AI Auto-Fix', 'Shell Access', 'GitHub Plugin', 'NO Queue ⚡', 'Advanced Monitor', 'Priority Support'] },
    enterprise: { name: 'Enterprise', priceIdr: 199000, tokens: -1,     maxBots: -1, queuePriority: true,  features: ['Unlimited Bot', 'Unlimited Token', 'Custom Plugin', 'White Label', 'Full API', 'NO Queue ⚡', 'Dedicated Support'] },
  };
  res.json({ plans });
});

// ═════════════════════════════════════════════════════
// PAYMENT ROUTES
// ═════════════════════════════════════════════════════

// Buat transaksi baru
app.post('/api/payment/create', requireAuth, async (req, res) => {
  try {
    const { type, plan, amount, amountTokens, nama } = req.body;
    if (!type || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Tipe, amount, dan amount > 0 diperlukan' });
    }
    const tx = await createPaymentTx({
      userEmail: req.user.email,
      waUserId: req.body.waUserId || '',
      type, plan: plan || null, amount, amountTokens: amountTokens || null, nama: nama || req.user.name,
    });
    if (!tx) return res.status(500).json({ error: 'Gagal membuat transaksi' });
    res.json({ success: true, strukId: tx.struk_id, expiredAt: tx.expired_at, type, amount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload bukti pembayaran
app.post('/api/payment/proof', requireAuth, upload.single('proof'), async (req, res) => {
  try {
    const { strukId } = req.body;
    if (!strukId || !req.file) {
      return res.status(400).json({ error: 'strukId dan file bukti diperlukan' });
    }
    const result = await uploadProof(strukId, req.file.buffer, req.file.originalname, req.file.mimetype);
    if (result.error) return res.status(400).json({ error: result.error });

    // Notify owner
    const tx = result.tx;
    notifyOwner(strukId, tx.type, tx.amount, tx.nama, tx.user_email, tx.plan);

    res.json({ success: true, proofUrl: result.proofUrl, strukId, status: 'paid' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cek status transaksi
app.get('/api/payment/status/:strukId', requireAuth, async (req, res) => {
  try {
    const result = await cekStruk(req.params.strukId);
    if (result.error) return res.status(404).json({ error: result.error });
    res.json(result.info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Riwayat transaksi user
app.get('/api/payment/history', requireAuth, async (req, res) => {
  try {
    const txs = await getPaymentsByUser(req.user.email, 20);
    res.json({ transactions: txs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Top-up preset
app.get('/api/payment/topup-options', (req, res) => {
  res.json({
    options: [
      { tokens: 1000,   priceIdr: 5000 },
      { tokens: 5000,   priceIdr: 20000 },
      { tokens: 25000,  priceIdr: 75000 },
      { tokens: 100000, priceIdr: 250000 },
    ],
    qrisUrl: '/img/qris.png',
  });
});

// ═══════════════════════════════════════════════
// PUBLIC: Maintenance & Popup status
// ═══════════════════════════════════════════════

app.get('/api/public/maintenance', (req, res) => {
  res.json(loadMaintenanceData());
});

app.get('/api/public/popup', (req, res) => {
  res.json(loadPopupData());
});

// ═══════════════════════════════════════════════
// ADMIN: Maintenance & Popup control (Auth required)
// ═══════════════════════════════════════════════

app.get('/api/admin/maintenance', requireAuth, (req, res) => {
  res.json(loadMaintenanceData());
});

app.put('/api/admin/maintenance', requireAuth, (req, res) => {
  try {
    const current = loadMaintenanceData();
    const updated = { ...current, ...req.body, updatedAt: Date.now() };
    saveMaintenanceData(updated);
    res.json({ success: true, maintenance: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/popup', requireAuth, (req, res) => {
  res.json(loadPopupData());
});

app.put('/api/admin/popup', requireAuth, (req, res) => {
  try {
    const current = loadPopupData();
    const updated = { ...current, ...req.body, updatedAt: Date.now() };
    savePopupData(updated);
    res.json({ success: true, popup: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// HTML PAGES — Serve SPA views
// ═══════════════════════════════════════════════

const VIEWS = ['/', '/login', '/register', '/dashboard', '/bots', '/tokens', '/pricing', '/settings', '/payment', '/topup', '/terminal', '/customize', '/maintenance', '/files', '/logs', '/analytics'];
for (const route of VIEWS) {
  app.get(route, (req, res) => {
    const pageName = route === '/' ? 'landing' : route.slice(1);
    const filePath = path.join(__dirname, 'views', `${pageName}.html`);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.sendFile(path.join(__dirname, 'views', 'landing.html'));
    }
  });
}

// ═══════════════════════════════════════════════
// BOT MODE (dev@dlavie.com only)
// ═══════════════════════════════════════════════

app.get('/botmode', requireAuth, (req, res) => {
  if (!botMode?.canChangeBotMode(req.user.email)) {
    return res.redirect('/settings');
  }
  res.sendFile(path.join(__dirname, 'views', 'botmode.html'));
});

app.get('/api/botmode', requireAuth, (req, res) => {
  if (!botMode?.canChangeBotMode(req.user.email)) {
    return res.status(403).json({ error: 'Akses ditolak' });
  }
  try {
    const state = botMode?.getBotMode ? { mode: botMode.getBotMode() } : { mode: 'multibot' };
    res.json({ ...state, modes: botMode?.VALID_MODES || ['multibot','game'] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/botmode', requireAuth, (req, res) => {
  if (!botMode?.canChangeBotMode(req.user.email)) {
    return res.status(403).json({ error: 'Akses ditolak. Hanya dev@dlavie.com yang bisa mengubah Bot Mode.' });
  }
  try {
    const { mode } = req.body;
    if (!mode) return res.status(400).json({ error: 'mode diperlukan' });
    const state = botMode.setBotMode(mode, req.user.email);
    console.log(`[DLAVIE][BOTMODE] Mode diubah ke "${mode}" oleh ${req.user.email}`);
    res.json({ success: true, ...state });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Ping (ultra-light, no auth/middleware — for UptimeRobot / self-ping) ───
app.get('/ping', (req, res) => res.status(200).send('pong'));

// ─── Public status (health detail for monitoring) ───
app.get('/api/public/status', (req, res) => {
  let wa = { connected: false, connecting: false };
  let ka = { uptime: '0s', pingCount: 0 };

  try { wa = require('../src/bot').getConnectionState(); } catch (_) {}
  try { ka = require('../src/core/keepAlive').getStatus(); } catch (_) {}

  const mem = process.memoryUsage();
  res.json({
    status:    'ok',
    service:   'DLavie OS',
    version:   '2.0.0',
    time:      new Date().toISOString(),
    wa: {
      connected:  wa.connected,
      connecting: wa.connecting,
      retries:    `${wa.retryCount}/${wa.maxRetries}`,
      bot:        wa.botName || null,
    },
    keepAlive: {
      uptime:    ka.uptime,
      pingCount: ka.pingCount,
      pingFails: ka.pingFails,
      waStatus:  ka.waStatus,
    },
    memory: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB:      Math.round(mem.rss / 1024 / 1024),
    },
    node: process.version,
  });
});

// ─── Health ───
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'DLavie OS Web', time: new Date().toISOString() }));

// ─── 404 fallback ───
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Endpoint tidak ditemukan' });
  res.redirect('/');
});

// ─── Error handler ───
app.use((err, req, res, next) => {
  console.error('[DLAVIE][WEB] Error:', err.message);
  if (req.path.startsWith('/api/')) return res.status(500).json({ error: 'Server error' });
  res.redirect('/');
});

// ─── Start server ───
function startWebServer() {
  app.listen(WEB_PORT, '0.0.0.0', () => {
    console.log(`[DLAVIE][WEB] Dashboard running on http://0.0.0.0:${WEB_PORT}`);
  });
}

module.exports = { startWebServer };
