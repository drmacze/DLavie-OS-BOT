#!/usr/bin/env node
try { require('dotenv').config(); } catch { /* dotenv optional during auto-repair */ }

const { runDeterministicRepair, formatRepairReport } = require('../src/selfRepair/deterministicRepair');
const { askAiFallback } = require('../src/selfRepair/aiFallback');

async function readStdinIfPiped() {
  if (process.stdin.isTTY) return '';
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
  });
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const ai = args.includes('--ai');
  const installMissing = args.includes('--install-missing');
  const providerArgIndex = args.indexOf('--provider');
  const provider = providerArgIndex >= 0 ? args[providerArgIndex + 1] || 'auto' : 'auto';

  const errorText = args
    .filter((arg, index) => {
      if (arg === '--apply' || arg === '--ai' || arg === '--install-missing') return false;
      if (arg === '--provider' || index === providerArgIndex + 1) return false;
      return true;
    })
    .join(' ')
    .trim() || (await readStdinIfPiped()).trim();

  const report = await runDeterministicRepair({ apply, installMissing, errorText, source: 'cli' });
  console.log(formatRepairReport(report));

  if (ai && errorText) {
    try {
      const result = await askAiFallback({ errorText, provider, context: 'CLI scripts/dlavie-autofix.js' });
      console.log(`\n🤖 AI fallback aktif: ${result.provider}\n`);
      console.log(result.text);
    } catch (err) {
      console.error(`\n🤖 AI fallback gagal: ${err.message}`);
      process.exitCode = 2;
    }
  }

  if (!report.ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[DLAVIE][AUTOFIX][FATAL]', err.stack || err.message || err);
  process.exit(1);
});
