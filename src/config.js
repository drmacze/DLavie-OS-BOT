try { require('dotenv').config(); } catch { /* dotenv optional */ }

// Merge DLavieConfig.js jika ada
let userConfig = {};
try { userConfig = require('../DLavieConfig'); } catch (_) {}

const DEFAULT_OWNER_NUMBER = '62882007437216';

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '') || '';
}

const ownerNumber = firstValue(
  process.env.OWNER_NUMBER,
  process.env.BOT_OWNER,
  process.env.DLAVIE_OWNER_NUMBER,
  userConfig.bot?.ownerNumber,
  userConfig.ownerNumber,
  DEFAULT_OWNER_NUMBER
);

const botNumber = firstValue(
  process.env.BOT_NUMBER,
  userConfig.bot?.number,
  userConfig.botNumber
);

const botName = firstValue(
  process.env.BOT_NAME,
  userConfig.bot?.name,
  userConfig.botName,
  'DLavie OS'
);

const botPrefix = firstValue(
  process.env.BOT_PREFIX,
  userConfig.bot?.prefix,
  userConfig.botPrefix,
  '!'
);

const config = {
  // === Bot Identity ===
  botNumber,
  ownerNumber,
  botName,
  botPrefix,
  bot: {
    name: botName,
    number: botNumber,
    ownerNumber,
    prefix: botPrefix,
    language: firstValue(process.env.BOT_LANGUAGE, userConfig.bot?.language, 'id'),
    timezone: firstValue(process.env.BOT_TIMEZONE, userConfig.bot?.timezone, 'Asia/Jakarta'),
    version: userConfig.bot?.version || '2.0.0'
  },

  // === Supabase ===
  supabase: {
    url: process.env.SUPABASE_URL || userConfig.supabase?.url || '',
    anonKey: process.env.SUPABASE_ANON_KEY || userConfig.supabase?.anonKey || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || userConfig.supabase?.serviceRoleKey || ''
  },

  // === API Server ===
  api: {
    port: parseInt(process.env.API_PORT || userConfig.api?.port || '8080'),
    host: process.env.API_HOST || userConfig.api?.host || '0.0.0.0',
    jwtSecret: process.env.JWT_SECRET || userConfig.auth?.jwtSecret || 'dlavie-secret-key-change-in-production',
    jwtExpiry: process.env.JWT_EXPIRY || userConfig.auth?.jwtExpiry || '7d',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || userConfig.api?.corsOrigins || ['*']
  },

  // === WebSocket ===
  websocket: {
    port: parseInt(process.env.WS_PORT || userConfig.websocket?.port || '8081'),
    enabled: process.env.WS_ENABLED !== 'false'
  },

  // === DLavie Auto-Fix ===
  autoFix: {
    startupRepair: process.env.DLAVIE_STARTUP_REPAIR !== 'false',
    aiFallback: process.env.DLAVIE_AI_AUTOFIX === 'true',
    installMissing: process.env.DLAVIE_AUTOFIX_INSTALL_MISSING === 'true',
    providerOrder: process.env.DLAVIE_AI_ORDER || userConfig.autoFix?.aiOrder || 'grok,gemini,chatgpt'
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
    defaultFreeTokens: parseInt(process.env.DLAVIE_DEFAULT_FREE_TOKENS || userConfig.token?.defaultFreeTokens || '5000'),
    rateLimitAmount: parseInt(process.env.DLAVIE_RATE_LIMIT_AMOUNT || userConfig.token?.rateLimitAmount || '100'),
    rateLimitWindow: parseInt(process.env.DLAVIE_RATE_LIMIT_WINDOW || userConfig.token?.rateLimitWindowSec || userConfig.token?.rateLimitWindow || '600'),
    costMultiplier: parseFloat(process.env.DLAVIE_COST_MULTIPLIER || userConfig.token?.costMultiplier || '1.0')
  },

  // === Multi Bot ===
  multiBot: {
    maxBotsPerUser: parseInt(process.env.DLAVIE_MAX_BOTS_PER_USER || userConfig.multiBot?.maxBotsPerUser || '5'),
    heartbeatInterval: parseInt(process.env.DLAVIE_HEARTBEAT_INTERVAL || userConfig.multiBot?.heartbeatInterval || '30'),
    autoReconnect: process.env.DLAVIE_AUTO_RECONNECT !== 'false'
  },

  // === Security ===
  security: {
    ownerNumber,
    stealthMode: process.env.DLAVIE_STEALTH_MODE === 'true' || userConfig.security?.stealthMode === true,
    emergencyLockdown: process.env.DLAVIE_EMERGENCY_LOCKDOWN === 'true' || userConfig.security?.emergencyLockdown === true,
    maxLoginAttempts: parseInt(process.env.DLAVIE_MAX_LOGIN_ATTEMPTS || userConfig.security?.maxLoginAttempts || '5'),
    lockoutDuration: parseInt(process.env.DLAVIE_LOCKOUT_DURATION || userConfig.security?.lockoutDurationSec || userConfig.security?.lockoutDuration || '3600')
  },

  // === Monitoring ===
  monitoring: {
    healthCheckInterval: parseInt(process.env.DLAVIE_HEALTH_CHECK_INTERVAL || userConfig.monitoring?.healthCheckInterval || '60'),
    logRetention: parseInt(process.env.DLAVIE_LOG_RETENTION || userConfig.monitoring?.logRetention || '7'),
    anomalyThreshold: parseFloat(process.env.DLAVIE_ANOMALY_THRESHOLD || userConfig.monitoring?.anomalyThreshold || '0.8')
  },

  // === Plugin ===
  plugin: {
    registryUrl: process.env.DLAVIE_PLUGIN_REGISTRY || userConfig.plugin?.registryUrl || 'https://raw.githubusercontent.com/drmacze/DLavie-Plugins/main/registry.json',
    sandboxEnabled: process.env.DLAVIE_PLUGIN_SANDBOX !== 'false',
    autoUpdate: process.env.DLAVIE_PLUGIN_AUTO_UPDATE === 'true' || userConfig.plugin?.autoUpdate === true
  },

  // === Website Integration ===
  website: {
    dashboardUrl: process.env.DLAVIE_DASHBOARD_URL || process.env.DASHBOARD_URL || userConfig.website?.dashboardUrl || userConfig.web?.dashboardUrl || '',
    webhookUrl: process.env.DLAVIE_WEBHOOK_URL || userConfig.website?.webhookUrl || '',
    enableWebhook: process.env.DLAVIE_ENABLE_WEBHOOK === 'true' || userConfig.website?.enableWebhook === true
  },

  web: {
    port: parseInt(process.env.WEB_PORT || userConfig.web?.port || '5000'),
    dashboardUrl: process.env.DASHBOARD_URL || userConfig.web?.dashboardUrl || userConfig.website?.dashboardUrl || ''
  }
};

module.exports = config;
