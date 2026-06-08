const fsp = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..', '..');
const REPORT_PATH = path.join(ROOT_DIR, 'logs', 'dlavie-autofix-report.json');

const SAFE_INSTALL_ALLOWLIST = new Set([
  '@whiskeysockets/baileys',
  'dotenv',
  'pino',
  'qrcode-terminal',
  'axios',
  'express'
]);

const REQUIRED_DIRS = ['src', 'commands', 'logs', 'tmp'];

const DEFAULT_PACKAGE = {
  name: 'dlavie-os-bot',
  version: '1.0.0',
  description: 'DLavie OS - WhatsApp Multi-Device Bot',
  main: 'index.js',
  scripts: {
    start: 'node index.js',
    doctor: 'node scripts/dlavie-autofix.js',
    autofix: 'node scripts/dlavie-autofix.js --apply'
  },
  engines: { node: '>=18' },
  dependencies: {
    '@whiskeysockets/baileys': '^6.7.18',
    dotenv: '^16.5.0',
    pino: '^9.7.0'
  }
};

async function exists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function backup(filePath, report) {
  if (!(await exists(filePath))) return;
  const backupPath = `${filePath}.bak-${Date.now()}`;
  await fsp.copyFile(filePath, backupPath);
  report.changed.push(`backup:${path.relative(ROOT_DIR, backupPath)}`);
}

async function ensureDir(relativeDir, apply, report) {
  const fullPath = path.join(ROOT_DIR, relativeDir);
  if (await exists(fullPath)) {
    report.actions.push(`OK directory:${relativeDir}`);
    return;
  }

  if (!apply) {
    report.recommendations.push(`Buat folder '${relativeDir}'.`);
    return;
  }

  await fsp.mkdir(fullPath, { recursive: true });
  report.changed.push(`created directory:${relativeDir}`);
}

async function readPackage(apply, report) {
  const filePath = path.join(ROOT_DIR, 'package.json');
  if (!(await exists(filePath))) return null;

  try {
    return JSON.parse(await fsp.readFile(filePath, 'utf8'));
  } catch (err) {
    report.errors.push(`package.json tidak valid: ${err.message}`);
    if (apply) {
      await backup(filePath, report);
      await fsp.writeFile(filePath, JSON.stringify(DEFAULT_PACKAGE, null, 2) + '\n', 'utf8');
      report.changed.push('repaired file:package.json');
      return { ...DEFAULT_PACKAGE };
    }
    report.recommendations.push('Perbaiki package.json atau jalankan npm run autofix.');
    return null;
  }
}

async function repairPackage(apply, report) {
  const filePath = path.join(ROOT_DIR, 'package.json');
  if (!(await exists(filePath))) {
    if (apply) {
      await fsp.writeFile(filePath, JSON.stringify(DEFAULT_PACKAGE, null, 2) + '\n', 'utf8');
      report.changed.push('created file:package.json');
    } else {
      report.recommendations.push('Buat package.json standar DLavie OS Bot.');
    }
    return;
  }

  const pkg = await readPackage(apply, report);
  if (!pkg) return;

  const next = {
    ...pkg,
    main: pkg.main || 'index.js',
    scripts: {
      ...(pkg.scripts || {}),
      start: pkg.scripts?.start || 'node index.js',
      doctor: pkg.scripts?.doctor || 'node scripts/dlavie-autofix.js',
      autofix: pkg.scripts?.autofix || 'node scripts/dlavie-autofix.js --apply'
    },
    engines: { ...(pkg.engines || {}), node: pkg.engines?.node || '>=18' },
    dependencies: { ...(pkg.dependencies || {}) }
  };

  for (const [dep, version] of Object.entries(DEFAULT_PACKAGE.dependencies)) {
    if (!next.dependencies[dep]) next.dependencies[dep] = version;
  }

  if (JSON.stringify(pkg, null, 2) === JSON.stringify(next, null, 2)) {
    report.actions.push('OK package.json');
    return;
  }

  if (!apply) {
    report.recommendations.push('Sinkronkan package.json: scripts start/doctor/autofix, engines.node, dan dependency inti.');
    return;
  }

  await backup(filePath, report);
  await fsp.writeFile(filePath, JSON.stringify(next, null, 2) + '\n', 'utf8');
  report.changed.push('updated file:package.json');
}

function detectErrorFixes(errorText = '') {
  const text = String(errorText || '');
  const fixes = [];

  const missingModule = text.match(/Cannot find module ['\"]([^'\"]+)['\"]/i);
  if (missingModule) {
    const moduleName = missingModule[1];
    fixes.push({
      type: 'missing_module',
      moduleName,
      canInstall: SAFE_INSTALL_ALLOWLIST.has(moduleName),
      message: SAFE_INSTALL_ALLOWLIST.has(moduleName)
        ? `Dependency '${moduleName}' hilang dan aman di-install otomatis.`
        : `Dependency '${moduleName}' hilang, tetapi tidak ada di allowlist auto-install.`
    });
  }

  if (/ENOENT/i.test(text) && /commands/i.test(text)) fixes.push({ type: 'missing_commands_dir', message: 'Folder commands hilang.' });
  if (/Unexpected token|JSON\.parse|package\.json/i.test(text) && /package/i.test(text)) fixes.push({ type: 'bad_package_json', message: 'package.json kemungkinan rusak.' });
  if (/logged out|DisconnectReason\.loggedOut|statusCode[^\n]*401|\b401\b/i.test(text)) fixes.push({ type: 'wa_logged_out', message: 'Session WhatsApp logout. Auto-fix tidak menghapus auth otomatis agar session tidak hilang tanpa izin.' });
  if (/bad mac|decrypt|stream errored|connection closed/i.test(text)) fixes.push({ type: 'wa_session_or_network', message: 'Kemungkinan session WhatsApp atau koneksi bermasalah.' });
  if (/EADDRINUSE/i.test(text)) fixes.push({ type: 'port_in_use', message: 'Port sedang dipakai proses lain.' });
  if (/EACCES|EPERM/i.test(text)) fixes.push({ type: 'permission_error', message: 'Permission file/folder bermasalah.' });
  if (/SyntaxError|Unexpected token/i.test(text) && !/package/i.test(text)) fixes.push({ type: 'syntax_error', message: 'Syntax error terdeteksi. Non-AI mode tidak aman menebak patch kode arbitrer.' });

  return fixes;
}

function execFileAsync(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd: ROOT_DIR, timeout: 120000 }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function applyFix(fix, options, report) {
  if (fix.type === 'missing_commands_dir') return ensureDir('commands', true, report);
  if (fix.type === 'bad_package_json') return repairPackage(true, report);

  if (fix.type === 'missing_module') {
    if (fix.canInstall && options.installMissing) {
      await execFileAsync('npm', ['install', fix.moduleName, '--save']);
      report.changed.push(`installed dependency:${fix.moduleName}`);
    } else if (fix.canInstall) {
      report.recommendations.push(`Jalankan: npm install ${fix.moduleName} --save atau !fix install ${fix.moduleName}`);
    } else {
      report.recommendations.push(`Install manual diperlukan untuk '${fix.moduleName}' karena tidak ada di allowlist.`);
    }
    return;
  }

  const recommendationMap = {
    wa_logged_out: 'Jika benar-benar logout: backup lalu hapus folder auth_info_baileys, restart bot, dan pairing ulang.',
    wa_session_or_network: 'Restart bot dulu. Jika error tetap sama, lakukan pairing ulang setelah backup auth_info_baileys.',
    port_in_use: 'Matikan proses lama atau ubah PORT. Di Replit, gunakan Stop lalu Run ulang.',
    permission_error: 'Periksa permission file/folder. Di Replit biasanya cukup restart repl atau restore file dari GitHub.',
    syntax_error: 'Gunakan fallback AI: !fix ai <paste error> atau node scripts/dlavie-autofix.js --ai "error".'
  };

  if (recommendationMap[fix.type]) report.recommendations.push(recommendationMap[fix.type]);
}

async function writeReport(report) {
  await fsp.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fsp.writeFile(REPORT_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');
}

async function runDeterministicRepair(options = {}) {
  const report = {
    ok: true,
    engine: 'DLavie Deterministic Auto-Fix',
    apply: Boolean(options.apply),
    source: options.source || 'manual',
    timestamp: new Date().toISOString(),
    actions: [],
    changed: [],
    recommendations: [],
    errors: [],
    detectedFixes: []
  };

  try {
    for (const dir of REQUIRED_DIRS) await ensureDir(dir, report.apply, report);
    await repairPackage(report.apply, report);

    const fixes = detectErrorFixes(options.errorText || '');
    report.detectedFixes = fixes.map(({ type, moduleName, canInstall, message }) => ({ type, moduleName, canInstall, message }));

    if (report.apply) {
      for (const fix of fixes) await applyFix(fix, options, report);
      await writeReport(report);
    } else {
      for (const fix of fixes) report.recommendations.push(fix.message);
    }
  } catch (err) {
    report.ok = false;
    report.errors.push(err.stack || err.message || String(err));
  }

  return report;
}

function formatRepairReport(report) {
  const lines = [];
  lines.push(`🛠️ ${report.engine}`);
  lines.push(`Mode: ${report.apply ? 'APPLY' : 'CHECK'} | Status: ${report.ok ? 'OK' : 'ERROR'}`);

  if (report.changed.length) {
    lines.push('\n✅ Perubahan:');
    for (const item of report.changed.slice(0, 12)) lines.push(`- ${item}`);
  }

  if (report.detectedFixes?.length) {
    lines.push('\n🔎 Error dikenali:');
    for (const fix of report.detectedFixes.slice(0, 8)) lines.push(`- ${fix.message}`);
  }

  if (report.recommendations.length) {
    lines.push('\n📌 Rekomendasi:');
    for (const item of report.recommendations.slice(0, 12)) lines.push(`- ${item}`);
  }

  if (report.errors.length) {
    lines.push('\n❌ Error Auto-Fix:');
    for (const item of report.errors.slice(0, 4)) lines.push(`- ${String(item).split('\n')[0]}`);
  }

  if (!report.changed.length && !report.recommendations.length && !report.errors.length) lines.push('\n✅ Tidak ada masalah deterministik yang perlu diperbaiki.');
  return lines.join('\n');
}

module.exports = { ROOT_DIR, SAFE_INSTALL_ALLOWLIST, detectErrorFixes, runDeterministicRepair, formatRepairReport };
