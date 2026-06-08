/**
 * DLavie OS - Hybrid Auto Fix Controller
 * Combines rule-based fix + AI fallback with owner confirmation.
 */

const { runDeterministicRepair, formatRepairReport } = require('./deterministicRepair');
const { askAiFallback } = require('./aiFallback');
const config = require('../config');

class AutoFixController {
  constructor() {
    this.pending = new Map(); // pending fixes waiting for owner confirmation
    this.history = [];
    this.enabled = true;
    this.maxHistory = 200;
  }

  async init() {
    console.log('[DLAVIE][AUTOFIX-CTRL] Initialized');
  }

  async analyze(errorText, options = {}) {
    const analysis = {
      id: `fix_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      errorText,
      timestamp: Date.now(),
      deterministic: null,
      aiFallback: null,
      status: 'analyzing'
    };

    // 1. Run deterministic analysis
    try {
      analysis.deterministic = await runDeterministicRepair({
        apply: false,
        errorText,
        source: options.source || 'autofix:analyze'
      });
    } catch (err) {
      analysis.deterministic = { ok: false, error: err.message };
    }

    // 2. AI fallback if configured
    if (config.autoFix.aiFallback && options.useAi !== false) {
      try {
        const aiResult = await askAiFallback({
          errorText,
          provider: options.provider || 'auto',
          context: options.context || 'Auto Fix Controller analysis'
        });
        analysis.aiFallback = aiResult;
      } catch (err) {
        analysis.aiFallback = { error: err.message };
      }
    }

    analysis.status = 'pending_confirmation';
    this.pending.set(analysis.id, analysis);
    this.addHistory(analysis);

    return analysis;
  }

  async apply(id) {
    const analysis = this.pending.get(id);
    if (!analysis) return { success: false, error: 'Fix not found' };
    if (analysis.status !== 'pending_confirmation') {
      return { success: false, error: 'Fix is not pending confirmation' };
    }

    const result = {
      id,
      applied: false,
      deterministic: null,
      aiApplied: false,
      timestamp: Date.now()
    };

    // Apply deterministic fixes
    try {
      result.deterministic = await runDeterministicRepair({
        apply: true,
        errorText: analysis.errorText,
        source: `autofix:apply:${id}`
      });
      result.applied = true;
    } catch (err) {
      result.deterministic = { ok: false, error: err.message };
    }

    analysis.status = 'applied';
    this.pending.delete(id);
    this.addHistory({ ...analysis, status: 'applied' });

    return result;
  }

  async reject(id) {
    const analysis = this.pending.get(id);
    if (!analysis) return { success: false, error: 'Fix not found' };

    analysis.status = 'rejected';
    this.pending.delete(id);
    this.addHistory({ ...analysis, status: 'rejected' });

    return { success: true, id, status: 'rejected' };
  }

  async toggle(enabled) {
    this.enabled = enabled;
    return { success: true, enabled: this.enabled };
  }

  async getPending() {
    return Array.from(this.pending.values());
  }

  async getHistory(limit = 50) {
    return this.history.slice(-limit).reverse();
  }

  addHistory(entry) {
    this.history.push(entry);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory / 2);
    }
  }

  async getStatus() {
    return {
      active: true,
      enabled: this.enabled,
      pendingCount: this.pending.size,
      totalHistory: this.history.length
    };
  }

  shutdown() {
    this.pending.clear();
  }
}

module.exports = { AutoFixController };
