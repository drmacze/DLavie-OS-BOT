/**
 * DLavie OS — Web Auth Manager v2.1
 * ID: DLAVIE-WEBAUTH-001
 * Fixed: sync token/plan from DB on verify, proper session persistence
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SESSIONS_FILE = path.join(__dirname, '../../tmp/bot_sessions.json');

class WebAuth {
  constructor() {
    this.pendingCodes = new Map();
    this.botSessions = new Map();
    this._loadSessions();
    this._startCleanup();
  }

  generateBotCode(webUserId, email, plan = 'free', role = 'user', tokenBalance = null) {
    const { isAutoOwnerEmail } = require('../utils/ownerUtils');
    if (isAutoOwnerEmail(email)) { plan = 'enterprise'; role = 'owner'; tokenBalance = 999999; }

    for (const [code, entry] of this.pendingCodes.entries()) {
      if (entry.webUserId === webUserId) this.pendingCodes.delete(code);
    }

    const code = this._generateCode();
    const expiresAt = Date.now() + (10 * 60 * 1000);
    this.pendingCodes.set(code, { code, webUserId, email, plan, role, tokenBalance, createdAt: Date.now(), expiresAt });
    return { code, expiresAt, expiresInMin: 10 };
  }

  async verifyBotCode(waUserId, rawCode) {
    const { isAutoOwnerEmail } = require('../utils/ownerUtils');
    const code = String(rawCode).trim().toUpperCase().replace(/\s/g, '');
    const entry = this.pendingCodes.get(code);

    if (!entry) return { success: false, error: 'Kode tidak valid. Cek ulang kode di website DLavie OS.' };
    if (Date.now() > entry.expiresAt) {
      this.pendingCodes.delete(code);
      return { success: false, error: 'Kode sudah kadaluarsa. Generate kode baru di website DLavie OS.' };
    }

    let plan = entry.plan || 'free';
    let role = entry.role || 'user';
    let tokenBalance = entry.tokenBalance;

    if (isAutoOwnerEmail(entry.email)) { plan = 'enterprise'; role = 'owner'; tokenBalance = 999999; }

    // Pull fresh token + plan from DB (authoritative source)
    try {
      const { query, isConnected } = require('../database/replitPg');
      if (isConnected()) {
        const res = await query(
          'SELECT tokens, plan, role FROM dlavie_web_users WHERE email = $1',
          [entry.email]
        );
        if (res.rows[0]) {
          tokenBalance = res.rows[0].tokens ?? tokenBalance;
          if (res.rows[0].plan) plan = res.rows[0].plan;
          if (res.rows[0].role) role = res.rows[0].role;
        }
      }
    } catch (err) {
      console.warn('[DLAVIE][AUTH] DB sync warning:', err.message);
    }

    if (isAutoOwnerEmail(entry.email)) { plan = 'enterprise'; role = 'owner'; tokenBalance = 999999; }

    const accessKey = this._generateAccessKey(waUserId, entry.webUserId);
    const session = {
      waUserId, webUserId: entry.webUserId, email: entry.email,
      plan, role, tokenBalance, accessKey,
      loginAt: Date.now(), lastActive: Date.now(),
    };

    this.botSessions.set(waUserId, session);
    this.pendingCodes.delete(code);
    this._saveSessions();

    // Sync token engine
    if (tokenBalance !== null) {
      try {
        const { getEngine } = require('../core/engine');
        const tokenEngine = getEngine().getSystem('token');
        if (tokenEngine) {
          if (!tokenEngine.getAccount(waUserId)) tokenEngine.registerAccount(waUserId);
          if (typeof tokenEngine.setBalance === 'function') tokenEngine.setBalance(waUserId, tokenBalance);
        }
      } catch (_) {}
    }

    // Link WA number to web user in DB
    try {
      const { query, isConnected } = require('../database/replitPg');
      if (isConnected()) {
        await query('UPDATE dlavie_web_users SET wa_number = $1 WHERE email = $2', [waUserId, entry.email]);
      }
    } catch (_) {}

    return { success: true, session };
  }

  isLoggedIn(waUserId) {
    const session = this.botSessions.get(waUserId);
    if (!session) return false;
    session.lastActive = Date.now();
    return true;
  }

  getSession(waUserId) {
    return this.botSessions.get(waUserId) || null;
  }

  getUserPlan(waUserId) {
    return this.getSession(waUserId)?.plan || 'free';
  }

  updateUserPlan(waUserId, plan) {
    const session = this.botSessions.get(waUserId);
    if (session) { session.plan = plan; this._saveSessions(); return true; }
    return false;
  }

  updateUserTokens(waUserId, newBalance) {
    const session = this.botSessions.get(waUserId);
    if (session) { session.tokenBalance = newBalance; this._saveSessions(); return true; }
    return false;
  }

  logout(waUserId) {
    const had = this.botSessions.has(waUserId);
    this.botSessions.delete(waUserId);
    if (had) this._saveSessions();
    return had;
  }

  getActiveSessions() {
    const result = [];
    for (const [waUserId, session] of this.botSessions.entries()) {
      result.push({ waUserId, ...session });
    }
    return result;
  }

  getSessionByEmail(email) {
    for (const [, session] of this.botSessions.entries()) {
      if (session.email === email) return session;
    }
    return null;
  }

  validateAccessKey(accessKey) {
    for (const [, session] of this.botSessions.entries()) {
      if (session.accessKey === accessKey) return { valid: true, session };
    }
    return { valid: false };
  }

  isOwner(waUserId, ownerNumber) {
    const { isOwnerById } = require('../utils/ownerUtils');
    return isOwnerById(waUserId, ownerNumber);
  }

  _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    const bytes = crypto.randomBytes(8);
    for (let i = 0; i < 8; i++) code += chars[bytes[i] % chars.length];
    return code;
  }

  _generateAccessKey(waUserId, webUserId) {
    return 'dlv_' + crypto.createHash('sha256')
      .update(`${waUserId}:${webUserId}:${Date.now()}:${crypto.randomBytes(16).toString('hex')}`)
      .digest('hex').slice(0, 40);
  }

  _loadSessions() {
    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        const raw = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
        for (const [k, v] of Object.entries(raw)) this.botSessions.set(k, v);
        console.log(`[DLAVIE][AUTH] Loaded ${this.botSessions.size} bot session(s)`);
      }
    } catch (err) {
      console.warn('[DLAVIE][AUTH] Could not load sessions:', err.message);
    }
  }

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
