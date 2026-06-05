/**
 * DLavie OS — Web Auth Manager
 * Mengelola kode unik login bot via web dashboard
 * Layer: In-memory + persistent cache + fallback file storage
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SESSIONS_FILE = path.join(__dirname, '../../tmp/bot_sessions.json');
const DEFAULT_OWNER_NUMBER = '62882007437216';

class WebAuth {
  constructor() {
    this.pendingCodes  = new Map(); // code -> { webUserId, email, createdAt, expiresAt }
    this.botSessions   = new Map(); // waUserId -> session object
    this._loadSessions();
    this._startCleanup();
  }

  // ─── Generate kode unik untuk user dari web ───
  generateBotCode(webUserId, email) {
    // Invalidasi kode lama milik user ini
    for (const [code, entry] of this.pendingCodes.entries()) {
      if (entry.webUserId === webUserId) {
        this.pendingCodes.delete(code);
      }
    }

    const code       = this._generateCode();
    const expiresAt  = Date.now() + (10 * 60 * 1000); // 10 menit

    this.pendingCodes.set(code, {
      code, webUserId, email,
      createdAt: Date.now(),
      expiresAt
    });

    return { code, expiresAt, expiresInMin: 10 };
  }

  // ─── Verifikasi kode dari bot WA ───
  verifyBotCode(waUserId, rawCode) {
    const code  = String(rawCode).trim().toUpperCase().replace(/\s/g, '');
    const entry = this.pendingCodes.get(code);

    if (!entry) {
      return { success: false, error: 'Kode tidak valid. Cek ulang kode di website DLavie OS.' };
    }

    if (Date.now() > entry.expiresAt) {
      this.pendingCodes.delete(code);
      return { success: false, error: 'Kode sudah kadaluarsa. Generate kode baru di website DLavie OS.' };
    }

    // Buat session baru
    const accessKey = this._generateAccessKey(waUserId, entry.webUserId);
    const session = {
      waUserId,
      webUserId: entry.webUserId,
      email:     entry.email,
      plan:      'free',
      accessKey,
      loginAt:   Date.now(),
      lastActive: Date.now(),
    };

    this.botSessions.set(waUserId, session);
    this.pendingCodes.delete(code);
    this._saveSessions();

    return { success: true, session };
  }

  // ─── Cek apakah user WA sudah login ───
  isLoggedIn(waUserId) {
    const session = this.botSessions.get(waUserId);
    if (!session) return false;
    session.lastActive = Date.now();
    return true;
  }

  // ─── Get session ───
  getSession(waUserId) {
    return this.botSessions.get(waUserId) || null;
  }

  // ─── Get plan user ───
  getUserPlan(waUserId) {
    const session = this.getSession(waUserId);
    return session?.plan || 'free';
  }

  // ─── Update plan user (dipanggil setelah payment) ───
  updateUserPlan(waUserId, plan) {
    const session = this.botSessions.get(waUserId);
    if (session) {
      session.plan = plan;
      this._saveSessions();
      return true;
    }
    return false;
  }

  // ─── Logout user dari bot ───
  logout(waUserId) {
    const had = this.botSessions.has(waUserId);
    this.botSessions.delete(waUserId);
    if (had) this._saveSessions();
    return had;
  }

  // ─── Get semua sesi aktif ───
  getActiveSessions() {
    const result = [];
    for (const [waUserId, session] of this.botSessions.entries()) {
      result.push({ waUserId, email: session.email, plan: session.plan, loginAt: session.loginAt, lastActive: session.lastActive, webUserId: session.webUserId });
    }
    return result;
  }

  // ─── Validasi access key untuk API ───
  validateAccessKey(accessKey) {
    for (const [, session] of this.botSessions.entries()) {
      if (session.accessKey === accessKey) return { valid: true, session };
    }
    return { valid: false };
  }

  // ─── Cek owner ───
  isOwner(waUserId, ownerNumber) {
    const cleanOwner = String(ownerNumber || process.env.OWNER_NUMBER || DEFAULT_OWNER_NUMBER || '').replace(/\D/g, '');
    const cleanUser  = String(waUserId || '').replace(/\D/g, '');
    if (!cleanOwner || !cleanUser) return false;
    return cleanUser === cleanOwner || cleanUser.endsWith(cleanOwner) || cleanOwner.endsWith(cleanUser);
  }

  // ─── Internal: generate kode 8 char ───
  _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    const bytes = crypto.randomBytes(8);
    for (let i = 0; i < 8; i++) {
      code += chars[bytes[i] % chars.length];
    }
    return code;
  }

  // ─── Internal: generate private access key ───
  _generateAccessKey(waUserId, webUserId) {
    return 'dlv_' + crypto.createHash('sha256')
      .update(`${waUserId}:${webUserId}:${Date.now()}:${crypto.randomBytes(16).toString('hex')}`)
      .digest('hex')
      .slice(0, 40);
  }

  // ─── Internal: load sessions dari file ───
  _loadSessions() {
    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        const raw = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
        for (const [k, v] of Object.entries(raw)) {
          this.botSessions.set(k, v);
        }
        console.log(`[DLAVIE][AUTH] Loaded ${this.botSessions.size} bot session(s)`);
      }
    } catch (err) {
      console.warn('[DLAVIE][AUTH] Could not load sessions:', err.message);
    }
  }

  // ─── Internal: simpan sessions ke file ───
  _saveSessions() {
    try {
      const dir = path.dirname(SESSIONS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const obj = Object.fromEntries(this.botSessions.entries());
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj, null, 2));
    } catch (err) {
      console.warn('[DLAVIE][AUTH] Could not save sessions:', err.message);
    }
  }

  // ─── Internal: cleanup kode expired setiap 5 menit ───
  _startCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [code, entry] of this.pendingCodes.entries()) {
        if (now > entry.expiresAt) this.pendingCodes.delete(code);
      }
    }, 5 * 60 * 1000);
  }
}

let instance = null;
function getWebAuth() {
  if (!instance) instance = new WebAuth();
  return instance;
}

module.exports = { WebAuth, getWebAuth };
