/**
 * DLavie OS — Core4X Engine v1.0
 * ID: DLAVIE-CORE4X-ENGINE-001
 * Multi-layer fallback: Primary → Backup → Fallback → Safe Mode
 * Every feature runs through this engine for maximum resilience.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../../data/core4x');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DRAFT_ERRORS_FILE  = path.join(DATA_DIR, 'draft-errors.json');
const HEALTH_FILE        = path.join(DATA_DIR, 'feature-health.json');
const RECOVERY_FILE      = path.join(DATA_DIR, 'recovery-queue.json');
const FEATURE_MEM_FILE   = path.join(DATA_DIR, 'feature-memory.json');

function readJson(file, def = {}) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) {}
  return def;
}
function writeJson(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch (_) {}
}

class Core4XEngine {
  constructor() {
    this.health    = readJson(HEALTH_FILE, {});
    this.memory    = readJson(FEATURE_MEM_FILE, {});
    this.draftErrs = readJson(DRAFT_ERRORS_FILE, []);
    this.queue     = readJson(RECOVERY_FILE, []);
    this._persist();
  }

  // ── Main entry point: run any feature with full resilience ──
  async run(featureName, { primary, backup, fallback, context = {} } = {}) {
    this._ensureHealth(featureName);

    // Check feature memory for known fixes
    const knownFix = this.memory[featureName]?.lastFix;

    // X1 — Primary Logic
    try {
      const result = await primary(context);
      this._recordSuccess(featureName);
      return { success: true, layer: 'primary', result };
    } catch (primaryErr) {
      const errId = this._saveDraftError(featureName, primaryErr, 'primary', context);
      this._degradeHealth(featureName, 10);
      console.warn(`[CORE4X][${featureName}] Primary failed: ${primaryErr.message}`);

      // X2 — Backup Logic
      if (backup) {
        try {
          const result = await backup(context, primaryErr);
          this._recordSuccess(featureName, 5);
          this._notifyOwner(featureName, 'backup', primaryErr);
          return { success: true, layer: 'backup', result, primaryError: primaryErr.message };
        } catch (backupErr) {
          this._saveDraftError(featureName, backupErr, 'backup', context);
          this._degradeHealth(featureName, 5);
          console.warn(`[CORE4X][${featureName}] Backup failed: ${backupErr.message}`);

          // X3 — Fallback Runtime
          if (fallback) {
            try {
              const result = await fallback(context, backupErr);
              this._addToRecoveryQueue(featureName, errId, primaryErr);
              return { success: true, layer: 'fallback', result, degraded: true };
            } catch (fallbackErr) {
              this._saveDraftError(featureName, fallbackErr, 'fallback', context);
              this._degradeHealth(featureName, 5);
              this._addToRecoveryQueue(featureName, errId, primaryErr);
              this._notifyOwner(featureName, 'all_failed', primaryErr);
              return {
                success: false, layer: 'all_failed',
                error: primaryErr.message, errId,
                message: `Fitur ${featureName} sedang dalam recovery. Tim sudah diberitahu.`
              };
            }
          }

          // No fallback provided — add to recovery queue
          this._addToRecoveryQueue(featureName, errId, primaryErr);
          return {
            success: false, layer: 'backup_failed',
            error: backupErr.message, errId
          };
        }
      }

      // No backup — try fallback directly
      if (fallback) {
        try {
          const result = await fallback(context, primaryErr);
          this._addToRecoveryQueue(featureName, errId, primaryErr);
          return { success: true, layer: 'fallback', result, degraded: true };
        } catch (fallbackErr) {
          this._saveDraftError(featureName, fallbackErr, 'fallback', context);
          this._degradeHealth(featureName, 5);
          this._addToRecoveryQueue(featureName, errId, primaryErr);
          return { success: false, layer: 'all_failed', error: primaryErr.message, errId };
        }
      }

      return { success: false, layer: 'primary_failed', error: primaryErr.message, errId };
    }
  }

  // ── Feature Health ──
  _ensureHealth(name) {
    if (!this.health[name]) {
      this.health[name] = { score: 100, successes: 0, failures: 0, lastChecked: Date.now() };
    }
  }

  _recordSuccess(name, bonusPoints = 0) {
    const h = this.health[name];
    h.successes++;
    h.score = Math.min(100, h.score + 1 + bonusPoints);
    h.lastChecked = Date.now();
    this._saveHealth();
  }

  _degradeHealth(name, points) {
    const h = this.health[name];
    h.failures++;
    h.score = Math.max(0, h.score - points);
    h.lastChecked = Date.now();
    this._saveHealth();
  }

  getHealth(name) {
    if (name) return this.health[name] || { score: 100 };
    return this.health;
  }

  // ── Draft Error System ──
  _saveDraftError(featureName, err, layer, context = {}) {
    const errId = `ERR-${featureName.toUpperCase()}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const draft = {
      errId, featureName, layer,
      message: err.message, stack: err.stack,
      command: context.command || null, userId: context.userId || null,
      severity: 'medium', fallbackUsed: layer, recoveryStatus: 'pending',
      createdAt: new Date().toISOString()
    };
    this.draftErrs.push(draft);
    if (this.draftErrs.length > 500) this.draftErrs = this.draftErrs.slice(-500);
    writeJson(DRAFT_ERRORS_FILE, this.draftErrs);

    // Persist to DB async
    this._saveErrorToDB(draft).catch(() => {});
    return errId;
  }

  async _saveErrorToDB(draft) {
    try {
      const { query, isConnected } = require('../database/replitPg');
      if (!isConnected()) return;
      await query(
        `INSERT INTO dlavie_core4x_errors (error_id, feature_name, command, user_id, message, stack, severity, fallback_used, recovery_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (error_id) DO NOTHING`,
        [draft.errId, draft.featureName, draft.command, draft.userId,
         draft.message, draft.stack, draft.severity, draft.fallbackUsed, draft.recoveryStatus]
      );
    } catch (_) {}
  }

  getDraftErrors(featureName = null, limit = 50) {
    let errs = this.draftErrs;
    if (featureName) errs = errs.filter(e => e.featureName === featureName);
    return errs.slice(-limit).reverse();
  }

  // ── Recovery Queue ──
  _addToRecoveryQueue(featureName, errId, err) {
    this.queue.push({
      errId, featureName, error: err.message,
      status: 'pending', addedAt: new Date().toISOString(), attempts: 0
    });
    if (this.queue.length > 200) this.queue = this.queue.slice(-200);
    writeJson(RECOVERY_FILE, this.queue);
  }

  getRecoveryQueue() { return this.queue; }

  // ── Owner Notification ──
  _notifyOwner(featureName, layer, err) {
    try {
      const { getSock } = require('../bot');
      const ownerNum = process.env.OWNER_NUMBER;
      if (!ownerNum) return;
      const sock = getSock();
      if (!sock) return;
      const msg = `⚠️ *Core4X Alert*\n\nFitur: *${featureName}*\nLayer: ${layer}\nError: ${err.message}\n\nSistem sudah aktifkan fallback. Ketik *!core4x status* untuk detail.`;
      sock.sendMessage(`${ownerNum}@s.whatsapp.net`, { text: msg }).catch(() => {});
    } catch (_) {}
  }

  // ── Persistence ──
  _saveHealth() { writeJson(HEALTH_FILE, this.health); }
  _saveMemory()  { writeJson(FEATURE_MEM_FILE, this.memory); }

  _persist() {
    setInterval(() => {
      this._saveHealth();
      writeJson(RECOVERY_FILE, this.queue);
    }, 60000);
  }

  // ── Status Report ──
  getStatusReport() {
    const features = Object.entries(this.health).map(([name, h]) => ({
      name, score: h.score,
      status: h.score >= 80 ? 'OK' : h.score >= 50 ? 'Warning' : 'Critical',
      successes: h.successes, failures: h.failures
    }));
    const pending = this.queue.filter(q => q.status === 'pending').length;
    const errors  = this.draftErrs.filter(e => e.recoveryStatus === 'pending').length;
    return { features, pendingRecovery: pending, draftErrors: errors };
  }
}

let instance = null;
function getCore4X() {
  if (!instance) instance = new Core4XEngine();
  return instance;
}

module.exports = { Core4XEngine, getCore4X };
