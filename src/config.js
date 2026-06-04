try { require('dotenv').config(); } catch { /* dotenv optional */ }

const config = {
  // === Bot Identity ===
  botNumber: process.env.BOT_NUMBER || '',
  ownerNumber: process.env.OWNER_NUMBER || '',
  botName: process.env.BOT_NAME || 'DLavie OS',

  // === Supabase ===
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  },

  // === API Server ===
  api: {
    port: parseInt(process.env.API_PORT || '8080'),
    host: process.env.API_HOST || '0.0.0.0',
    jwtSecret: process.env.JWT_SECRET || 'dlavie-secret-key-change-in-production',
    jwtExpiry: process.env.JWT_EXPIRY || '7d',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*']
  },

  // === WebSocket ===
  websocket: {
    port: parseInt(process.env.WS_PORT || '8081'),
    enabled: process.env.WS_ENABLED !== 'false'
  },

  // === DLavie Auto-Fix ===
  autoFix: {
    startupRepair: process.env.DLAVIE_STARTUP_REPAIR !== 'false',
    aiFallback: process.env.DLAVIE_AI_AUTOFIX === 'true',
    installMissing: process.env.DLAVIE_AUTOFIX_INSTALL_MISSING === 'true',
    providerOrder: process.env.DLAVIE_AI_ORDER || 'grok,gemini,chatgpt'
  },

  // === AI Providers ===
  ai: {
    gemini: {
      enabled: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      key: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
    },
    chatgpt: {
      enabled: Boolean(process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY),
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      key: process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY || ''
    },
    grok: {
      enabled: Boolean(process.env.GROK_API_KEY || process.env.XAI_API_KEY),
      model: process.env.GROK_MODEL || 'grok-2-latest',
      key: process.env.GROK_API_KEY || process.env.XAI_API_KEY || ''
    }
  },

  // === Token System ===
  token: {
    defaultFreeTokens: parseInt(process.env.DLAVIE_DEFAULT_FREE_TOKENS || '5000'),
    rateLimitAmount: parseInt(process.env.DLAVIE_RATE_LIMIT_AMOUNT || '100'),
    rateLimitWindow: parseInt(process.env.DLAVIE_RATE_LIMIT_WINDOW || '600'),
    costMultiplier: parseFloat(process.env.DLAVIE_COST_MULTIPLIER || '1.0')
  },

  // === Multi Bot ===
  multiBot: {
    maxBotsPerUser: parseInt(process.env.DLAVIE_MAX_BOTS_PER_USER || '5'),
    heartbeatInterval: parseInt(process.env.DLAVIE_HEARTBEAT_INTERVAL || '30'),
    autoReconnect: process.env.DLAVIE_AUTO_RECONNECT !== 'false'
  },

  // === Security ===
  security: {
    stealthMode: process.env.DLAVIE_STEALTH_MODE === 'true',
    emergencyLockdown: process.env.DLAVIE_EMERGENCY_LOCKDOWN === 'true',
    maxLoginAttempts: parseInt(process.env.DLAVIE_MAX_LOGIN_ATTEMPTS || '5'),
    lockoutDuration: parseInt(process.env.DLAVIE_LOCKOUT_DURATION || '3600')
  },

  // === Monitoring ===
  monitoring: {
    healthCheckInterval: parseInt(process.env.DLAVIE_HEALTH_CHECK_INTERVAL || '60'),
    logRetention: parseInt(process.env.DLAVIE_LOG_RETENTION || '7'),
    anomalyThreshold: parseFloat(process.env.DLAVIE_ANOMALY_THRESHOLD || '0.8')
  },

  // === Plugin ===
  plugin: {
    registryUrl: process.env.DLAVIE_PLUGIN_REGISTRY || 'https://raw.githubusercontent.com/drmacze/DLavie-Plugins/main/registry.json',
    sandboxEnabled: process.env.DLAVIE_PLUGIN_SANDBOX !== 'false',
    autoUpdate: process.env.DLAVIE_PLUGIN_AUTO_UPDATE === 'true'
  },

  // === Website Integration ===
  website: {
    dashboardUrl: process.env.DLAVIE_DASHBOARD_URL || '',
    webhookUrl: process.env.DLAVIE_WEBHOOK_URL || '',
    enableWebhook: process.env.DLAVIE_ENABLE_WEBHOOK === 'true'
  }
};

module.exports = config;
