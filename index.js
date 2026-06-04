try { require('dotenv').config(); } catch { /* dotenv optional during auto-repair */ }

const { runDeterministicRepair, formatRepairReport } = require('./src/selfRepair/deterministicRepair');
const { askAiFallback } = require('./src/selfRepair/aiFallback');

let handlingFatal = false;

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

  const { connectToWhatsApp } = require('./src/bot');
  await connectToWhatsApp();
}

process.on('uncaughtException', (err) => handleFatal(err, 'uncaughtException'));
process.on('unhandledRejection', (err) => handleFatal(err, 'unhandledRejection'));

boot().catch((err) => handleFatal(err, 'boot'));
