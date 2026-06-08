/**
 * DLavie OS — !update command v1.0
 * Safe GitHub update with backup, validation, and rollback.
 * No process.exit() — bot stays alive throughout.
 */

'use strict';

const { isOwnerMsg } = require('../src/utils/ownerUtils');
const { getBotCustomization } = require('../src/core/botCustomization');
const { loadCommands } = require('../src/commandLoader');
const { getPool } = require('../src/database/replitPg');
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs   = require('fs');

const ROOT        = path.join(__dirname, '..');
const BACKUP_DIR  = path.join(ROOT, 'tmp', 'update_backups');
const STATE_FILE  = path.join(ROOT, 'tmp', 'update_state.json');

const pendingConfirm = new Map(); // userId → { repo, branch, ts }

function readState() {
  try { if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (_) {}
  return {};
}
function writeState(s) {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); } catch (_) {}
}

function runCmd(cmd, cwd = ROOT) {
  return new Promise((resolve) => {
    const parts = cmd.split(' ');
    const proc  = spawn(parts[0], parts.slice(1), { cwd, shell: true, timeout: 120000 });
    let out = '', err = '';
    proc.stdout?.on('data', d => { out += d.toString(); });
    proc.stderr?.on('data', d => { err += d.toString(); });
    proc.on('close', code => resolve({ code, out: out.trim(), err: err.trim() }));
    proc.on('error', e  => resolve({ code: -1, out: '', err: e.message }));
  });
}

function createBackup() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dest   = path.join(BACKUP_DIR, `backup-${stamp}`);
    fs.mkdirSync(dest, { recursive: true });

    const ignore = ['node_modules', '.git', 'tmp', 'uploads', 'auth_info_baileys', 'data'];
    const items  = fs.readdirSync(ROOT).filter(f => !ignore.includes(f));
    for (const item of items) {
      const src = path.join(ROOT, item);
      const dst = path.join(dest, item);
      try {
        execSync(`cp -r "${src}" "${dst}"`, { timeout: 30000 });
      } catch (_) {}
    }
    return { success: true, path: dest, stamp };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function removeOldBackups(keepCount = 3) {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;
    const dirs = fs.readdirSync(BACKUP_DIR)
      .filter(d => d.startsWith('backup-'))
      .sort()
      .reverse();
    for (let i = keepCount; i < dirs.length; i++) {
      execSync(`rm -rf "${path.join(BACKUP_DIR, dirs[i])}"`, { timeout: 10000 });
    }
  } catch (_) {}
}

async function doUpdate(sock, jid, repo, branch = 'main', safeSend) {
  const steps = [];

  await safeSend(jid, { text: `⏳ *Memulai Update DLavie OS...*\n\nRepo: ${repo}\nBranch: ${branch}\n\n🔄 Step 1/5: Membuat backup...` });

  // Step 1: Backup
  const backup = createBackup();
  if (!backup.success) {
    await safeSend(jid, { text: `❌ Backup gagal: ${backup.error}\nUpdate dibatalkan.` });
    return;
  }
  steps.push(`✅ Backup: ${backup.stamp}`);
  removeOldBackups(3);

  // Step 2: Git setup
  await safeSend(jid, { text: `📦 Step 2/5: Setup Git repo...` });
  let gitOk = false;

  if (!fs.existsSync(path.join(ROOT, '.git'))) {
    const init = await runCmd('git init');
    const remote = await runCmd(`git remote add origin ${repo}`);
    if (remote.code !== 0) {
      // Remote may already exist
      await runCmd(`git remote set-url origin ${repo}`);
    }
    gitOk = true;
  } else {
    const remoteRes = await runCmd(`git remote set-url origin ${repo}`);
    gitOk = remoteRes.code === 0 || true;
  }

  // Step 3: Pull
  await safeSend(jid, { text: `📥 Step 3/5: Pulling dari GitHub...` });
  const fetch = await runCmd(`git fetch origin ${branch}`);
  if (fetch.code !== 0 && fetch.err && !fetch.err.includes('already up to date')) {
    console.warn('[UPDATE] fetch warning:', fetch.err);
  }

  const pull = await runCmd(`git pull origin ${branch} --allow-unrelated-histories --strategy-option=theirs`);
  steps.push(`${pull.code === 0 ? '✅' : '⚠️'} Git pull: ${pull.out.slice(0, 80) || pull.err.slice(0, 80) || 'done'}`);

  // Step 4: npm install
  await safeSend(jid, { text: `📦 Step 4/5: Installing dependencies...` });
  const npmInstall = await runCmd('npm install --prefer-offline 2>&1', ROOT);
  steps.push(`${npmInstall.code === 0 ? '✅' : '⚠️'} npm install: ${npmInstall.out.slice(0, 60) || 'done'}`);

  // Step 5: Hot-reload commands
  await safeSend(jid, { text: `🔄 Step 5/5: Reloading commands...` });
  let reloadOk = false;
  try {
    // Clear command cache
    const cmdDir = path.join(ROOT, 'commands');
    const cmds = fs.readdirSync(cmdDir).filter(f => f.endsWith('.js'));
    for (const cmd of cmds) {
      const fullPath = require.resolve(path.join(cmdDir, cmd));
      if (require.cache[fullPath]) delete require.cache[fullPath];
    }
    await loadCommands();
    reloadOk = true;
    steps.push(`✅ Commands reloaded`);
  } catch (err) {
    steps.push(`⚠️ Command reload: ${err.message}`);
  }

  // Save update state
  writeState({
    lastUpdate: new Date().toISOString(),
    repo, branch,
    steps,
    backupPath: backup.path,
    reloadOk,
  });

  await safeSend(jid, {
    text: `✅ *Update Selesai!*\n\n${steps.join('\n')}\n\n` +
          `📦 Backup tersimpan di: \`backup-${backup.stamp}\`\n` +
          `${reloadOk ? '⚡ Commands sudah di-reload tanpa restart!' : '⚠️ Restart manual mungkin diperlukan untuk beberapa perubahan.'}\n\n` +
          `Versi: ${getVersionInfo()}`
  });
}

function getVersionInfo() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    return `${pkg.name || 'DLavie OS'} v${pkg.version || '2.0.0'}`;
  } catch (_) { return 'DLavie OS'; }
}

module.exports = {
  name: 'update',
  aliases: ['up', 'upgrade'],
  description: 'Update DLavie OS dari GitHub (Owner only)',
  ownerOnly: true,

  execute: async (sock, msg, args, config, ctx = {}) => {
    const jid      = msg.key.remoteJid;
    const safeSend = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));
    const userId   = msg.key.remoteJid.replace('@s.whatsapp.net', '');

    if (!isOwnerMsg(msg, config.ownerNumber || process.env.OWNER_NUMBER)) {
      await safeSend(jid, { text: '🚫 Command ini hanya untuk Owner DLavie OS.' });
      return;
    }

    const sub = (args[0] || '').toLowerCase();

    // !update status
    if (sub === 'status') {
      const state = readState();
      const customize = getBotCustomization();
      const repo = customize.getGithubRepo() || config.plugin?.githubToken ? '(configured)' : 'Belum diset';
      if (!state.lastUpdate) {
        await safeSend(jid, { text: `*Update Status*\n\nBelum pernah update.\nGitHub Repo: ${repo}\n\nGunakan: \`!update <github_url>\`` });
      } else {
        await safeSend(jid, {
          text: `*Update Status*\n\nUpdate terakhir: ${new Date(state.lastUpdate).toLocaleString('id-ID')}\nRepo: ${state.repo || '-'}\nBranch: ${state.branch || 'main'}\n\nSteps:\n${state.steps?.join('\n') || '-'}`
        });
      }
      return;
    }

    // !update rollback
    if (sub === 'rollback') {
      const state = readState();
      if (!state.backupPath || !fs.existsSync(state.backupPath)) {
        await safeSend(jid, { text: '❌ Tidak ada backup tersedia untuk rollback.' });
        return;
      }
      await safeSend(jid, { text: `⏳ Rolling back ke backup: ${path.basename(state.backupPath)}...` });
      try {
        const items = fs.readdirSync(state.backupPath);
        const ignore = ['node_modules', '.git', 'tmp', 'uploads', 'auth_info_baileys', 'data'];
        for (const item of items) {
          if (ignore.includes(item)) continue;
          const src = path.join(state.backupPath, item);
          const dst = path.join(ROOT, item);
          execSync(`cp -r "${src}" "${dst}"`, { timeout: 30000 });
        }
        await safeSend(jid, { text: `✅ Rollback berhasil! Bot akan reload commands...` });
        // Reload commands
        try { await loadCommands(); } catch (_) {}
      } catch (err) {
        await safeSend(jid, { text: `❌ Rollback gagal: ${err.message}` });
      }
      return;
    }

    // !update confirm
    if (sub === 'confirm') {
      const pending = pendingConfirm.get(userId);
      if (!pending || Date.now() > pending.ts + 5 * 60 * 1000) {
        pendingConfirm.delete(userId);
        await safeSend(jid, { text: '❌ Tidak ada update yang menunggu konfirmasi (atau sudah timeout 5 menit).\nGunakan `!update <repo_url>` dulu.' });
        return;
      }
      pendingConfirm.delete(userId);
      await doUpdate(sock, jid, pending.repo, pending.branch, safeSend);
      return;
    }

    // !update cancel
    if (sub === 'cancel') {
      pendingConfirm.delete(userId);
      await safeSend(jid, { text: '✅ Update dibatalkan.' });
      return;
    }

    // !update <repo_url> [branch]
    let repoUrl = args[0];
    let branch  = args[1] || 'main';

    // If no URL given, use saved GitHub repo from customization
    if (!repoUrl || repoUrl === 'run') {
      const customize = getBotCustomization();
      repoUrl = customize.getGithubRepo();
      if (args[0] === 'run' && args[1]) { branch = args[1]; }
    }

    if (!repoUrl || (!repoUrl.startsWith('http') && !repoUrl.startsWith('git@'))) {
      const state = readState();
      const customize = getBotCustomization();
      const savedRepo = customize.getGithubRepo();
      await safeSend(jid, {
        text: `*🔄 Update DLavie OS*\n\n*Format:*\n\`!update <github_url> [branch]\`\n\`!update run\` (gunakan repo tersimpan)\n\`!update status\`\n\`!update rollback\`\n\`!update cancel\`\n\n` +
              `*Repo tersimpan:* ${savedRepo || 'Belum diset (set di Settings → GitHub Repo)'}\n` +
              `*Update terakhir:* ${state.lastUpdate ? new Date(state.lastUpdate).toLocaleString('id-ID') : 'Belum pernah'}\n\n` +
              `⚠️ Update akan backup, git pull, dan npm install otomatis.`
      });
      return;
    }

    // Save repo URL to customization
    try {
      const customize = getBotCustomization();
      customize.set('advanced', 'githubRepo', repoUrl);
    } catch (_) {}

    // Ask for confirmation
    pendingConfirm.set(userId, { repo: repoUrl, branch, ts: Date.now() });

    // Check git status first
    let diff = '';
    try {
      if (fs.existsSync(path.join(ROOT, '.git'))) {
        const res = await runCmd(`git log HEAD..origin/${branch} --oneline --count 2>/dev/null`);
        diff = res.out ? `${res.out} commit baru tersedia.` : '';
      }
    } catch (_) {}

    await safeSend(jid, {
      text: `*⚠️ Konfirmasi Update*\n\n*Repo:* ${repoUrl}\n*Branch:* ${branch}\n${diff}\n\n*Update akan:*\n1. Backup kode saat ini\n2. git pull dari repo\n3. npm install\n4. Reload commands (tanpa restart)\n\n` +
            `*Ketik* \`!update confirm\` untuk lanjutkan\n*Ketik* \`!update cancel\` untuk batal\n\n⏱️ Konfirmasi berlaku 5 menit.`
    });
  }
};
