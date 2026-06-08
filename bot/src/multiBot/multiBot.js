/**
 * DLavie OS - Multi Bot Manager
 * Manages multiple connected WhatsApp bots from users.
 */

const config = require('../config');
const { getSupabaseClient } = require('../database/supabase');
const { isConnected: isPgConnected, registerBot, getBotByToken, getBotsByOwner, updateBotStatus } = require('../database/replitPg');
const NodeCache = require('node-cache');

class MultiBotManager {
  constructor() {
    this.bots = new Map();
    this.heartbeatTimers = new Map();
    this.healthScores = new Map();
    this.groups = new Map();
    this.cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
  }

  async init() {
    console.log('[DLAVIE][MULTIBOT] Initialized');
  }

  async registerBot(token, botInfo) {
    try {
      const bot = {
        id: token,
        name: botInfo.name || 'Unknown Bot',
        phoneNumber: botInfo.phoneNumber || '',
        ownerId: botInfo.ownerId || '',
        status: 'connecting',
        lastHeartbeat: Date.now(),
        healthScore: 100,
        connectedAt: Date.now(),
        version: botInfo.version || '1.0.0',
        metadata: botInfo.metadata || {},
        capabilities: botInfo.capabilities || [],
        ip: botInfo.ip || 'unknown',
        platform: botInfo.platform || 'unknown'
      };

      this.bots.set(token, bot);
      this.healthScores.set(token, 100);
      this.startHeartbeat(token);

      console.log(`[DLAVIE][MULTIBOT] Bot registered: ${bot.name} (${token})`);
      return bot;
    } catch (err) {
      console.error('[DLAVIE][MULTIBOT] Register bot error:', err.message);
      return null;
    }
  }

  async unregisterBot(token) {
    try {
      this.stopHeartbeat(token);
      const bot = this.bots.get(token);
      if (bot) {
        this.bots.delete(token);
        this.healthScores.delete(token);
        this.cache.del(`bot_${token}`);
        console.log(`[DLAVIE][MULTIBOT] Bot unregistered: ${token}`);
      }
      return true;
    } catch (err) {
      console.error('[DLAVIE][MULTIBOT] Unregister bot error:', err.message);
      return false;
    }
  }

  async heartbeat(token, data) {
    try {
      const bot = this.bots.get(token);
      if (!bot) return false;

      bot.lastHeartbeat = Date.now();
      bot.status = 'online';

      if (data) {
        if (data.memoryUsage) bot.memoryUsage = data.memoryUsage;
        if (data.cpuUsage) bot.cpuUsage = data.cpuUsage;
        if (data.uptime) bot.uptime = data.uptime;
        if (data.activePlugins) bot.activePlugins = data.activePlugins;
        if (data.errors) bot.recentErrors = data.errors;
        if (data.messagesProcessed) bot.messagesProcessed = data.messagesProcessed;
      }

      // Calculate health score
      let health = 100;
      if (bot.memoryUsage && bot.memoryUsage > 80) health -= 15;
      if (bot.cpuUsage && bot.cpuUsage > 70) health -= 10;
      if (bot.recentErrors && bot.recentErrors.length > 5) health -= 20;
      if (Date.now() - bot.lastHeartbeat > 120000) health -= 30;
      bot.healthScore = Math.max(0, Math.min(100, health));
      this.healthScores.set(token, bot.healthScore);

      return true;
    } catch (err) {
      console.error('[DLAVIE][MULTIBOT] Heartbeat error:', err.message);
      return false;
    }
  }

  startHeartbeat(token) {
    // Check if bot is alive periodically
    const interval = setInterval(() => {
      const bot = this.bots.get(token);
      if (!bot) {
        clearInterval(interval);
        return;
      }
      const timeSinceHeartbeat = Date.now() - bot.lastHeartbeat;
      if (timeSinceHeartbeat > 300000) { // 5 minutes
        bot.status = 'offline';
        bot.healthScore = Math.max(0, bot.healthScore - 20);
        this.healthScores.set(token, bot.healthScore);
      }
    }, config.multiBot.heartbeatInterval * 1000);
    this.heartbeatTimers.set(token, interval);
  }

  stopHeartbeat(token) {
    const timer = this.heartbeatTimers.get(token);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(token);
    }
  }

  async relayCommand(token, command, args = {}) {
    try {
      const bot = this.bots.get(token);
      if (!bot) return { success: false, error: 'Bot not found' };
      if (bot.status !== 'online') return { success: false, error: 'Bot is offline' };

      // In a real implementation, this would send via WebSocket or API
      // For now, we queue the command
      const queue = this.cache.get(`queue_${token}`) || [];
      queue.push({ command, args, timestamp: Date.now() });
      this.cache.set(`queue_${token}`, queue);

      console.log(`[DLAVIE][MULTIBOT] Command relayed to ${token}: ${command}`);
      return { success: true, queued: true };
    } catch (err) {
      console.error('[DLAVIE][MULTIBOT] Relay command error:', err.message);
      return { success: false, error: err.message };
    }
  }

  async bulkCommand(tokens, command, args = {}) {
    const results = [];
    for (const token of tokens) {
      const result = await this.relayCommand(token, command, args);
      results.push({ token, ...result });
    }
    return results;
  }

  async getBotStatus(token) {
    const bot = this.bots.get(token);
    if (!bot) return null;
    return {
      id: bot.id,
      name: bot.name,
      status: bot.status,
      healthScore: bot.healthScore,
      uptime: bot.uptime,
      memoryUsage: bot.memoryUsage,
      cpuUsage: bot.cpuUsage,
      connectedAt: bot.connectedAt,
      lastHeartbeat: bot.lastHeartbeat,
      version: bot.version,
      activePlugins: bot.activePlugins || [],
      messagesProcessed: bot.messagesProcessed || 0
    };
  }

  async getAllBots() {
    return Array.from(this.bots.values()).map(bot => ({
      id: bot.id,
      name: bot.name,
      phoneNumber: bot.phoneNumber,
      status: bot.status,
      healthScore: bot.healthScore,
      lastHeartbeat: bot.lastHeartbeat
    }));
  }

  async getBotsByOwner(ownerId) {
    return Array.from(this.bots.values())
      .filter(bot => bot.ownerId === ownerId)
      .map(bot => ({
        id: bot.id,
        name: bot.name,
        status: bot.status,
        healthScore: bot.healthScore
      }));
  }

  async createGroup(name, ownerId, botTokens = []) {
    const group = {
      id: `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      ownerId,
      botTokens,
      createdAt: Date.now()
    };
    this.groups.set(group.id, group);
    return group;
  }

  async getGroup(id) {
    return this.groups.get(id) || null;
  }

  async getGroupsByOwner(ownerId) {
    return Array.from(this.groups.values()).filter(g => g.ownerId === ownerId);
  }

  async getStatus() {
    return {
      active: true,
      totalBots: this.bots.size,
      onlineBots: Array.from(this.bots.values()).filter(b => b.status === 'online').length,
      offlineBots: Array.from(this.bots.values()).filter(b => b.status === 'offline').length,
      totalGroups: this.groups.size,
      averageHealth: this.calculateAverageHealth()
    };
  }

  calculateAverageHealth() {
    if (this.healthScores.size === 0) return 0;
    const scores = Array.from(this.healthScores.values());
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  shutdown() {
    for (const [token, timer] of this.heartbeatTimers) {
      clearInterval(timer);
    }
    this.heartbeatTimers.clear();
    this.cache.flushAll();
  }
}

module.exports = { MultiBotManager };
