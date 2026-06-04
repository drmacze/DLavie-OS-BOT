'use strict';

/**
 * DLavie OS Safety Check
 *
 * Non-destructive validation for the WhatsApp command layer.
 * This script does not start the bot, does not connect to WhatsApp,
 * does not call external APIs, and does not modify files.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const COMMANDS_DIR = path.join(ROOT, 'commands');

const CRITICAL_COMMANDS = new Map([
  ['fix', 'PLG-FIX-27478353'],
  ['menu', 'PLG-MENU-18AF3EEA'],
  ['update', 'PLG-UPDATE-C6B2D6D8'],
  ['listcmd', 'PLG-LISTCMD-19DAAF57'],
  ['reload', 'PLG-RELOAD-180EACBA']
]);

const REQUIRED_ROOT_FILES = [
  'index.js',
  'package.json',
  'src/bot.js',
  'src/commandLoader.js',
  'src/config.js'
];

const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  'auth_info_baileys',
  'logs',
  'tmp'
]);

const results = {
  errors: [],
  warnings: [],
  info: []
};

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function addError(message) {
  results.errors.push(message);
}

function addWarning(message) {
  results.warnings.push(message);
}

function addInfo(message) {
  results.info.push(message);
}

function safeRequire(filePath) {
  try {
    delete require.cache[require.resolve(filePath)];
    return { ok: true, value: require(filePath) };
  } catch (err) {
    return { ok: false, error: err };
  }
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function checkRootFiles() {
  for (const file of REQUIRED_ROOT_FILES) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) addError(`Missing required file: ${file}`);
  }
}

function checkPackageJson() {
  const packagePath = path.join(ROOT, 'package.json');
  if (!fs.existsSync(packagePath)) return;

  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const scripts = pkg.scripts || {};
    for (const scriptName of ['start', 'doctor', 'autofix', 'safety:check']) {
      if (!scripts[scriptName]) addWarning(`package.json missing script: ${scriptName}`);
    }
    if (!pkg.engines || !pkg.engines.node) addWarning('package.json missing engines.node');
  } catch (err) {
    addError(`package.json is invalid JSON: ${err.message}`);
  }
}

function checkCommandFiles() {
  if (!fs.existsSync(COMMANDS_DIR)) {
    addWarning('commands directory does not exist. Bot may rely on external plugin registry/runtime storage.');
    return;
  }

  const files = fs.readdirSync(COMMANDS_DIR)
    .filter((file) => file.endsWith('.js'))
    .sort();

  const names = new Map();
  const aliases = new Map();
  const commandSummaries = [];

  for (const file of files) {
    const full = path.join(COMMANDS_DIR, file);
    const loaded = safeRequire(full);

    if (!loaded.ok) {
      addError(`Command failed to load: ${rel(full)} -> ${loaded.error.message}`);
      continue;
    }

    const cmd = loaded.value;
    if (!cmd || typeof cmd !== 'object') {
      addWarning(`Command file does not export an object: ${rel(full)}`);
      continue;
    }

    if (!cmd.name) {
      addWarning(`Command file has no name and will be ignored by commandLoader: ${rel(full)}`);
      continue;
    }

    if (typeof cmd.execute !== 'function') {
      addError(`Command has name but no execute function: ${rel(full)} (${cmd.name})`);
      continue;
    }

    const name = String(cmd.name).toLowerCase();
    commandSummaries.push({ name, file: rel(full), aliases: Array.isArray(cmd.aliases) ? cmd.aliases : [] });

    if (names.has(name)) {
      addError(`Duplicate command name '${name}': ${names.get(name)} and ${rel(full)}`);
    } else {
      names.set(name, rel(full));
    }

    if (Array.isArray(cmd.aliases)) {
      for (const aliasRaw of cmd.aliases) {
        const alias = String(aliasRaw).toLowerCase();
        if (!alias) continue;

        if (names.has(alias)) {
          addError(`Alias '${alias}' in ${rel(full)} conflicts with command name from ${names.get(alias)}`);
        }
        if (aliases.has(alias)) {
          addError(`Duplicate alias '${alias}': ${aliases.get(alias)} and ${rel(full)}`);
        } else {
          aliases.set(alias, rel(full));
        }
      }
    }
  }

  for (const [cmdName, pluginId] of CRITICAL_COMMANDS) {
    const exists = names.has(cmdName);
    if (!exists) addWarning(`Critical command '${cmdName}' (${pluginId}) not found in commands/. It may exist only in runtime registry.`);
  }

  addInfo(`Command files scanned: ${files.length}`);
  addInfo(`Executable commands found: ${names.size}`);
  addInfo(`Aliases found: ${aliases.size}`);

  if (commandSummaries.length) {
    addInfo('Commands: ' + commandSummaries.map((item) => item.name).sort().join(', '));
  }
}

function checkSuspiciousFiles() {
  const allFiles = walk(ROOT);
  const sensitivePatterns = [
    /^\.env$/,
    /auth_info_baileys\//,
    /creds\.json$/,
    /session/i,
    /apikey/i,
    /api_key/i
  ];

  for (const file of allFiles) {
    const relative = rel(file);
    if (relative === '.env') addError('.env is present in repository workspace. Do not commit secrets.');
    if (sensitivePatterns.some((pattern) => pattern.test(relative))) {
      if (!relative.includes('example') && !relative.includes('README') && !relative.includes('package-lock')) {
        addWarning(`Review potentially sensitive file before push: ${relative}`);
      }
    }
  }
}

function printSection(title, items) {
  console.log(`\n${title}`);
  if (!items.length) {
    console.log('  - none');
    return;
  }
  for (const item of items) console.log(`  - ${item}`);
}

function main() {
  console.log('DLavie OS Safety Check');
  console.log('Mode: read-only / non-destructive');

  checkRootFiles();
  checkPackageJson();
  checkCommandFiles();
  checkSuspiciousFiles();

  printSection('Errors', results.errors);
  printSection('Warnings', results.warnings);
  printSection('Info', results.info);

  if (results.errors.length) {
    console.log('\nResult: FAILED');
    process.exitCode = 1;
  } else {
    console.log('\nResult: PASSED');
  }
}

main();
