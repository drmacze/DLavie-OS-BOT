/**
 * DLavie OS — Web Dashboard Server v2.1
 * FIX: Bot filter pakai ownerWebUserId (bukan ownerUserId yang WA phone)
 * NEW: Payment system (QRIS + proof + owner approval)
 * NEW: Bot settings/customization endpoints
 * Port: 5000
 */

'use strict';

const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const path        = require('path');
const fs          = require('fs');
const jwt         = require('jsonwebtoken');
const bcrypt      = require('bcryptjs');
const crypto      = require('crypto');
const rateLimit   = require('express-rate-limit');
const compression = require('compression');
const { getWebAuth } = require('../src/auth/webAuth');

let cfg = {};
try { cfg = require('../DLavieConfig'); } catch (_) {}
try { require('dotenv').config(); } catch (_) {}

const JWT_SECRET = process.env.JWT_SECRET      || cfg.auth?.jwtSecret || 'dlavie-web-secret-change-me';
const WEB_PORT   = parseInt(process.env.WEB_PORT || '') || cfg.web?.port || 5000;
const OWNER_NUM  = process.env.OWNER_NUMBER    || cfg.bot?.ownerNumber || '62882007437216';

function getDashUrl() {
  if (process.env.DASHBOARD_URL) return process.env.DASHBOARD_URL;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return cfg.web?.dashboardUrl || 'https://dlavie-os.replit.app';
}

// ─── File Storage ───
const TMP = path.join(__dirname, '../tmp');
function ensureTmp() { if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true }); }
const USERS_FILE    = path.join(TMP, 'web_users.json');
const CONNS_FILE    = path.join(TMP, 'bot_connections.json');
const PAYMENTS_FILE = path.join(TMP, 'payments.json');

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

// ─── App ───
const app = express();
app.use(compression());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Rate limiting ───
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 25, message: { error: 'Terlalu banyak percobaan.' } });
const apiLimiter  = rateLimit({ windowMs: 60 * 1000, max: 200 });
app.use('/api/auth', authLimiter);
app.use('/api/', apiLimiter);

// ─── JWT Middleware ───
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.headers['x-token'];
  if (!token) return res.status(401).json({ error: 'Token diperlukan' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch (_) { return res.status(401).json({ error: 'Token tidak valid atau sudah expire' }); }
}

// Helper: ambil bot milik user
function getUserBots(userId) {
  const conns = loadConns();
  return Object.values(conns).filter(c =>
    (c.ownerWebUserId === userId || c.ownerUserId === userId) && c.botId
  );
}

// Helper: cek apakah user adalah owner
function isOwner(userId) {
  const users = loadUsers();
  const user  = Object.values(users).find(u => u.userId === userId);
  return user?.role === 'owner' || false;
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

    const hash   = await bcrypt.hash(password, 12);
    const userId = 'usr_' + crypto.randomBytes(12).toString('hex');
    const accessKey = 'dlk_' + crypto.randomBytes(24).toString('hex');
    users[emailKey] = {
      userId, email: emailKey, name, passwordHash: hash,
      plan: 'free', tokens: 5000, accessKey,
      createdAt: Date.now(), lastLogin: null,
      tokenHistory: [], recentActivity: [],
    };
    saveUsers(users);

    const token = jwt.sign({ userId, email: emailKey, name, plan: 'free' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { userId, email: emailKey, name, plan: 'free', tokens: 5000, accessKey } });
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

    const token = jwt.sign({ userId: user.userId, email: emailKey, name: user.name, plan: user.plan }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      success: true, token,
      user: { userId: user.userId, email: emailKey, name: user.name, plan: user.plan, tokens: user.tokens, accessKey: user.accessKey }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const users = loadUsers();
  const user  = users[req.user.email];
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  const { passwordHash, ...safe } = user;
  res.json({ user: safe });
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
    res.json({ success: true, user: safe });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// BOT CODE (Login WA → Web)
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
// DASHBOARD STATS — FIX: filter by webUserId
// ═══════════════════════════════════════════════

app.get('/api/dashboard', requireAuth, (req, res) => {
  try {
    const users  = loadUsers();
    const user   = users[req.user.email];
    // FIX: filter by ownerWebUserId (req.user.userId = usr_xxx)
    const myBots    = getUserBots(req.user.userId);
    const activeBots = myBots.filter(b => b.status === 'active').length;

    res.json({
      user: { name: user?.name, email: user?.email, plan: user?.plan, tokens: user?.tokens || 0, accessKey: user?.accessKey },
      stats: {
        totalBots: myBots.length, activeBots,
        tokenBalance: user?.tokens || 0,
        tokenUsedToday: user?.tokenUsedToday || 0,
        commandsToday: user?.commandsToday || 0,
        paymentsCount: loadPayments().filter(p => p.userId === req.user.userId).length,
      },
      bots: myBots.slice(0, 5),
      recentActivity: (user?.recentActivity || []).slice(0, 10),
      dashUrl: getDashUrl(),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// BOTS MANAGEMENT — FIX: filter by ownerWebUserId
// ═══════════════════════════════════════════════

app.get('/api/bots', requireAuth, (req, res) => {
  // FIX ROOT CAUSE: gunakan req.user.userId (usr_xxx) bukan req.user.userId yang lama (WA phone)
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

// Bot settings
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
  const allowed = ['name', 'prefix', 'bio', 'language', 'timezone', 'menuTitle', 'menuFooter', 'welcomeMsg', 'antiSpam'];
  const settings = bot.settings || {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) settings[key] = req.body[key];
  }
  bot.settings = settings;
  conns[req.params.botId] = bot;
  saveConns(conns);
  res.json({ success: true, settings });
});

// Bot relay command via web
app.post('/api/bots/:botId/relay', requireAuth, (req, res) => {
  const conns = loadConns();
  const bot   = conns[req.params.botId];
  if (!bot || (bot.ownerWebUserId !== req.user.userId && bot.ownerUserId !== req.user.userId)) {
    return res.status(404).json({ error: 'Bot tidak ditemukan' });
  }
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'Command diperlukan' });
  // Store relay command for bot to pick up
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
// PAYMENT SYSTEM — QRIS + Proof + Approval
// ═══════════════════════════════════════════════

// Initiate payment request
app.post('/api/payment/initiate', requireAuth, (req, res) => {
  try {
    const { type, packageId, planName, amount, tokens } = req.body;
    if (!type) return res.status(400).json({ error: 'type diperlukan (token|plan)' });

    const users = loadUsers();
    const user  = users[req.user.email];

    // Prevent duplicate pending payments
    const payments = loadPayments();
    const hasPending = payments.find(p =>
      p.userId === req.user.userId && (p.status === 'pending_proof' || p.status === 'proof_submitted')
    );
    if (hasPending) {
      return res.json({
        success: true,
        payId: hasPending.payId,
        existing: true,
        message: 'Kamu masih punya payment pending. Selesaikan dulu atau tunggu 5 menit.',
        expiresAt: hasPending.expiresAt,
        qrisImage: cfg.payment?.qris?.imageUrl || process.env.QRIS_IMAGE_URL || '',
      });
    }

    const d = new Date();
    const datePart = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    const payId = `PAY_${datePart}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const packages = cfg.payment?.tokenPackages || [
      { id: 'token_5k',   tokens: 5000,   priceIdr: 10000  },
      { id: 'token_15k',  tokens: 15000,  priceIdr: 25000  },
      { id: 'token_50k',  tokens: 50000,  priceIdr: 70000  },
      { id: 'token_150k', tokens: 150000, priceIdr: 180000 },
    ];
    const plans = { free: { tokens: 5000, priceIdr: 0 }, starter: { tokens: 25000, priceIdr: 29000 }, pro: { tokens: 100000, priceIdr: 79000 }, enterprise: { tokens: 500000, priceIdr: 199000 } };

    let payAmount = amount || 0;
    let payTokens = tokens || 0;
    if (type === 'token' && packageId) {
      const pkg = packages.find(p => p.id === packageId);
      if (pkg) { payAmount = pkg.priceIdr; payTokens = pkg.tokens; }
    } else if (type === 'plan' && planName) {
      const plan = plans[planName];
      if (plan) { payAmount = plan.priceIdr; payTokens = plan.tokens; }
    }

    const newPayment = {
      payId, type, packageId, planName: type === 'plan' ? planName : undefined,
      userId: req.user.userId, email: req.user.email, name: user?.name || '',
      amount: payAmount, tokens: payTokens,
      status: 'pending_proof',
      createdAt: Date.now(),
      expiresAt: Date.now() + (5 * 60 * 1000), // 5 menit untuk bayar
      buyerWaNumber: null, // diisi jika diketahui dari webAuth
      proofImage: null, buyerName: null,
    };

    // Coba dapat WA number dari webAuth session
    try {
      const webAuth = getWebAuth();
      const sessions = webAuth.getActiveSessions().filter(s => s.webUserId === req.user.userId);
      if (sessions.length > 0) newPayment.buyerWaNumber = sessions[0].waUserId;
    } catch(_){}

    payments.push(newPayment);
    savePayments(payments);

    res.json({
      success: true, payId,
      amount: payAmount, tokens: payTokens,
      expiresAt: newPayment.expiresAt,
      qrisImage: cfg.payment?.qris?.imageUrl || process.env.QRIS_IMAGE_URL || '',
      ownerWa: OWNER_NUM,
      dashUrl: getDashUrl(),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Submit payment proof
app.post('/api/payment/proof', requireAuth, (req, res) => {
  try {
    const { payId, buyerName, proofImage } = req.body;
    if (!payId || !buyerName) return res.status(400).json({ error: 'payId dan buyerName wajib' });

    const payments = loadPayments();
    const idx      = payments.findIndex(p => p.payId === payId && p.userId === req.user.userId);
    if (idx === -1) return res.status(404).json({ error: 'Payment tidak ditemukan' });

    const pay = payments[idx];
    if (pay.status !== 'pending_proof') {
      return res.status(400).json({ error: `Status payment: ${pay.status}. Tidak bisa submit bukti.` });
    }
    if (Date.now() > pay.expiresAt + (30 * 60 * 1000)) { // grace period 30 menit
      payments[idx].status = 'expired';
      savePayments(payments);
      return res.status(400).json({ error: 'Payment sudah expired. Buat payment baru.' });
    }

    payments[idx].status     = 'proof_submitted';
    payments[idx].buyerName  = buyerName;
    payments[idx].proofImage = proofImage || null;
    payments[idx].submittedAt = Date.now();
    savePayments(payments);

    // Notify owner via bot engine (if bot is running)
    try {
      const { getEngine } = require('../src/core/engine');
      const engine = getEngine();
      const sock = engine.getSock?.();
      if (sock) {
        const typeLabel = pay.type === 'plan' ? `Upgrade Plan ${pay.planName?.toUpperCase()}` : `Topup ${Number(pay.tokens).toLocaleString('id-ID')} Token`;
        const ownerJid = `${OWNER_NUM}@s.whatsapp.net`;
        const proofNote = proofImage ? '\n📸 Bukti transfer terlampir di web panel.' : '\n⚠️ Tidak ada bukti gambar.';
        sock.sendMessage(ownerJid, {
          text: `💳 *Payment Proof Submitted!*\n\n` +
            `ID: \`${payId}\`\nTipe: ${typeLabel}\nNominal: Rp ${Number(pay.amount).toLocaleString('id-ID')}\n` +
            `Pembeli: ${buyerName} (${pay.email})\nWaktu: ${new Date().toLocaleString('id-ID')}${proofNote}\n\n` +
            `*Approve:* \`!approve ${payId}${pay.type === 'token' ? ` ${pay.tokens}` : ''}\`\n` +
            `*Reject:* \`!reject ${payId} [alasan]\`\n\n` +
            `🌐 Lihat di panel: ${getDashUrl()}/tokens`
        }).catch(() => {});
      }
    } catch(_){}

    res.json({ success: true, message: 'Bukti pembayaran terkirim! Owner akan memproses dalam 1×24 jam.', payId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get payment status
app.get('/api/payment/status/:payId', requireAuth, (req, res) => {
  const payments = loadPayments();
  const pay = payments.find(p => p.payId === req.params.payId && p.userId === req.user.userId);
  if (!pay) return res.status(404).json({ error: 'Payment tidak ditemukan' });
  const { proofImage, ...safe } = pay;
  res.json({ payment: safe });
});

// Get user payment history
app.get('/api/payment/list', requireAuth, (req, res) => {
  const payments = loadPayments()
    .filter(p => p.userId === req.user.userId)
    .map(({ proofImage, ...p }) => p)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 20);
  res.json({ payments });
});

// Cancel pending payment
app.delete('/api/payment/:payId', requireAuth, (req, res) => {
  const payments = loadPayments();
  const idx = payments.findIndex(p => p.payId === req.params.payId && p.userId === req.user.userId);
  if (idx === -1) return res.status(404).json({ error: 'Payment tidak ditemukan' });
  if (!['pending_proof'].includes(payments[idx].status)) {
    return res.status(400).json({ error: 'Payment tidak bisa dibatalkan (sudah disubmit atau diproses)' });
  }
  payments[idx].status = 'cancelled';
  savePayments(payments);
  res.json({ success: true });
});

// Admin: list pending payments (owner only via web role)
app.get('/api/admin/payments', requireAuth, (req, res) => {
  const users = loadUsers();
  const user  = users[req.user.email];
  if (user?.role !== 'owner' && user?.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak' });
  }
  const payments = loadPayments()
    .filter(p => ['pending_proof', 'proof_submitted'].includes(p.status))
    .map(({ proofImage, ...p }) => p);
  res.json({ payments });
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
// HTML PAGES — Serve SPA views
// ═══════════════════════════════════════════════

const VIEWS = ['/', '/login', '/register', '/dashboard', '/bots', '/tokens', '/pricing', '/settings', '/bot-settings'];
for (const route of VIEWS) {
  app.get(route, (req, res) => {
    const pageName = route === '/' ? 'landing' : route.slice(1);
    const filePath = path.join(__dirname, 'views', `${pageName}.html`);
    if (fs.existsSync(filePath)) return res.sendFile(filePath);
    res.sendFile(path.join(__dirname, 'views', 'landing.html'));
  });
}

// ─── Health ───
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'DLavie OS Web v2.1', time: new Date().toISOString() }));

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

// ─── Start server ───
function startWebServer() {
  app.listen(WEB_PORT, '0.0.0.0', () => {
    console.log(`[DLAVIE][WEB] Dashboard running on http://0.0.0.0:${WEB_PORT} | ${getDashUrl()}`);
  });
}

module.exports = { startWebServer };
