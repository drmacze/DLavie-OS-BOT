/**
 * DLavie OS — Create Vercel Export ZIP
 * Packages the web panel for Vercel deployment
 */
'use strict';

const fs       = require('fs');
const path     = require('path');
const archiver = require('archiver');

const ROOT       = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'tmp');
const ZIP_PATH   = path.join(OUTPUT_DIR, 'dlavie-panel-vercel.zip');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const output  = fs.createWriteStream(ZIP_PATH);
const archive = archiver('zip', { zlib: { level: 9 } });

archive.on('error', err => { console.error('Archive error:', err); process.exit(1); });

output.on('close', () => {
  const size = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log(`✅ Vercel export created: ${ZIP_PATH} (${size} MB)`);
  console.log('📦 Deploy ke Vercel:');
  console.log('   1. Extract zip ke folder baru');
  console.log('   2. vercel login');
  console.log('   3. vercel --prod');
});

archive.pipe(output);

// ─── vercel.json ───
archive.append(JSON.stringify({
  "version": 2,
  "name": "dlavie-panel",
  "builds": [{ "src": "api/index.js", "use": "@vercel/node" }],
  "routes": [
    { "src": "/css/(.*)", "dest": "/public/css/$1" },
    { "src": "/js/(.*)",  "dest": "/public/js/$1"  },
    { "src": "/(.*)",     "dest": "/api/index.js"   }
  ]
}, null, 2), { name: 'vercel.json' });

// ─── package.json ───
archive.append(JSON.stringify({
  "name": "dlavie-panel-vercel",
  "version": "1.0.0",
  "description": "DLavie OS Web Panel — Vercel deployment",
  "main": "api/index.js",
  "engines": { "node": ">=18" },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "compression": "^1.8.1",
    "cors": "^2.8.6",
    "express": "^4.22.2",
    "express-rate-limit": "^7.5.1",
    "helmet": "^8.2.0",
    "jsonwebtoken": "^9.0.3",
    "uuid": "^11.1.1"
  }
}, null, 2), { name: 'package.json' });

// ─── .env.example ───
archive.append(
`# Copy to .env and fill in values
JWT_SECRET=ganti-dengan-random-secret-panjang
OWNER_NUMBER=62882007437216
DASHBOARD_URL=https://your-app.vercel.app
QRIS_IMAGE_URL=https://your-qris-image-url.png

# Optional: Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
`, { name: '.env.example' });

// ─── README.md ───
archive.append(
`# DLavie OS Web Panel — Vercel Deployment

## Deploy ke Vercel

\`\`\`bash
npm install -g vercel
vercel login
vercel --prod
\`\`\`

## Konfigurasi

Buat file \`.env\` berdasarkan \`.env.example\` dan set di Vercel:
- \`vercel env add JWT_SECRET\`
- \`vercel env add OWNER_NUMBER\`
- \`vercel env add DASHBOARD_URL\`

## Catatan

- **WebSocket Terminal & SSH**: Tidak tersedia di Vercel (serverless). Gunakan hosting sendiri.
- **File Manager**: Tidak tersedia di Vercel (read-only filesystem).
- **Storage**: Gunakan Supabase untuk persistent storage di production.
- **Bot WhatsApp**: Tetap harus dihosting di server biasa (bukan serverless).

## Fitur yang tersedia di Vercel
✅ Web dashboard & login system  
✅ Bot connection via web  
✅ Token & payment system  
✅ Pricing & plan management  
✅ User management  
✅ Popup & maintenance mode  
❌ Terminal (butuh server biasa)  
❌ File Manager (butuh server biasa)  
❌ SSH connection (butuh server biasa)  
`, { name: 'README.md' });

// ─── api/index.js ───
const serverContent = fs.readFileSync(path.join(ROOT, 'web/server.js'), 'utf8');
// Adapt server for Vercel (remove ws/ssh/file manager, export app directly)
const vercelServer = `/**
 * DLavie OS Web Panel — Vercel Adapter
 * Removes WebSocket/terminal features (not supported on Vercel)
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

let cfg = {};
try { require('dotenv').config(); } catch (_) {}

const JWT_SECRET = process.env.JWT_SECRET || 'dlavie-web-secret-change-me';
const OWNER_NUM  = process.env.OWNER_NUMBER || '62882007437216';

function getDashUrl() {
  return process.env.DASHBOARD_URL || 'https://your-app.vercel.app';
}

// Storage path — in /tmp for Vercel (ephemeral!)
const TMP = '/tmp/dlavie-data';
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

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
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch (_) {}
}

const loadUsers    = () => loadJSON(USERS_FILE, {});
const saveUsers    = (u) => saveJSON(USERS_FILE, u);
const loadPayments = () => loadJSON(PAYMENTS_FILE, []);
const savePayments = (p) => saveJSON(PAYMENTS_FILE, p);
const loadPopup    = () => loadJSON(POPUP_FILE, { active: false, title: '', description: '', type: 'info' });
const savePopup    = (p) => saveJSON(POPUP_FILE, p);
const loadMaint    = () => loadJSON(MAINTENANCE_FILE, { bot: { active: false }, panel: { active: false } });
const saveMaint    = (m) => saveJSON(MAINTENANCE_FILE, m);

const app = express();
app.use(compression());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 25, message: { error: 'Terlalu banyak percobaan.' } });
app.use('/api/auth', authLimiter);

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token diperlukan' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch (_) { return res.status(401).json({ error: 'Token tidak valid' }); }
}

function isOwnerUser(userId) {
  const users = loadUsers();
  const user  = Object.values(users).find(u => u.userId === userId);
  return user?.role === 'owner';
}

function requireOwner(req, res, next) {
  if (!isOwnerUser(req.user.userId)) return res.status(403).json({ error: 'Owner only' });
  next();
}

// AUTH
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, password, dan nama wajib' });
    const users    = loadUsers();
    const emailKey = email.toLowerCase().trim();
    if (users[emailKey]) return res.status(409).json({ error: 'Email sudah terdaftar' });
    const hash      = await bcrypt.hash(password, 12);
    const userId    = 'usr_' + crypto.randomBytes(12).toString('hex');
    const accessKey = 'dlk_' + crypto.randomBytes(24).toString('hex');
    const isFirst   = Object.keys(users).length === 0;
    users[emailKey] = { userId, email: emailKey, name, passwordHash: hash, plan: 'free', tokens: 5000, accessKey, role: isFirst ? 'owner' : 'user', createdAt: Date.now() };
    saveUsers(users);
    const token = jwt.sign({ userId, email: emailKey, name, plan: 'free' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { userId, email: emailKey, name, plan: 'free', tokens: 5000, accessKey, isOwner: isFirst } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const users    = loadUsers();
    const emailKey = email?.toLowerCase().trim();
    const user     = users[emailKey];
    if (!user) return res.status(401).json({ error: 'Email atau password salah' });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Email atau password salah' });
    user.lastLogin = Date.now(); saveUsers(users);
    const ownerStatus = isOwnerUser(user.userId);
    const token = jwt.sign({ userId: user.userId, email: emailKey, name: user.name, plan: user.plan }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { userId: user.userId, email: emailKey, name: user.name, plan: user.plan, tokens: user.tokens, accessKey: user.accessKey, isOwner: ownerStatus } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const users = loadUsers();
  const user  = users[req.user.email];
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  const { passwordHash, ...safe } = user;
  res.json({ user: { ...safe, isOwner: isOwnerUser(req.user.userId) } });
});

app.get('/api/popup', (req, res) => {
  const popup = loadPopup();
  if (!popup.active || !popup.title) return res.json({ active: false });
  res.json(popup);
});

app.post('/api/admin/popup', requireAuth, requireOwner, (req, res) => {
  const { title, description, type, active } = req.body;
  const popup = loadPopup();
  if (title !== undefined) popup.title = title;
  if (description !== undefined) popup.description = description;
  if (type !== undefined) popup.type = type;
  if (active !== undefined) popup.active = !!active;
  popup.updatedAt = Date.now();
  savePopup(popup);
  res.json({ success: true, popup });
});

app.delete('/api/admin/popup', requireAuth, requireOwner, (req, res) => {
  savePopup({ active: false, title: '', description: '', type: 'info' });
  res.json({ success: true });
});

app.get('/api/maintenance', (req, res) => res.json(loadMaint()));

app.post('/api/admin/maintenance', requireAuth, requireOwner, (req, res) => {
  const m = loadMaint();
  const { target, active, description, scheduledAt } = req.body;
  if (target === 'bot' || target === 'panel') {
    if (active !== undefined) m[target].active = !!active;
    if (description !== undefined) m[target].description = description;
    if (scheduledAt !== undefined) m[target].scheduledAt = scheduledAt;
  }
  saveMaint(m);
  res.json({ success: true, maintenance: m });
});

app.get('/api/pricing', (req, res) => {
  res.json({ plans: {
    free:       { name: 'Free',       priceIdr: 0,      tokens: 5000,   maxBots: 1,  features: ['1 Bot', '5K Token/bulan', 'Basic Commands'] },
    starter:    { name: 'Starter',    priceIdr: 29000,  tokens: 25000,  maxBots: 3,  features: ['3 Bot', '25K Token/bulan', 'Plugin Marketplace'] },
    pro:        { name: 'Pro',        priceIdr: 79000,  tokens: 100000, maxBots: 10, features: ['10 Bot', '100K Token/bulan', 'AI Auto-Fix'] },
    enterprise: { name: 'Enterprise', priceIdr: 199000, tokens: -1,     maxBots: -1, features: ['Unlimited Bot', 'Unlimited Token'] },
  }});
});

app.get('/api/admin/stats', requireAuth, requireOwner, (req, res) => {
  const users = loadUsers();
  const payments = loadPayments();
  res.json({
    totalUsers: Object.keys(users).length,
    pendingPayments: payments.filter(p => p.status === 'proof_submitted').length,
    totalRevenue: payments.filter(p => p.status === 'approved').reduce((s,p) => s+(p.amount||0), 0),
    popup: loadPopup(), maintenance: loadMaint(),
  });
});

app.get('/api/admin/users', requireAuth, requireOwner, (req, res) => {
  const users = loadUsers();
  res.json({ users: Object.values(users).map(({ passwordHash, ...u }) => u) });
});

app.put('/api/admin/users/:userId', requireAuth, requireOwner, (req, res) => {
  const users = loadUsers();
  const user  = Object.values(users).find(u => u.userId === req.params.userId);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  const { plan, tokens, role } = req.body;
  if (plan) user.plan = plan;
  if (tokens !== undefined) user.tokens = parseInt(tokens);
  if (role) user.role = role;
  users[user.email] = user;
  saveUsers(users);
  const { passwordHash, ...safe } = user;
  res.json({ success: true, user: safe });
});

// Serve HTML pages
const VIEWS_DIR = path.join(__dirname, '../views');
const PAGE_MAP  = { '/': 'landing', '/login': 'login', '/register': 'register', '/dashboard': 'dashboard', '/bots': 'bots', '/tokens': 'tokens', '/pricing': 'pricing', '/settings': 'settings', '/admin': 'admin' };
for (const [route, page] of Object.entries(PAGE_MAP)) {
  app.get(route, (req, res) => {
    const fp = path.join(VIEWS_DIR, page + '.html');
    if (fs.existsSync(fp)) return res.sendFile(fp);
    res.sendFile(path.join(VIEWS_DIR, 'landing.html'));
  });
}

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'DLavie Panel (Vercel)' }));
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.redirect('/');
});

module.exports = app;
`;

archive.append(vercelServer, { name: 'api/index.js' });

// ─── Static files ───
const publicDir = path.join(ROOT, 'web/public');
archive.directory(publicDir, 'public');

// ─── Views ───
const viewsDir = path.join(ROOT, 'web/views');
const viewFiles = ['landing', 'login', 'register', 'dashboard', 'bots', 'tokens', 'pricing', 'settings', 'admin', 'maintenance'];
viewFiles.forEach(name => {
  const fp = path.join(viewsDir, name + '.html');
  if (fs.existsSync(fp)) archive.file(fp, { name: `views/${name}.html` });
});

archive.finalize();
