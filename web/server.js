/**
 * DLavie OS — Web Dashboard Server v3.0
 * NEW: Popup system, Maintenance mode, File Manager, Terminal WS, SSH WS
 * NEW: Owner-only guard, Admin panel API
 * Port: 5000
 */
'use strict';

const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const http        = require('http');
const path        = require('path');
const fs          = require('fs');
const jwt         = require('jsonwebtoken');
const bcrypt      = require('bcryptjs');
const crypto      = require('crypto');
const rateLimit   = require('express-rate-limit');
const compression = require('compression');
const { WebSocketServer } = require('ws');
const { spawn }   = require('child_process');
const { getWebAuth } = require('../src/auth/webAuth');

let cfg = {};
try { cfg = require('../DLavieConfig'); } catch (_) {}
try { require('dotenv').config(); } catch (_) {}

const JWT_SECRET = process.env.JWT_SECRET    || cfg.auth?.jwtSecret || 'dlavie-web-secret-change-me';
const WEB_PORT   = parseInt(process.env.WEB_PORT || '') || cfg.web?.port || 5000;
const OWNER_NUM  = process.env.OWNER_NUMBER  || cfg.bot?.ownerNumber || '62882007437216';

function getDashUrl() {
  if (process.env.DASHBOARD_URL)    return process.env.DASHBOARD_URL;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return cfg.web?.dashboardUrl || 'https://dlavie-os.replit.app';
}

// ─── File Storage ───
const TMP          = path.join(__dirname, '../tmp');
const PROJECT_ROOT = path.resolve(__dirname, '..');
function ensureTmp() { if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true }); }

const USERS_FILE       = path.join(TMP, 'web_users.json');
const CONNS_FILE       = path.join(TMP, 'bot_connections.json');
const PAYMENTS_FILE    = path.join(TMP, 'payments.json');
const POPUP_FILE       = path.join(TMP, 'popup.json');
const MAINTENANCE_FILE = path.join(TMP, 'maintenance.json');

function loadJSON(file, def) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) {}
  return def;
}
function saveJSON(file, data) {
  try { ensureTmp(); fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch (_) {}
}

const loadUsers    = () => loadJSON(USERS_FILE, {});
const saveUsers    = (u) => saveJSON(USERS_FILE, u);
const loadConns    = () => loadJSON(CONNS_FILE, {});
const saveConns    = (c) => saveJSON(CONNS_FILE, c);
const loadPayments = () => loadJSON(PAYMENTS_FILE, []);
const savePayments = (p) => saveJSON(PAYMENTS_FILE, p);
const loadPopup    = () => loadJSON(POPUP_FILE, { active: false, title: '', description: '', type: 'info', createdAt: null });
const savePopup    = (p) => saveJSON(POPUP_FILE, p);
const loadMaint    = () => loadJSON(MAINTENANCE_FILE, { bot: { active: false, description: '' }, panel: { active: false, description: '', scheduledAt: null } });
const saveMaint    = (m) => saveJSON(MAINTENANCE_FILE, m);

// ─── Security: Safe path for file manager ───
function safePath(inputPath) {
  if (!inputPath) throw new Error('Path diperlukan');
  const normalised = inputPath.startsWith('/') ? inputPath : '/' + inputPath;
  const resolved   = path.resolve(PROJECT_ROOT, '.' + normalised);
  if (!resolved.startsWith(PROJECT_ROOT)) throw new Error('Akses ditolak: path tidak valid');
  return resolved;
}

// ─── App ───
const app = express();
app.use(compression());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Rate limiting ───
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 25, message: { error: 'Terlalu banyak percobaan.' } });
const apiLimiter  = rateLimit({ windowMs: 60 * 1000, max: 300 });
app.use('/api/auth', authLimiter);
app.use('/api/', apiLimiter);

// ─── Maintenance Middleware (before JWT) ───
const MAINT_BYPASS_PATHS = ['/api/', '/css/', '/js/', '/health', '/maintenance'];
app.use((req, res, next) => {
  const bypass = MAINT_BYPASS_PATHS.some(p => req.path.startsWith(p));
  if (bypass) return next();
  const m = loadMaint();
  if (!m.panel?.active) return next();
  // Allow owner with token in URL
  const token = req.query.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (isOwnerUser(decoded.userId)) return next();
    } catch (_) {}
  }
  return res.sendFile(path.join(__dirname, 'views', 'maintenance.html'));
});

// ─── JWT Middleware ───
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.headers['x-token'];
  if (!token) return res.status(401).json({ error: 'Token diperlukan' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch (_) { return res.status(401).json({ error: 'Token tidak valid atau sudah expire' }); }
}

// ─── Owner Helpers ───
function getUserBots(userId) {
  const conns = loadConns();
  return Object.values(conns).filter(c => (c.ownerWebUserId === userId || c.ownerUserId === userId) && c.botId);
}

function isOwnerUser(userId) {
  const users = loadUsers();
  const user  = Object.values(users).find(u => u.userId === userId);
  if (user?.role === 'owner') return true;
  try {
    const webAuth  = getWebAuth();
    const sessions = webAuth.getActiveSessions().filter(s => s.webUserId === userId);
    return sessions.some(s => {
      const wa = String(s.waUserId || '').replace(/\D/g, '');
      const ow = String(OWNER_NUM || '').replace(/\D/g, '');
      return wa && ow && wa.includes(ow);
    });
  } catch (_) { return false; }
}

function requireOwner(req, res, next) {
  if (!isOwnerUser(req.user.userId)) return res.status(403).json({ error: 'Akses hanya untuk owner' });
  next();
}


// ═══════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, password, dan nama wajib diisi' });
    if (password.length < 8) return res.status(400).json({ error: 'Password minimal 8 karakter' });

    const users    = loadUsers();
    const emailKey = email.toLowerCase().trim();
    if (users[emailKey]) return res.status(409).json({ error: 'Email sudah terdaftar' });

    const hash      = await bcrypt.hash(password, 12);
    const userId    = 'usr_' + crypto.randomBytes(12).toString('hex');
    const accessKey = 'dlk_' + crypto.randomBytes(24).toString('hex');

    // First user ever becomes owner
    const isFirst = Object.keys(users).length === 0;

    users[emailKey] = {
      userId, email: emailKey, name, passwordHash: hash,
      plan: 'free', tokens: 5000, accessKey,
      role: isFirst ? 'owner' : 'user',
      createdAt: Date.now(), lastLogin: null,
      tokenHistory: [], recentActivity: [],
    };
    saveUsers(users);

    const token = jwt.sign({ userId, email: emailKey, name, plan: 'free' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { userId, email: emailKey, name, plan: 'free', tokens: 5000, accessKey, isOwner: isFirst } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib' });

    const users    = loadUsers();
    const emailKey = email.toLowerCase().trim();
    const user     = users[emailKey];
    if (!user) return res.status(401).json({ error: 'Email atau password salah' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Email atau password salah' });

    user.lastLogin = Date.now();
    saveUsers(users);

    const ownerStatus = isOwnerUser(user.userId);
    const token = jwt.sign({ userId: user.userId, email: emailKey, name: user.name, plan: user.plan }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      success: true, token,
      user: { userId: user.userId, email: emailKey, name: user.name, plan: user.plan, tokens: user.tokens, accessKey: user.accessKey, isOwner: ownerStatus }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const users = loadUsers();
  const user  = users[req.user.email];
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  const { passwordHash, ...safe } = user;
  res.json({ user: { ...safe, isOwner: isOwnerUser(req.user.userId) } });
});

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
      if (newPassword.length < 8) return res.status(400).json({ error: 'Password minimal 8 karakter' });
      user.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    saveUsers(users);
    const { passwordHash, ...safe } = user;
    res.json({ success: true, user: { ...safe, isOwner: isOwnerUser(req.user.userId) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ═══════════════════════════════════════════════
// BOT CODE
// ═══════════════════════════════════════════════

app.post('/api/bot/code', requireAuth, (req, res) => {
  try {
    const webAuth = getWebAuth();
    const { code, expiresAt } = webAuth.generateBotCode(req.user.userId, req.user.email);
    res.json({ success: true, code, expiresAt, expiresInMin: 10, dashUrl: getDashUrl() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/bot/sessions', requireAuth, (req, res) => {
  const webAuth  = getWebAuth();
  const sessions = webAuth.getActiveSessions().filter(s => s.webUserId === req.user.userId);
  res.json({ sessions });
});


// ═══════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════

app.get('/api/dashboard', requireAuth, (req, res) => {
  try {
    const users      = loadUsers();
    const user       = users[req.user.email];
    const myBots     = getUserBots(req.user.userId);
    const activeBots = myBots.filter(b => b.status === 'active').length;
    const ownerFlag  = isOwnerUser(req.user.userId);

    res.json({
      user: { name: user?.name, email: user?.email, plan: user?.plan, tokens: user?.tokens || 0, accessKey: user?.accessKey, isOwner: ownerFlag },
      stats: {
        totalBots: myBots.length, activeBots,
        tokenBalance:    user?.tokens || 0,
        tokenUsedToday:  user?.tokenUsedToday || 0,
        commandsToday:   user?.commandsToday || 0,
        paymentsCount:   loadPayments().filter(p => p.userId === req.user.userId).length,
      },
      bots: myBots.slice(0, 5),
      recentActivity: (user?.recentActivity || []).slice(0, 10),
      dashUrl: getDashUrl(),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ═══════════════════════════════════════════════
// BOTS MANAGEMENT
// ═══════════════════════════════════════════════

app.get('/api/bots', requireAuth, (req, res) => {
  const myBots = getUserBots(req.user.userId);
  res.json({ bots: myBots, dashUrl: getDashUrl() });
});

app.delete('/api/bots/:botId', requireAuth, (req, res) => {
  const conns = loadConns();
  const bot   = conns[req.params.botId];
  if (!bot || (bot.ownerWebUserId !== req.user.userId && bot.ownerUserId !== req.user.userId)) {
    return res.status(404).json({ error: 'Bot tidak ditemukan' });
  }
  delete conns[req.params.botId];
  saveConns(conns);
  res.json({ success: true });
});

app.get('/api/bots/:botId/settings', requireAuth, (req, res) => {
  const conns = loadConns();
  const bot   = conns[req.params.botId];
  if (!bot || (bot.ownerWebUserId !== req.user.userId && bot.ownerUserId !== req.user.userId)) {
    return res.status(404).json({ error: 'Bot tidak ditemukan' });
  }
  res.json({ settings: bot.settings || {}, botId: bot.botId, botNumber: bot.botNumber, plan: bot.plan });
});

app.put('/api/bots/:botId/settings', requireAuth, (req, res) => {
  const conns = loadConns();
  const bot   = conns[req.params.botId];
  if (!bot || (bot.ownerWebUserId !== req.user.userId && bot.ownerUserId !== req.user.userId)) {
    return res.status(404).json({ error: 'Bot tidak ditemukan' });
  }
  const allowed  = ['name', 'prefix', 'bio', 'language', 'timezone', 'menuTitle', 'menuFooter', 'welcomeMsg', 'antiSpam'];
  const settings = bot.settings || {};
  for (const key of allowed) { if (req.body[key] !== undefined) settings[key] = req.body[key]; }
  bot.settings = settings;
  conns[req.params.botId] = bot;
  saveConns(conns);
  res.json({ success: true, settings });
});

app.post('/api/bots/:botId/relay', requireAuth, (req, res) => {
  const conns = loadConns();
  const bot   = conns[req.params.botId];
  if (!bot || (bot.ownerWebUserId !== req.user.userId && bot.ownerUserId !== req.user.userId)) {
    return res.status(404).json({ error: 'Bot tidak ditemukan' });
  }
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'Command diperlukan' });
  if (!bot.pendingRelays) bot.pendingRelays = [];
  bot.pendingRelays.push({ command, ts: Date.now(), reqId: crypto.randomBytes(4).toString('hex') });
  conns[req.params.botId] = bot;
  saveConns(conns);
  res.json({ success: true, message: `Relay "${command}" diantrekan untuk bot ${req.params.botId}` });
});


// ═══════════════════════════════════════════════
// TOKEN MANAGEMENT
// ═══════════════════════════════════════════════

app.get('/api/tokens', requireAuth, (req, res) => {
  const users = loadUsers();
  const user  = users[req.user.email];
  res.json({
    balance:    user?.tokens || 0,
    plan:       user?.plan || 'free',
    history:    (user?.tokenHistory || []).slice(0, 20),
    usageToday: user?.tokenUsedToday || 0,
    packages: cfg.payment?.tokenPackages || [
      { id: 'token_5k',   tokens: 5000,   priceIdr: 10000,  label: '5K Token',   bonus: '' },
      { id: 'token_15k',  tokens: 15000,  priceIdr: 25000,  label: '15K Token',  bonus: '+2K bonus' },
      { id: 'token_50k',  tokens: 50000,  priceIdr: 70000,  label: '50K Token',  bonus: '+10K bonus' },
      { id: 'token_150k', tokens: 150000, priceIdr: 180000, label: '150K Token', bonus: '+25K bonus' },
    ],
    qrisImage: cfg.payment?.qris?.imageUrl || process.env.QRIS_IMAGE_URL || '',
    ownerWa:   OWNER_NUM,
  });
});


// ═══════════════════════════════════════════════
// PAYMENT SYSTEM
// ═══════════════════════════════════════════════

app.post('/api/payment/initiate', requireAuth, (req, res) => {
  try {
    const { type, packageId, planName, amount, tokens } = req.body;
    if (!type) return res.status(400).json({ error: 'type diperlukan (token|plan)' });

    const users    = loadUsers();
    const user     = users[req.user.email];
    const payments = loadPayments();

    const hasPending = payments.find(p => p.userId === req.user.userId && (p.status === 'pending_proof' || p.status === 'proof_submitted'));
    if (hasPending) {
      return res.json({ success: true, payId: hasPending.payId, existing: true, message: 'Masih ada payment pending.', expiresAt: hasPending.expiresAt, qrisImage: cfg.payment?.qris?.imageUrl || process.env.QRIS_IMAGE_URL || '' });
    }

    const d = new Date();
    const datePart = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    const payId = `PAY_${datePart}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const packages = cfg.payment?.tokenPackages || [
      { id: 'token_5k', tokens: 5000, priceIdr: 10000 }, { id: 'token_15k', tokens: 15000, priceIdr: 25000 },
      { id: 'token_50k', tokens: 50000, priceIdr: 70000 }, { id: 'token_150k', tokens: 150000, priceIdr: 180000 },
    ];
    const plans = { free: { tokens: 5000, priceIdr: 0 }, starter: { tokens: 25000, priceIdr: 29000 }, pro: { tokens: 100000, priceIdr: 79000 }, enterprise: { tokens: 500000, priceIdr: 199000 } };

    let payAmount = amount || 0;
    let payTokens = tokens || 0;
    if (type === 'token' && packageId) { const pkg = packages.find(p => p.id === packageId); if (pkg) { payAmount = pkg.priceIdr; payTokens = pkg.tokens; } }
    else if (type === 'plan' && planName) { const plan = plans[planName]; if (plan) { payAmount = plan.priceIdr; payTokens = plan.tokens; } }

    const newPayment = {
      payId, type, packageId, planName: type === 'plan' ? planName : undefined,
      userId: req.user.userId, email: req.user.email, name: user?.name || '',
      amount: payAmount, tokens: payTokens,
      status: 'pending_proof', createdAt: Date.now(), expiresAt: Date.now() + (5 * 60 * 1000),
      buyerWaNumber: null, proofImage: null, buyerName: null,
    };

    try {
      const webAuth  = getWebAuth();
      const sessions = webAuth.getActiveSessions().filter(s => s.webUserId === req.user.userId);
      if (sessions.length > 0) newPayment.buyerWaNumber = sessions[0].waUserId;
    } catch(_){}

    payments.push(newPayment);
    savePayments(payments);

    res.json({ success: true, payId, amount: payAmount, tokens: payTokens, expiresAt: newPayment.expiresAt, qrisImage: cfg.payment?.qris?.imageUrl || process.env.QRIS_IMAGE_URL || '', ownerWa: OWNER_NUM, dashUrl: getDashUrl() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/payment/proof', requireAuth, (req, res) => {
  try {
    const { payId, buyerName, proofImage } = req.body;
    if (!payId || !buyerName) return res.status(400).json({ error: 'payId dan buyerName wajib' });
    const payments = loadPayments();
    const idx = payments.findIndex(p => p.payId === payId && p.userId === req.user.userId);
    if (idx === -1) return res.status(404).json({ error: 'Payment tidak ditemukan' });
    const pay = payments[idx];
    if (pay.status !== 'pending_proof') return res.status(400).json({ error: `Status payment: ${pay.status}` });
    if (Date.now() > pay.expiresAt + (30 * 60 * 1000)) { payments[idx].status = 'expired'; savePayments(payments); return res.status(400).json({ error: 'Payment expired.' }); }

    payments[idx].status = 'proof_submitted';
    payments[idx].buyerName = buyerName;
    payments[idx].proofImage = proofImage || null;
    payments[idx].submittedAt = Date.now();
    savePayments(payments);

    try {
      const { getEngine } = require('../src/core/engine');
      const engine = getEngine();
      const sock = engine.getSock?.();
      if (sock) {
        const typeLabel = pay.type === 'plan' ? `Upgrade Plan ${pay.planName?.toUpperCase()}` : `Topup ${Number(pay.tokens).toLocaleString('id-ID')} Token`;
        sock.sendMessage(`${OWNER_NUM}@s.whatsapp.net`, {
          text: `💳 *Payment Proof Submitted!*\n\nID: \`${payId}\`\nTipe: ${typeLabel}\nNominal: Rp ${Number(pay.amount).toLocaleString('id-ID')}\nPembeli: ${buyerName} (${pay.email})\nWaktu: ${new Date().toLocaleString('id-ID')}\n\n*Approve:* \`!approve ${payId}${pay.type === 'token' ? ` ${pay.tokens}` : ''}\`\n*Reject:* \`!reject ${payId} [alasan]\`\n\n🌐 ${getDashUrl()}/admin`
        }).catch(() => {});
      }
    } catch(_){}

    res.json({ success: true, message: 'Bukti terkirim! Owner akan memproses dalam 1x24 jam.', payId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/payment/status/:payId', requireAuth, (req, res) => {
  const payments = loadPayments();
  const pay = payments.find(p => p.payId === req.params.payId && p.userId === req.user.userId);
  if (!pay) return res.status(404).json({ error: 'Payment tidak ditemukan' });
  const { proofImage, ...safe } = pay;
  res.json({ payment: safe });
});

app.get('/api/payment/list', requireAuth, (req, res) => {
  const payments = loadPayments().filter(p => p.userId === req.user.userId).map(({ proofImage, ...p }) => p).sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
  res.json({ payments });
});

app.delete('/api/payment/:payId', requireAuth, (req, res) => {
  const payments = loadPayments();
  const idx = payments.findIndex(p => p.payId === req.params.payId && p.userId === req.user.userId);
  if (idx === -1) return res.status(404).json({ error: 'Payment tidak ditemukan' });
  if (!['pending_proof'].includes(payments[idx].status)) return res.status(400).json({ error: 'Payment tidak bisa dibatalkan' });
  payments[idx].status = 'cancelled';
  savePayments(payments);
  res.json({ success: true });
});


// ═══════════════════════════════════════════════
// PRICING
// ═══════════════════════════════════════════════

app.get('/api/pricing', (req, res) => {
  const plans = cfg.payment?.plans || {
    free:       { name: 'Free',       priceIdr: 0,      tokens: 5000,   maxBots: 1,  queuePriority: false, features: ['1 Bot', '5K Token/bulan', 'Basic Commands', 'Antrian Queue', 'Community Support'] },
    starter:    { name: 'Starter',    priceIdr: 29000,  tokens: 25000,  maxBots: 3,  queuePriority: false, features: ['3 Bot', '25K Token/bulan', 'Plugin Marketplace', 'Auto-Fix Basic', 'Antrian Queue', 'Email Support'] },
    pro:        { name: 'Pro',        priceIdr: 79000,  tokens: 100000, maxBots: 10, queuePriority: true,  features: ['10 Bot', '100K Token/bulan', 'AI Auto-Fix Full', 'Shell Access', 'GitHub Plugin', 'NO Queue ⚡ Bypass', 'Remote File Manager', 'Priority Support'] },
    enterprise: { name: 'Enterprise', priceIdr: 199000, tokens: -1,     maxBots: -1, queuePriority: true,  features: ['Unlimited Bot', 'Unlimited Token', 'Custom Plugin Builder', 'White Label', 'Full API Access', 'NO Queue ⚡ Bypass', 'Dedicated Support'] },
  };
  res.json({ plans });
});


// ═══════════════════════════════════════════════
// POPUP SYSTEM
// ═══════════════════════════════════════════════

app.get('/api/popup', (req, res) => {
  const popup = loadPopup();
  if (!popup.active || !popup.title) return res.json({ active: false });
  res.json(popup);
});

app.post('/api/admin/popup', requireAuth, requireOwner, (req, res) => {
  const { title, description, type, active } = req.body;
  const popup = loadPopup();
  if (title !== undefined)       popup.title       = title;
  if (description !== undefined) popup.description = description;
  if (type !== undefined)        popup.type        = ['info','success','warning','error'].includes(type) ? type : 'info';
  if (active !== undefined)      popup.active      = !!active;
  popup.updatedAt  = Date.now();
  if (!popup.createdAt) popup.createdAt = Date.now();
  savePopup(popup);
  res.json({ success: true, popup });
});

app.delete('/api/admin/popup', requireAuth, requireOwner, (req, res) => {
  savePopup({ active: false, title: '', description: '', type: 'info', createdAt: null });
  res.json({ success: true });
});


// ═══════════════════════════════════════════════
// MAINTENANCE MODE
// ═══════════════════════════════════════════════

app.get('/api/maintenance', (req, res) => { res.json(loadMaint()); });

app.post('/api/admin/maintenance', requireAuth, requireOwner, (req, res) => {
  const m = loadMaint();
  const { target, active, description, scheduledAt } = req.body;
  if (target === 'bot' || target === 'panel') {
    if (active !== undefined)      m[target].active      = !!active;
    if (description !== undefined) m[target].description = description;
    if (scheduledAt !== undefined) m[target].scheduledAt = scheduledAt;
    if (active) m[target].startedAt = Date.now();
    else { m[target].startedAt = null; m[target].endedAt = Date.now(); }
  }
  saveMaint(m);

  // Notify via bot if bot maintenance
  if (target === 'bot') {
    try {
      const { getEngine } = require('../src/core/engine');
      const engine = getEngine();
      // Could propagate to bot, but bot reads from file directly
    } catch(_){}
  }

  res.json({ success: true, maintenance: m });
});


// ═══════════════════════════════════════════════
// ADMIN ROUTES (owner only)
// ═══════════════════════════════════════════════

app.get('/api/admin/stats', requireAuth, requireOwner, (req, res) => {
  const users    = loadUsers();
  const conns    = loadConns();
  const payments = loadPayments();
  res.json({
    totalUsers:      Object.keys(users).length,
    totalBots:       Object.keys(conns).length,
    activeBots:      Object.values(conns).filter(c => c.status === 'active').length,
    totalPayments:   payments.length,
    pendingPayments: payments.filter(p => p.status === 'proof_submitted').length,
    totalRevenue:    payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + (p.amount || 0), 0),
    popup:     loadPopup(),
    maintenance: loadMaint(),
  });
});

app.get('/api/admin/users', requireAuth, requireOwner, (req, res) => {
  const users = loadUsers();
  const safe  = Object.values(users).map(({ passwordHash, ...u }) => u);
  res.json({ users: safe, total: safe.length });
});

app.put('/api/admin/users/:userId', requireAuth, requireOwner, (req, res) => {
  const users = loadUsers();
  const user  = Object.values(users).find(u => u.userId === req.params.userId);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  const { plan, tokens, role } = req.body;
  if (plan !== undefined)   user.plan   = plan;
  if (tokens !== undefined) user.tokens = parseInt(tokens);
  if (role !== undefined)   user.role   = role;
  users[user.email] = user;
  saveUsers(users);
  const { passwordHash, ...safe } = user;
  res.json({ success: true, user: safe });
});

app.get('/api/admin/payments', requireAuth, requireOwner, (req, res) => {
  const payments = loadPayments().map(({ proofImage, ...p }) => p).sort((a, b) => b.createdAt - a.createdAt);
  res.json({ payments });
});

app.get('/api/admin/bots', requireAuth, requireOwner, (req, res) => {
  const conns = loadConns();
  res.json({ bots: Object.values(conns) });
});


// ═══════════════════════════════════════════════
// FILE MANAGER
// ═══════════════════════════════════════════════

const MAX_FILE_READ = 5 * 1024 * 1024; // 5MB

app.get('/api/files/list', requireAuth, (req, res) => {
  try {
    const p = safePath(req.query.path || '/');
    if (!fs.existsSync(p)) return res.status(404).json({ error: 'Path tidak ditemukan' });
    if (!fs.statSync(p).isDirectory()) return res.status(400).json({ error: 'Bukan direktori' });

    const ignoreList = ['node_modules', '.git', '.cache'];
    const entries = fs.readdirSync(p)
      .filter(n => !ignoreList.includes(n))
      .map(name => {
        try {
          const fp = path.join(p, name);
          const st = fs.statSync(fp);
          return { name, path: fp.replace(PROJECT_ROOT, '') || '/', isDir: st.isDirectory(), size: st.isDirectory() ? 0 : st.size, modifiedAt: st.mtimeMs };
        } catch(_) { return null; }
      }).filter(Boolean);

    res.json({ items: entries, cwd: p.replace(PROJECT_ROOT, '') || '/' });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/files/read', requireAuth, (req, res) => {
  try {
    const p = safePath(req.query.path);
    if (!fs.existsSync(p)) return res.status(404).json({ error: 'File tidak ditemukan' });
    const st = fs.statSync(p);
    if (st.isDirectory()) return res.status(400).json({ error: 'Bukan file' });
    if (st.size > MAX_FILE_READ) return res.status(400).json({ error: 'File terlalu besar (maks 5MB)' });
    const content = fs.readFileSync(p, 'utf8');
    res.json({ content, size: st.size, path: req.query.path });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/files/write', requireAuth, (req, res) => {
  try {
    const { path: inputPath, content, encoding } = req.body;
    if (!inputPath) return res.status(400).json({ error: 'path diperlukan' });
    const p = safePath(inputPath);
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (encoding === 'base64') fs.writeFileSync(p, Buffer.from(content || '', 'base64'));
    else fs.writeFileSync(p, content || '', 'utf8');
    res.json({ success: true, path: p.replace(PROJECT_ROOT, '') });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/files/delete', requireAuth, (req, res) => {
  try {
    const p = safePath(req.query.path);
    if (!fs.existsSync(p)) return res.status(404).json({ error: 'File tidak ditemukan' });
    const st = fs.statSync(p);
    if (st.isDirectory()) fs.rmSync(p, { recursive: true, force: true });
    else fs.unlinkSync(p);
    res.json({ success: true });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/files/mkdir', requireAuth, (req, res) => {
  try {
    const p = safePath(req.body.path);
    fs.mkdirSync(p, { recursive: true });
    res.json({ success: true, path: p.replace(PROJECT_ROOT, '') });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/files/rename', requireAuth, (req, res) => {
  try {
    const from = safePath(req.body.from);
    const to   = safePath(req.body.to);
    if (!fs.existsSync(from)) return res.status(404).json({ error: 'File tidak ditemukan' });
    fs.renameSync(from, to);
    res.json({ success: true });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/files/upload', requireAuth, (req, res) => {
  try {
    const { path: inputPath, content, encoding } = req.body;
    if (!inputPath || !content) return res.status(400).json({ error: 'path dan content diperlukan' });
    const p = safePath(inputPath);
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (encoding === 'base64') fs.writeFileSync(p, Buffer.from(content, 'base64'));
    else fs.writeFileSync(p, content, 'utf8');
    res.json({ success: true, path: p.replace(PROJECT_ROOT, '') });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/files/download', (req, res) => {
  try {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Token diperlukan' });
    try { jwt.verify(token, JWT_SECRET); } catch(_) { return res.status(401).json({ error: 'Token tidak valid' }); }
    const p = safePath(req.query.path);
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) return res.status(404).json({ error: 'File tidak ditemukan' });
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(p)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.sendFile(p);
  } catch(e) { res.status(400).json({ error: e.message }); }
});


// ═══════════════════════════════════════════════
// HTML PAGES
// ═══════════════════════════════════════════════

const VIEWS = {
  '/':           'landing',
  '/login':      'login',
  '/register':   'register',
  '/dashboard':  'dashboard',
  '/bots':       'bots',
  '/tokens':     'tokens',
  '/pricing':    'pricing',
  '/settings':   'settings',
  '/bot-settings':'bot-settings',
  '/admin':      'admin',
  '/terminal':   'terminal',
  '/files':      'files',
  '/ssh':        'ssh',
  '/maintenance':'maintenance',
};

for (const [route, page] of Object.entries(VIEWS)) {
  app.get(route, (req, res) => {
    const filePath = path.join(__dirname, 'views', `${page}.html`);
    if (fs.existsSync(filePath)) return res.sendFile(filePath);
    res.sendFile(path.join(__dirname, 'views', 'landing.html'));
  });
}

// ─── Health ───
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'DLavie OS Web v3.0', time: new Date().toISOString() }));

// ─── 404 ───
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


// ═══════════════════════════════════════════════
// WEBSOCKET — Terminal & SSH
// ═══════════════════════════════════════════════

function safeSend(ws, data) {
  try { if (ws.readyState === 1) ws.send(JSON.stringify(data)); } catch(_) {}
}

function handleTerminalWs(ws, user) {
  const shell = spawn('/bin/bash', [], {
    env: { ...process.env, TERM: 'xterm-256color', HOME: process.env.HOME || '/root', USER: user.name || 'user' },
    cwd: PROJECT_ROOT,
  });

  shell.stdout.on('data', d => safeSend(ws, { type: 'output', data: d.toString('utf8') }));
  shell.stderr.on('data', d => safeSend(ws, { type: 'output', data: d.toString('utf8') }));
  shell.on('exit', code => { safeSend(ws, { type: 'exit', code }); ws.close(); });
  shell.on('error', err => { safeSend(ws, { type: 'output', data: `\r\n[Error: ${err.message}]\r\n` }); ws.close(); });

  ws.on('message', (raw) => {
    try {
      const m = JSON.parse(raw.toString());
      if (m.type === 'input' && shell.stdin.writable) shell.stdin.write(m.data);
      if (m.type === 'resize') {
        try {
          // Send SIGWINCH to the shell process group
          process.kill(shell.pid, 'SIGWINCH');
        } catch(_) {}
      }
    } catch(_) {}
  });

  ws.on('close', () => {
    try { shell.kill('SIGTERM'); setTimeout(() => { try { shell.kill('SIGKILL'); } catch(_){} }, 1000); } catch(_) {}
  });
}

function handleSshWs(ws, user) {
  let sshProc = null;
  safeSend(ws, { type: 'output', data: '\x1b[33mDLavie OS SSH Bridge — siap menerima koneksi...\x1b[0m\r\n' });

  ws.on('message', (raw) => {
    try {
      const m = JSON.parse(raw.toString());

      if (m.type === 'connect') {
        const { host, port, username, password } = m;
        if (!host || !username) { safeSend(ws, { type: 'error', message: 'host dan username diperlukan' }); return; }

        const sshArgs = [
          `${username}@${host}`, '-p', String(port || 22),
          '-o', 'StrictHostKeyChecking=no',
          '-o', 'ConnectTimeout=15',
          '-o', 'ServerAliveInterval=30',
        ];

        // Check if sshpass is available for password auth
        let spawnCmd = 'ssh', spawnArgs = sshArgs;
        if (password && !password.includes('BEGIN')) {
          const hasSshpass = (() => { try { require('child_process').execSync('which sshpass 2>/dev/null', { timeout: 2000 }); return true; } catch(_) { return false; } })();
          if (hasSshpass) { spawnCmd = 'sshpass'; spawnArgs = ['-p', password, 'ssh', ...sshArgs]; }
        }

        sshProc = spawn(spawnCmd, spawnArgs, { env: { ...process.env, TERM: 'xterm-256color' } });
        safeSend(ws, { type: 'ready' });
        safeSend(ws, { type: 'output', data: `\x1b[32mMenghubungkan ke ${username}@${host}:${port || 22}...\x1b[0m\r\n` });

        sshProc.stdout.on('data', d => safeSend(ws, { type: 'output', data: d.toString('utf8') }));
        sshProc.stderr.on('data', d => safeSend(ws, { type: 'output', data: d.toString('utf8') }));
        sshProc.on('exit', code => { safeSend(ws, { type: 'exit', code }); });
        sshProc.on('error', err => { safeSend(ws, { type: 'error', message: err.message }); });
      }

      if (m.type === 'input' && sshProc?.stdin?.writable) sshProc.stdin.write(m.data);
      if (m.type === 'disconnect' && sshProc)             { sshProc.kill(); sshProc = null; }
    } catch(_) {}
  });

  ws.on('close', () => { try { if (sshProc) sshProc.kill(); } catch(_) {} });
}

function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: undefined }); // Handle all WS connections

  wss.on('connection', (ws, req) => {
    let wsPath, token;
    try {
      const urlObj = new URL(req.url, `http://localhost`);
      wsPath = urlObj.pathname;
      token  = urlObj.searchParams.get('token');
    } catch(_) { ws.close(); return; }

    // Authenticate
    if (!token) { ws.close(4001, 'Unauthorized'); return; }
    let user;
    try { user = jwt.verify(token, JWT_SECRET); }
    catch(_) { ws.close(4001, 'Unauthorized'); return; }

    if (wsPath === '/ws/terminal') {
      handleTerminalWs(ws, user);
    } else if (wsPath === '/ws/ssh') {
      handleSshWs(ws, user);
    } else if (wsPath === '/ws') {
      // Legacy /ws path — just keep alive for bot engine
      ws.on('message', () => {});
    } else {
      ws.close(4004, 'Not found');
    }
  });

  console.log('[DLAVIE][WEB] WebSocket server ready (/ws/terminal, /ws/ssh)');
}


// ═══════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════

function startWebServer() {
  const httpServer = http.createServer(app);
  setupWebSocket(httpServer);
  httpServer.listen(WEB_PORT, '0.0.0.0', () => {
    console.log(`[DLAVIE][WEB] Dashboard running on http://0.0.0.0:${WEB_PORT} | ${getDashUrl()}`);
  });
}

module.exports = { startWebServer };
