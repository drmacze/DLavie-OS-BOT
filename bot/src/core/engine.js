/**
 * DLavie OS - Core Engine
 * Main orchestrator that ties all systems together.
 * This engine never crashes - it catches all errors and self-heals.
 */

const config = require('../config');
const { getSupabaseClient, isConnected: isSupabaseConnected } = require('../database/supabase');
const { isConnected: isPgConnected, getDashboardStats } = require('../database/replitPg');
const { TokenEngine } = require('../token/tokenEngine');
const { PermissionManager } = require('../security/permissions');
const { HealthMonitor } = require('../monitoring/healthMonitor');
const { ErrorAggregator } = require('../monitoring/errorAggregator');
const { MultiBotManager } = require('../multiBot/multiBot');
const { PluginManager } = require('../plugins/pluginManager');
const { AuditLogger } = require('../security/auditLogger');
const { AutoFixController } = require('../selfRepair/autoFixController');
const { WebhookManager } = require('../api/webhookManager');

class DlavieEngine {
  constructor() {
    this.startedAt = Date.now();
    this.systems = new Map();
    this.isRunning = false;
    this.emergencyLockdown = false;
    this.gracefulShutdown = false;
  }

  async init() {
    try {
      console.log('[DLAVIE][ENGINE] Initializing DLavie OS Core Engine v2.0...');

      // 1. Audit Logger (always first, records everything)
      this.systems.set('audit', new AuditLogger());
      await this.systems.get('audit').init();

      // 2. Permission Manager
      this.systems.set('permissions', new PermissionManager());
      await this.systems.get('permissions').init();

      // 3. Token Engine
      this.systems.set('token', new TokenEngine());
      await this.systems.get('token').init();

      // 4. Health Monitor
      this.systems.set('health', new HealthMonitor());
      await this.systems.get('health').init();

      // 5. Error Aggregator
      this.systems.set('errors', new ErrorAggregator());
      await this.systems.get('errors').init();

      // 6. Multi Bot Manager
      this.systems.set('multiBot', new MultiBotManager());
      await this.systems.get('multiBot').init();

      // 7. Plugin Manager
      this.systems.set('plugins', new PluginManager());
      await this.systems.get('plugins').init();

      // 8. Auto Fix Controller
      this.systems.set('autoFix', new AutoFixController());
      await this.systems.get('autoFix').init();

      // 9. Webhook Manager (if enabled)
      if (config.website.enableWebhook) {
        this.systems.set('webhook', new WebhookManager());
        await this.systems.get('webhook').init();
      }

      // 10. Database check
      if (isPgConnected()) {
        console.log('[DLAVIE][ENGINE] Replit PostgreSQL database connected.');
      } else if (isSupabaseConnected()) {
        console.log('[DLAVIE][ENGINE] Supabase database connected.');
      } else {
        console.log('[DLAVIE][ENGINE] No database configured. Running in local mode.');
      }

      this.isRunning = true;
      console.log('[DLAVIE][ENGINE] All systems initialized successfully.');
      return true;
    } catch (err) {
      console.error('[DLAVIE][ENGINE][CRITICAL] Init failed:', err.message);
      console.error(err.stack);
      // Engine still starts in degraded mode - no crash
      this.isRunning = true;
      return false;
    }
  }

  getSystem(name) {
    return this.systems.get(name);
  }

  async getStatus() {
    const status = {
      engine: 'running',
      uptime: Date.now() - this.startedAt,
      startedAt: new Date(this.startedAt).toISOString(),
      emergencyLockdown: this.emergencyLockdown,
      systems: {}
    };

    for (const [name, system] of this.systems) {
      try {
        if (system.getStatus) {
          status.systems[name] = await system.getStatus();
        } else {
          status.systems[name] = { active: true };
        }
      } catch (err) {
        status.systems[name] = { active: false, error: err.message };
      }
    }

    return status;
  }

  async triggerEmergencyLockdown() {
    this.emergencyLockdown = true;
    console.log('[DLAVIE][ENGINE] EMERGENCY LOCKDOWN ACTIVATED');
    for (const [name, system] of this.systems) {
      try {
        if (system.onLockdown) await system.onLockdown();
      } catch (err) {
        console.error(`[DLAVIE][ENGINE] Lockdown error in ${name}:`, err.message);
      }
    }
  }

  async liftEmergencyLockdown() {
    this.emergencyLockdown = false;
    console.log('[DLAVIE][ENGINE] Emergency lockdown lifted');
    for (const [name, system] of this.systems) {
      try {
        if (system.onLiftLockdown) await system.onLiftLockdown();
      } catch (err) {
        console.error(`[DLAVIE][ENGINE] Lift lockdown error in ${name}:`, err.message);
      }
    }
  }

  async shutdown() {
    this.gracefulShutdown = true;
    console.log('[DLAVIE][ENGINE] Graceful shutdown initiated...');
    for (const [name, system] of this.systems) {
      try {
        if (system.shutdown) await system.shutdown();
        console.log(`[DLAVIE][ENGINE] ${name} shutdown OK`);
      } catch (err) {
        console.error(`[DLAVIE][ENGINE] Shutdown error in ${name}:`, err.message);
      }
    }
    this.isRunning = false;
    console.log('[DLAVIE][ENGINE] Shutdown complete.');
  }
}

// Singleton instance
let engineInstance = null;

function getEngine() {
  if (!engineInstance) engineInstance = new DlavieEngine();
  return engineInstance;
}

module.exports = { DlavieEngine, getEngine };
