/**
 * DLavie OS - Token Engine
 * Central token management system for monetization.
 */

const config = require('../config');
const NodeCache = require('node-cache');

const FEATURE_COSTS = {
  'basic_command': { cost: 0, description: 'Basic commands' },
  'advanced_command': { cost: 5, description: 'Advanced commands' },
  'bot_connect': { cost: 50, description: 'Connect a bot' },
  'bot_relay': { cost: 3, description: 'Relay command to bot' },
  'plugin_install': { cost: 20, description: 'Install a plugin' },
  'plugin_update': { cost: 10, description: 'Update a plugin' },
  'monitor_advanced': { cost: 15, description: 'Advanced monitoring' },
  'ai_fallback': { cost: 50, description: 'AI fallback analysis' },
  'broadcast': { cost: 30, description: 'Broadcast message' },
  'scheduled_task': { cost: 10, description: 'Create scheduled task' },
  'file_upload': { cost: 25, description: 'Upload file via bot' },
  'export_data': { cost: 40, description: 'Export data' },
  'health_report': { cost: 20, description: 'Generate health report' },
  'diagnostic_run': { cost: 35, description: 'Run diagnostic' },
  'autofix_apply': { cost: 25, description: 'Apply auto-fix' },
  'autofix_ai': { cost: 50, description: 'AI auto-fix' }
};

class TokenEngine {
  constructor() {
    this.accounts = new Map(); // userId -> { balance, history, lastReset, rateLimit }
    this.rateLimiters = new Map();
    this.cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
  }

  async init() {
    console.log('[DLAVIE][TOKEN] Initialized');
  }

  registerAccount(userId) {
    if (this.accounts.has(userId)) return false;
    this.accounts.set(userId, {
      balance: config.token.defaultFreeTokens,
      history: [],
      lastReset: Date.now(),
      totalEarned: config.token.defaultFreeTokens,
      totalSpent: 0,
      referrals: [],
      referralBonus: 0
    });
    console.log(`[DLAVIE][TOKEN] Account registered: ${userId} with ${config.token.defaultFreeTokens} tokens`);
    return true;
  }

  getAccount(userId) {
    return this.accounts.get(userId) || null;
  }

  getBalance(userId) {
    const account = this.accounts.get(userId);
    if (!account) return 0;
    this.checkRateLimitReset(userId);
    return account.balance;
  }

  checkRateLimitReset(userId) {
    const account = this.accounts.get(userId);
    if (!account) return;
    const now = Date.now();
    const windowMs = config.token.rateLimitWindow * 1000;
    if (now - account.lastReset >= windowMs) {
      account.balance = Math.min(
        account.balance + config.token.rateLimitAmount,
        100000 // max cap
      );
      account.lastReset = now;
      console.log(`[DLAVIE][TOKEN] Rate limit reset for ${userId}: +${config.token.rateLimitAmount} tokens`);
    }
  }

  spend(userId, feature, quantity = 1) {
    const account = this.accounts.get(userId);
    if (!account) return { success: false, error: 'Account not found' };

    const costDef = FEATURE_COSTS[feature];
    if (!costDef) return { success: false, error: 'Unknown feature' };

    const cost = Math.round(costDef.cost * quantity * config.token.costMultiplier);

    if (account.balance < cost) {
      return {
        success: false,
        error: 'Insufficient tokens',
        balance: account.balance,
        required: cost,
        feature
      };
    }

    account.balance -= cost;
    account.totalSpent += cost;
    const transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'spend',
      feature,
      cost,
      quantity,
      balanceAfter: account.balance,
      timestamp: Date.now()
    };
    account.history.push(transaction);
    this.trimHistory(account);

    return {
      success: true,
      cost,
      balance: account.balance,
      transactionId: transaction.id,
      feature
    };
  }

  earn(userId, amount, reason = 'manual') {
    const account = this.accounts.get(userId);
    if (!account) return { success: false, error: 'Account not found' };

    account.balance += amount;
    account.totalEarned += amount;
    const transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'earn',
      amount,
      reason,
      balanceAfter: account.balance,
      timestamp: Date.now()
    };
    account.history.push(transaction);
    this.trimHistory(account);

    return {
      success: true,
      amount,
      balance: account.balance,
      transactionId: transaction.id,
      reason
    };
  }

  deduct(userId, amount, reason = 'manual') {
    const account = this.accounts.get(userId);
    if (!account) return { success: false, error: 'Account not found' };
    if (account.balance < amount) return { success: false, error: 'Insufficient tokens' };

    account.balance -= amount;
    const transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'deduct',
      amount,
      reason,
      balanceAfter: account.balance,
      timestamp: Date.now()
    };
    account.history.push(transaction);
    this.trimHistory(account);

    return {
      success: true,
      amount,
      balance: account.balance,
      transactionId: transaction.id,
      reason
    };
  }

  topup(userId, amount, paymentMethod = 'unknown') {
    const result = this.earn(userId, amount, `topup_${paymentMethod}`);
    if (result.success) {
      result.paymentMethod = paymentMethod;
    }
    return result;
  }

  addReferral(userId, referredUserId) {
    const account = this.accounts.get(userId);
    if (!account) return { success: false, error: 'Account not found' };
    if (account.referrals.includes(referredUserId)) {
      return { success: false, error: 'Already referred' };
    }
    account.referrals.push(referredUserId);
    const bonus = 500; // 500 tokens per referral
    account.referralBonus += bonus;
    this.earn(userId, bonus, 'referral_bonus');
    return {
      success: true,
      bonus,
      totalReferrals: account.referrals.length,
      totalReferralBonus: account.referralBonus
    };
  }

  getHistory(userId, limit = 50) {
    const account = this.accounts.get(userId);
    if (!account) return [];
    return account.history.slice(-limit).reverse();
  }

  getHeatmap(userId) {
    const account = this.accounts.get(userId);
    if (!account) return null;
    const now = Date.now();
    const oneDay = 86400000;
    const days = 7;
    const heatmap = [];
    for (let i = 0; i < days; i++) {
      const dayStart = now - (i * oneDay);
      const dayEnd = dayStart + oneDay;
      const dayTx = account.history.filter(tx => tx.timestamp >= dayStart && tx.timestamp < dayEnd);
      const spent = dayTx.filter(tx => tx.type === 'spend').reduce((sum, tx) => sum + tx.cost, 0);
      const earned = dayTx.filter(tx => tx.type === 'earn').reduce((sum, tx) => sum + tx.amount, 0);
      heatmap.push({
        day: new Date(dayStart).toISOString().split('T')[0],
        spent,
        earned,
        transactions: dayTx.length
      });
    }
    return heatmap.reverse();
  }

  isLow(userId, threshold = 500) {
    const balance = this.getBalance(userId);
    return balance < threshold;
  }

  getLowTokenWarning(userId) {
    const balance = this.getBalance(userId);
    if (balance < 100) return { warning: 'CRITICAL', message: 'Your tokens are critically low! Top up immediately.', balance };
    if (balance < 500) return { warning: 'LOW', message: 'Your tokens are running low. Consider topping up.', balance };
    if (balance < 1000) return { warning: 'MEDIUM', message: 'Your token balance is moderate.', balance };
    return { warning: 'NONE', message: 'Your token balance is healthy.', balance };
  }

  trimHistory(account) {
    const maxHistory = 1000;
    if (account.history.length > maxHistory) {
      account.history = account.history.slice(-maxHistory);
    }
  }

  getFeatureCosts() {
    return FEATURE_COSTS;
  }

  async getStatus() {
    const totalAccounts = this.accounts.size;
    let totalTokens = 0;
    let totalSpent = 0;
    let totalEarned = 0;
    for (const account of this.accounts.values()) {
      totalTokens += account.balance;
      totalSpent += account.totalSpent;
      totalEarned += account.totalEarned;
    }
    return {
      active: true,
      totalAccounts,
      totalTokens,
      totalSpent,
      totalEarned,
      defaultFreeTokens: config.token.defaultFreeTokens,
      rateLimit: `${config.token.rateLimitAmount} tokens / ${config.token.rateLimitWindow}s`
    };
  }
}

module.exports = { TokenEngine, FEATURE_COSTS };
