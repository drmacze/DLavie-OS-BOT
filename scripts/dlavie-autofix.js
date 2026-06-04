try {
  require('dotenv').config();
} catch (err) {
  // dotenv is optional during auto-repair
}

const { runDeterministicRepair, formatRepairReport } = require('../src/selfRepair/deterministicRepair');
const { askAiFallback } = require('../src/selfRepair/aiFallback');

async function readStdinIfPiped() {
  if (process.stdin.isTTY) return '';

  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
  });
}

function getCliPayload(args, providerArgIndex) {
  return args
    .filter((arg, index) => {
      if (arg === '--apply') return false;
      if (arg === '--ai') return false;
      if (arg === '--install-missing') return false;
      if (arg === '--provider') return false;
      if (providerArgIndex >= 0 && index === providerArgIndex + 1) return false;
      return true;
    })
    .join(' ')
    .trim();
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const ai = args.includes('--ai');
  const installMissing = args.includes('--install-missing');
  const providerArgIndex = args.indexOf('--provider');
  const provider = providerArgIndex >= 0 ? (args[providerArgIndex + 1] || 'auto') : 'auto';

  let errorText = getCliPayload(args, providerArgIndex);
  if (!errorText) {
    errorText = (await readStdinIfPiped()).trim();
  }

  const report = await runDeterministicRepair({
    apply: apply,
    installMissing: installMissing,
    errorText: errorText,
    source: 'cli'
  });

  console.log(formatRepairReport(report));

  if (ai && errorText) {
    try {
      const result = await askAiFallback({
        errorText: errorText,
        provider: provider,
        context: 'CLI scripts/dlavie-autofix.js'
      });

      console.log('\n[DLAVIE][AI-FALLBACK] Provider: ' + result.provider + '\n');
      console.log(result.text);
    } catch (err) {
      console.error('\n[DLAVIE][AI-FALLBACK][ERROR] ' + err.message);
      process.exitCode = 2;
    }
  }

  if (!report.ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[DLAVIE][AUTOFIX][FATAL]', err.stack || err.message || err);
  process.exit(1);
});
