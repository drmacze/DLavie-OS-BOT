/**
 * DLavie OS - Audit Logger
 * Comprehensive audit trail for all actions.
 */

const fs = require('fs');
const path = require('path');

const AUDIT_LOG_PATH = path.join(__dirname, '..', '..', 'logs', 'audit.log');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB

class AuditLogger {
  constructor() {
    this.logs = [];
    this.logBuffer = [];
  }

  async init() {
    const dir = path.dirname(AUDIT_LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    console.log('[DLAVIE][AUDIT] Initialized');
  }

  log(action, userId, details = {}, severity = 'info') {
    const entry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      action,
      userId,
      severity,
      details,
      ip: details.ip || 'unknown'
    };

    this.logs.push(entry);
    this.logBuffer.push(entry);

    if (this.logBuffer.length >= 50) {
      this.flushToDisk();
    }

    // Keep in-memory logs limited
    if (this.logs.length > 5000) {
      this.logs = this.logs.slice(-2500);
    }

    return entry;
  }

  flushToDisk() {
    if (this.logBuffer.length === 0) return;
    const lines = this.logBuffer.map(e => JSON.stringify(e)).join('\n') + '\n';
    fs.appendFileSync(AUDIT_LOG_PATH, lines);
    this.logBuffer = [];
  }

  async query(filters = {}) {
    let results = [...this.logs];
    if (filters.userId) results = results.filter(l => l.userId === filters.userId);
    if (filters.action) results = results.filter(l => l.action === filters.action);
    if (filters.severity) results = results.filter(l => l.severity === filters.severity);
    if (filters.after) results = results.filter(l => new Date(l.timestamp) >= new Date(filters.after));
    if (filters.before) results = results.filter(l => new Date(l.timestamp) <= new Date(filters.before));
    if (filters.limit) results = results.slice(0, filters.limit);
    return results;
  }

  async getStatus() {
    return {
      active: true,
      totalLogs: this.logs.length,
      pendingFlush: this.logBuffer.length
    };
  }

  shutdown() {
    this.flushToDisk();
  }
}

module.exports = { AuditLogger };
