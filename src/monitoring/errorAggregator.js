/**
 * DLavie OS - Smart Error Aggregator
 * Aggregates and analyzes errors across all bots.
 */

class ErrorAggregator {
  constructor() {
    this.errors = new Map(); // errorHash -> { count, firstSeen, lastSeen, contexts, resolved }
    this.patterns = new Map();
    this.totalErrors = 0;
  }

  async init() {
    console.log('[DLAVIE][ERROR-AGG] Initialized');
  }

  hashError(errorText) {
    // Simple hash based on error type + message
    const text = String(errorText || '').toLowerCase();
    const type = text.match(/error:?s*([a-z0-9_]+)/i)?.[1] || 'unknown';
    const msg = text.split('\n')[0].slice(0, 100);
    return `${type}::${msg}`;
  }

  report(error, context = {}) {
    const hash = this.hashError(error.stack || error.message || String(error));
    const now = Date.now();

    if (this.errors.has(hash)) {
      const entry = this.errors.get(hash);
      entry.count++;
      entry.lastSeen = now;
      if (context.botId) entry.contexts.add(context.botId);
      if (context.source) entry.sources.add(context.source);
    } else {
      this.errors.set(hash, {
        hash,
        error: error.message || String(error),
        stack: error.stack?.slice(0, 500) || '',
        count: 1,
        firstSeen: now,
        lastSeen: now,
        contexts: new Set(context.botId ? [context.botId] : []),
        sources: new Set(context.source ? [context.source] : []),
        resolved: false,
        severity: this.calculateSeverity(error)
      });
    }

    this.totalErrors++;
    return this.errors.get(hash);
  }

  calculateSeverity(error) {
    const text = String(error.stack || error.message || '').toLowerCase();
    if (text.includes('fatal') || text.includes('crash') || text.includes('uncaught')) return 'critical';
    if (text.includes('timeout') || text.includes('refused') || text.includes('econn')) return 'high';
    if (text.includes('error') || text.includes('failed')) return 'medium';
    return 'low';
  }

  async getErrorSummary() {
    const entries = Array.from(this.errors.values())
      .filter(e => !e.resolved)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return entries.map(e => ({
      hash: e.hash,
      error: e.error,
      count: e.count,
      severity: e.severity,
      firstSeen: e.firstSeen,
      lastSeen: e.lastSeen,
      contexts: Array.from(e.contexts),
      sources: Array.from(e.sources),
      resolved: e.resolved
    }));
  }

  async getErrorPattern() {
    const patterns = {};
    for (const [hash, entry] of this.errors) {
      const type = entry.error.split(':')[0] || 'unknown';
      if (!patterns[type]) patterns[type] = { count: 0, errors: [] };
      patterns[type].count += entry.count;
      patterns[type].errors.push({ hash, count: entry.count, severity: entry.severity });
    }
    return patterns;
  }

  async resolve(hash) {
    const entry = this.errors.get(hash);
    if (entry) {
      entry.resolved = true;
      return true;
    }
    return false;
  }

  async getStatus() {
    return {
      active: true,
      totalErrors: this.totalErrors,
      uniqueErrors: this.errors.size,
      unresolved: Array.from(this.errors.values()).filter(e => !e.resolved).length
    };
  }
}

module.exports = { ErrorAggregator };
