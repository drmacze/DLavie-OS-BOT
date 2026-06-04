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

let cfg;
try { cfg = require('../DLavieConfig'); } catch (_) { cfg = {}; }
try { require('dotenv').config(); } catch (_) {}

const JWT_SECRET   = process.env.JWT_SECRET      || cfg.auth?.jwtSecret || 'dlavie-web-secret-change-me';
const WEB_PORT     = parseInt(process.env.WEB_PORT|| '') || cfg.web?.port || 5000;
const API_BASE_URL = `http://localhost:${process.env.API_PORT || 8080}`;

// ─── Storage local (fallback tanpa Supabase) ───
const USERS_FILE = path.join(__dirname, '../tmp/web_users.json');
function loadUsers() {
  try { if (fs.existsSync(USERS_FILE)) return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch (_) {}
  return {};
}
function saveUsers(u) {
  try { fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2)); } catch (_) {}
}

// ─── App ───
const app = express();

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

// ─── Rate limiting ───
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.' } });
const apiLimiter  = rateLimit({ windowMs: 60 * 1000, max: 100 });
app.use('/api/auth', authLimiter);
app.use('/api/', apiLimiter);

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

    const users = loadUsers();
    const emailKey = email.toLowerCase().trim();

    if (users[emailKey]) return res.status(409).json({ error: 'Email sudah terdaftar' });

    const hash = await bcrypt.hash(password, 12);
    const userId = 'usr_' + crypto.randomBytes(12).toString('hex');
    users[emailKey] = {
      userId, email: emailKey, name,
      passwordHash: hash,
      plan: 'free',
      tokens: 5000,
      createdAt: Date.now(),
      lastLogin: null,
      bots: [],
    };
    saveUsers(users);

    const token = jwt.sign({ userId, email: emailKey, name, plan: 'free' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { userId, email: emailKey, name, plan: 'free', tokens: 5000 } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib' });

    const users = loadUsers();
    const emailKey = email.toLowerCase().trim();
    const user = users[emailKey];

    if (!user) return res.status(401).json({ error: 'Email atau password salah' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Email atau password salah' });

    user.lastLogin = Date.now();
    saveUsers(users);

    const token = jwt.sign(
      { userId: user.userId, email: emailKey, name: user.name, plan: user.plan },
      JWT_SECRET, { expiresIn: '7d' }
    );
    res.json({
      success: true, token,
      user: { userId: user.userId, email: emailKey, name: user.name, plan: user.plan, tokens: user.tokens }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user
app.get('/api/auth/me', requireAuth, (req, res) => {
  const users = loadUsers();
  const user  = users[req.user.email];
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  const { passwordHash, ...safe } = user;
  res.json({ user: safe });
});

// Update profile
app.put('/api/auth/profile', requireAuth, async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const users = loadUsers();
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

    saveUsers(users);
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
app.post('/api/bot/code', requireAuth, (req, res) => {
  try {
    const webAuth = getWebAuth();
    const { code, expiresAt } = webAuth.generateBotCode(req.user.userId, req.user.email);
    res.json({ success: true, code, expiresAt, expiresInMin: 10 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check login status (apakah WA bot user sudah login)
app.get('/api/bot/sessions', requireAuth, (req, res) => {
  const webAuth  = getWebAuth();
  const sessions = webAuth.getActiveSessions().filter(s => {
    const users = loadUsers();
    return users[req.user.email]?.userId === req.user.userId;
  });
  res.json({ sessions });
});

// ═══════════════════════════════════════════════
// DASHBOARD STATS
// ═══════════════════════════════════════════════

app.get('/api/dashboard', requireAuth, (req, res) => {
  try {
    const users = loadUsers();
    const user  = users[req.user.email];
    const webAuth = getWebAuth();
    const CONN_FILE = path.join(__dirname, '../tmp/bot_connections.json');
    let connections = {};
    try { if (fs.existsSync(CONN_FILE)) connections = JSON.parse(fs.readFileSync(CONN_FILE, 'utf8')); } catch (_) {}
    const myBots = Object.values(connections).filter(c => c.ownerUserId === user?.userId && c.botId);
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

app.get('/api/bots', requireAuth, (req, res) => {
  const CONN_FILE = path.join(__dirname, '../tmp/bot_connections.json');
  let connections = {};
  try { if (fs.existsSync(CONN_FILE)) connections = JSON.parse(fs.readFileSync(CONN_FILE, 'utf8')); } catch (_) {}
  const myBots = Object.values(connections).filter(c => c.ownerUserId === req.user.userId && c.botId);
  res.json({ bots: myBots });
});

app.delete('/api/bots/:botId', requireAuth, (req, res) => {
  const CONN_FILE = path.join(__dirname, '../tmp/bot_connections.json');
  let connections = {};
  try { if (fs.existsSync(CONN_FILE)) connections = JSON.parse(fs.readFileSync(CONN_FILE, 'utf8')); } catch (_) {}
  const bot = connections[req.params.botId];
  if (!bot || bot.ownerUserId !== req.user.userId) return res.status(404).json({ error: 'Bot tidak ditemukan' });
  delete connections[req.params.botId];
  try { fs.writeFileSync(CONN_FILE, JSON.stringify(connections, null, 2)); } catch (_) {}
  res.json({ success: true });
});

// ═══════════════════════════════════════════════
// TOKEN MANAGEMENT
// ═══════════════════════════════════════════════

app.get('/api/tokens', requireAuth, (req, res) => {
  const users = loadUsers();
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

// Topup request
app.post('/api/tokens/topup', requireAuth, (req, res) => {
  const { packageId, amount } = req.body;
  const reqId = 'topup_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
  // Simpan request topup (admin manual confirm)
  const TOPUP_FILE = path.join(__dirname, '../tmp/topup_requests.json');
  let requests = [];
  try { if (fs.existsSync(TOPUP_FILE)) requests = JSON.parse(fs.readFileSync(TOPUP_FILE, 'utf8')); } catch (_) {}
  requests.push({ reqId, userId: req.user.userId, email: req.user.email, packageId, amount, status: 'pending', createdAt: Date.now() });
  try { fs.writeFileSync(TOPUP_FILE, JSON.stringify(requests, null, 2)); } catch (_) {}

  const qrisImage = cfg.payment?.qris?.imageUrl || process.env.QRIS_IMAGE_URL || '';
  res.json({
    success: true,
    reqId,
    message: 'Topup request dibuat. Transfer sesuai nominal dan hubungi admin dengan ID topup.',
    qrisImage,
  });
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

// ═══════════════════════════════════════════════
// HTML PAGES — Serve SPA views
// ═══════════════════════════════════════════════

const VIEWS = ['/', '/login', '/register', '/dashboard', '/bots', '/tokens', '/pricing', '/settings'];
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
