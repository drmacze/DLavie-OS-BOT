/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║           DLavie OS — Comprehensive Configuration            ║
 * ║         Edit file ini untuk mengatur semua pengaturan        ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * CARA PAKAI:
 * 1. Edit nilai di bawah sesuai kebutuhan kamu
 * 2. Untuk production, gunakan environment variables (.env)
 * 3. Env vars SELALU override nilai di sini
 *
 * FORMAT NOMOR WA: Tanpa + dan spasi. Contoh: 6285725483343
 */

module.exports = {

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. IDENTITAS BOT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  bot: {
    name:        process.env.BOT_NAME        || 'DLavie OS',
    number:      process.env.BOT_NUMBER      || '',     // ← Isi nomor WA bot kamu
    ownerNumber: process.env.OWNER_NUMBER    || '',     // ← Isi nomor WA owner
    prefix:      process.env.BOT_PREFIX      || '!',
    language:    process.env.BOT_LANGUAGE    || 'id',  // id / en
    timezone:    process.env.BOT_TIMEZONE    || 'Asia/Jakarta',
    version:     '2.0.0',
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. DATABASE — SUPABASE
  // Dapat di: supabase.com → Project Settings → API
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  supabase: {
    url:            process.env.SUPABASE_URL             || '',  // ← https://xxx.supabase.co
    anonKey:        process.env.SUPABASE_ANON_KEY        || '',  // ← Public anon key
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY|| '',  // ← SERVICE ROLE (RAHASIA!)
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. AUTHENTIKASI & JWT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  auth: {
    jwtSecret:          process.env.JWT_SECRET           || 'GANTI-DENGAN-STRING-RANDOM-PANJANG-MIN-32-CHAR',
    jwtExpiry:          process.env.JWT_EXPIRY           || '7d',
    sessionSecret:      process.env.SESSION_SECRET       || 'GANTI-SESSION-SECRET',
    botCodeExpiryMin:   parseInt(process.env.BOT_CODE_EXPIRY_MIN || '10'), // Kode bot expire (menit)
    maxLoginAttempts:   parseInt(process.env.MAX_LOGIN_ATTEMPTS  || '5'),
    lockoutDurationSec: parseInt(process.env.LOCKOUT_DURATION    || '3600'),
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. SERVER — API & WEB
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  api: {
    port: parseInt(process.env.API_PORT || '8080'),
    host: process.env.API_HOST || '0.0.0.0',
    corsOrigins: (process.env.CORS_ORIGINS || '*').split(','),
  },

  web: {
    port:         parseInt(process.env.WEB_PORT || '5000'),
    dashboardUrl: process.env.DASHBOARD_URL || '', // ← URL public setelah deploy (contoh: https://dlavie.replit.app)
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. SISTEM TOKEN (MONETISASI)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  token: {
    defaultFreeTokens:    parseInt(process.env.DEFAULT_FREE_TOKENS  || '5000'),
    rateLimitAmount:      parseInt(process.env.RATE_LIMIT_AMOUNT    || '100'), // Token di-refill
    rateLimitWindowSec:   parseInt(process.env.RATE_LIMIT_WINDOW    || '600'), // Per 10 menit
    costMultiplier:       parseFloat(process.env.COST_MULTIPLIER    || '1.0'),

    // Biaya per operasi (dalam token)
    costs: {
      basicCommand:   1,
      shellCommand:   10,
      bulkCommand:    20,
      scheduledTask:  5,
      botUpdate:      60,
      pluginInstall:  30,
      generatePlugin: 100,
      autoFixAI:      150,
      fileOperation:  15,
      relayCommand:   5,
    },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 6. MULTI-BOT CONTROL
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  multiBot: {
    maxBotsPerPlan: { free: 1, starter: 3, pro: 10, enterprise: 999 },
    heartbeatIntervalSec: parseInt(process.env.HEARTBEAT_INTERVAL || '30'),
    commandTimeoutSec:    parseInt(process.env.COMMAND_TIMEOUT    || '30'),
    autoReconnect:        process.env.AUTO_RECONNECT !== 'false',
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 7. ANTI-SPAM / QUEUE SYSTEM
  // User Free & Basic → masuk antrian
  // User Pro & Enterprise → langsung diproses
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  queue: {
    enabled:            process.env.QUEUE_ENABLED !== 'false',
    maxConcurrent:      parseInt(process.env.QUEUE_MAX_CONCURRENT  || '5'),  // Max proses bersamaan
    maxQueueSize:       parseInt(process.env.QUEUE_MAX_SIZE        || '50'), // Max antrian
    processIntervalMs:  parseInt(process.env.QUEUE_INTERVAL        || '800'),// Interval proses (ms)
    priorityPlans:      ['pro', 'enterprise'],                               // Plan yang bypass queue

    // Anti-Spam delays (ms)
    minDelayMs:  parseInt(process.env.ANTISPAM_MIN_DELAY  || '800'),
    maxDelayMs:  parseInt(process.env.ANTISPAM_MAX_DELAY  || '2500'),
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 8. ANTI-BAN WHATSAPP
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  antiBan: {
    enabled:             process.env.ANTI_BAN_ENABLED !== 'false',
    maxMsgPerMinute:     parseInt(process.env.MAX_MSG_PER_MIN    || '20'),
    maxMsgPerHour:       parseInt(process.env.MAX_MSG_PER_HOUR   || '200'),
    randomizeDelay:      process.env.RANDOMIZE_DELAY !== 'false',
    useTypingSimulation: process.env.USE_TYPING !== 'false',  // Simulasi mengetik
    typingDurationMs:    parseInt(process.env.TYPING_DURATION   || '1000'),
    cooldownOnLimitMs:   parseInt(process.env.COOLDOWN_ON_LIMIT || '60000'), // 1 menit cooldown
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 9. AUTO-FIX & AI PROVIDERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  autoFix: {
    enabled:         true,
    startupRepair:   true,
    requireApproval: true,
    providerOrder:   (process.env.AI_PROVIDER_ORDER || 'grok,gemini,chatgpt').split(','),

    ai: {
      gemini: {
        apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '', // ← aistudio.google.com
        model:  process.env.GEMINI_MODEL   || 'gemini-1.5-flash',
      },
      chatgpt: {
        apiKey: process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY || '', // ← platform.openai.com
        model:  process.env.OPENAI_MODEL   || 'gpt-4o-mini',
      },
      grok: {
        apiKey: process.env.GROK_API_KEY || process.env.XAI_API_KEY || '', // ← console.x.ai
        model:  process.env.GROK_MODEL   || 'grok-2-latest',
      },
    },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 10. PEMBAYARAN & TOPUP
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  payment: {
    qris: {
      enabled:      process.env.QRIS_ENABLED !== 'false',
      imageUrl:     process.env.QRIS_IMAGE_URL || '',  // ← URL gambar QRIS kamu (upload ke imgbb)
      merchantName: process.env.QRIS_MERCHANT  || 'DLavie OS',
      adminConfirm: true, // Admin harus konfirmasi pembayaran
    },

    // Harga token (Rupiah)
    tokenPackages: [
      { id: 'token_5k',   tokens: 5000,   priceIdr: 10000,  label: '5K Token'  },
      { id: 'token_15k',  tokens: 15000,  priceIdr: 25000,  label: '15K Token' },
      { id: 'token_50k',  tokens: 50000,  priceIdr: 70000,  label: '50K Token' },
      { id: 'token_150k', tokens: 150000, priceIdr: 180000, label: '150K Token'},
    ],

    // Pricing Plans
    plans: {
      free: {
        name: 'Free', priceIdr: 0, billingPeriod: 'forever',
        tokens: 5000, maxBots: 1, queuePriority: false,
        features: ['1 Bot', '5K Token/bulan', 'Basic Commands', 'Antrian Queue', 'Community Support'],
      },
      starter: {
        name: 'Starter', priceIdr: 29000, billingPeriod: 'month',
        tokens: 25000, maxBots: 3, queuePriority: false,
        features: ['3 Bot', '25K Token/bulan', 'Plugin Marketplace', 'Auto-Fix Basic', 'Antrian Queue', 'Email Support'],
      },
      pro: {
        name: 'Pro', priceIdr: 79000, billingPeriod: 'month',
        tokens: 100000, maxBots: 10, queuePriority: true,
        features: ['10 Bot', '100K Token/bulan', 'AI Auto-Fix', 'Shell Access', 'GitHub Plugin', 'NO Queue', 'Advanced Monitor', 'Priority Support'],
      },
      enterprise: {
        name: 'Enterprise', priceIdr: 199000, billingPeriod: 'month',
        tokens: -1, maxBots: -1, queuePriority: true,
        features: ['Unlimited Bot', 'Unlimited Token', 'Custom Plugin Builder', 'White Label', 'Full API Access', 'NO Queue', 'Dedicated Support'],
      },
    },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 11. PLUGIN MANAGER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  plugin: {
    sandboxEnabled:   true,
    autoUpdate:       false,
    allowedSources:   ['github.com'],
    maxPluginsPerBot: 20,
    githubToken:      process.env.GITHUB_TOKEN || '', // ← github.com → Settings → Personal access tokens
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 12. MONITORING & LOGGING
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  monitoring: {
    healthCheckIntervalSec: parseInt(process.env.HEALTH_INTERVAL || '60'),
    anomalyDetection:       true,
    logRetentionDays:       parseInt(process.env.LOG_RETENTION   || '30'),
    alertErrorThreshold:    parseInt(process.env.ALERT_THRESHOLD || '10'),
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 13. KEAMANAN BOT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  security: {
    stealthMode:          process.env.STEALTH_MODE    === 'true',
    emergencyLockdown:    process.env.LOCKDOWN        === 'true',
    requireLoginForMenu:  true,   // WAJIB login sebelum lihat menu
    auditLogEnabled:      true,
    allowedGroupIds:      [],     // Kosong = semua group diizinkan
    blockedUsers:         [],     // Blacklist nomor WA
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 14. NOTIFIKASI OWNER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  notifications: {
    sendToOwner:        true,
    notifyNewUser:      true,
    notifyError:        true,
    notifyTopup:        true,
    notifyBotConnect:   true,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 15. WEBHOOK
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  webhook: {
    enabled:       process.env.WEBHOOK_ENABLED === 'true',
    url:           process.env.WEBHOOK_URL     || '',
    secret:        process.env.WEBHOOK_SECRET  || '',
    retryAttempts: 3,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 16. SCHEDULER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  scheduler: {
    maxTasksPerUser:  10,
    timezone:         process.env.BOT_TIMEZONE || 'Asia/Jakarta',
    rollbackEnabled:  true,
  },
};
