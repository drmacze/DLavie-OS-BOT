try { require('dotenv').config(); } catch { /* dotenv optional during auto-repair */ }

const { runDeterministicRepair, formatRepairReport } = require('./src/selfRepair/deterministicRepair');
const { askAiFallback } = require('./src/selfRepair/aiFallback');
const { getEngine } = require('./src/core/engine');
const config = require('./src/config');

let handlingFatal = false;
let engineInitialized = false;

async function handleFatal(err, source = 'startup') {
  const errorText = err?.stack || err?.message || String(err);
  console.error(`[DLAVIE][FATAL][${source}]`, errorText);

  if (handlingFatal) return;
  handlingFatal = true;

  try {
    const report = await runDeterministicRepair({
      apply: true,
      installMissing: process.env.DLAVIE_AUTOFIX_INSTALL_MISSING === 'true',
      errorText,
      source: `fatal:${source}`
    });
    console.log(formatRepairReport(report));

    if (process.env.DLAVIE_AI_AUTOFIX === 'true') {
      try {
        const ai = await askAiFallback({ errorText, provider: 'auto', context: `Fatal source: ${source}` });
        console.log(`\n[DLAVIE][AI-FALLBACK][${ai.provider}]\n${ai.text}\n`);
      } catch (aiErr) {
        console.error('[DLAVIE][AI-FALLBACK][ERROR]', aiErr.message);
      }
    }
  } finally {
    handlingFatal = false;
  }
}

async function boot() {
  if (process.env.DLAVIE_STARTUP_REPAIR !== 'false') {
    const report = await runDeterministicRepair({
      apply: true,
      installMissing: process.env.DLAVIE_AUTOFIX_INSTALL_MISSING === 'true',
      source: 'startup'
    });
    if (report.changed.length || report.recommendations.length || report.errors.length) {
      console.log(formatRepairReport(report));
    }
  }

  // Initialize DLavie Engine (core systems)
  try {
    const engine = getEngine();
    await engine.init();
    engineInitialized = true;
    console.log('[DLAVIE][MAIN] DLavie Engine initialized successfully');
  } catch (err) {
    console.error('[DLAVIE][MAIN] Engine init failed, continuing in degraded mode:', err.message);
  }

  // Start API server if enabled
  if (config.api.port) {
    try {
      require('./src/api/server');
      console.log(`[DLAVIE][MAIN] API server started on port ${config.api.port}`);
    } catch (err) {
      console.error('[DLAVIE][MAIN] API server failed:', err.message);
    }
  }

  // Start Web Dashboard
  try {
    const { startWebServer } = require('./web/server');
    startWebServer();
  } catch (err) {
    console.error('[DLAVIE][MAIN] Web dashboard failed to start:', err.message);
  }

  // Connect WhatsApp bot
  const { connectToWhatsApp } = require('./src/bot');
  await connectToWhatsApp();
}

process.on('uncaughtException', (err) => handleFatal(err, 'uncaughtException'));
process.on('unhandledRejection', (err) => handleFatal(err, 'unhandledRejection'));

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[DLAVIE][MAIN] SIGTERM received, shutting down gracefully...');
  try {
    const engine = getEngine();
    await engine.shutdown();
  } catch (err) {
    console.error('[DLAVIE][MAIN] Shutdown error:', err.message);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[DLAVIE][MAIN] SIGINT received, shutting down gracefully...');
  try {
    const engine = getEngine();
    await engine.shutdown();
  } catch (err) {
    console.error('[DLAVIE][MAIN] Shutdown error:', err.message);
  }
  process.exit(0);
});

boot().catch((err) => handleFatal(err, 'boot'));
