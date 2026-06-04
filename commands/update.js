const { execSync } = require('child_process');
const { loadCommands } = require('../src/commandLoader');
const log = require('../src/logger');

module.exports = {
  name: 'update',
  description: 'Git pull + npm install + hot reload (owner only)',
  execute: async (sock, msg, args, config, ctx) => {
    if (!ctx.isOwner) return sock.sendMessage(ctx.jid, { text: '⛔ Owner only.' });

    await sock.sendMessage(ctx.jid, { text: '🔄 Memulai update dari GitHub...' });

    const run = (cmd) => {
      try {
        return { ok: true, out: execSync(cmd, { cwd: process.cwd(), timeout: 60000 }).toString().trim() };
      } catch (e) {
        return { ok: false, out: e.stderr?.toString().trim() || e.message };
      }
    };

    // 1. git fetch + status
    run('git fetch origin main');
    const diffStat = run('git diff HEAD origin/main --name-only');
    const changedFiles = diffStat.ok && diffStat.out ? diffStat.out.split('\n') : [];

    if (changedFiles.length === 0) {
      return sock.sendMessage(ctx.jid, { text: '✅ Bot sudah versi terbaru. Tidak ada perubahan.' });
    }

    await sock.sendMessage(ctx.jid, {
      text: `📄 *File yang akan diupdate (${changedFiles.length}):*\n${changedFiles.map(f => `  • ${f}`).join('\n')}`,
    });

    // 2. git pull
    const pull = run('git pull origin main');
    if (!pull.ok) {
      return sock.sendMessage(ctx.jid, { text: `❌ Git pull gagal:\n${pull.out}` });
    }
    log.info('git pull:', pull.out);

    // 3. npm install jika package.json berubah
    const pkgChanged = changedFiles.some(f => f === 'package.json');
    if (pkgChanged) {
      await sock.sendMessage(ctx.jid, { text: '📦 package.json berubah, menjalankan npm install...' });
      const npm = run('npm install');
      log.info('npm install:', npm.out);
      if (!npm.ok) {
        await sock.sendMessage(ctx.jid, { text: `⚠️ npm install warning:\n${npm.out}` });
      }
    }

    // 4. Tentukan perlu full restart atau cukup hot reload
    const coreChanged = changedFiles.some(f => f.startsWith('src/') || f === 'index.js');
    const cmdChanged  = changedFiles.some(f => f.startsWith('commands/'));

    if (coreChanged) {
      await sock.sendMessage(ctx.jid, {
        text: `✅ Update selesai!\n📁 File core berubah (${changedFiles.filter(f => f.startsWith('src/') || f === 'index.js').join(', ')})\n🔁 Bot akan restart otomatis dalam 3 detik...`,
      });
      log.info('Core files changed, restarting...');
      setTimeout(() => process.exit(0), 3000);
      return;
    }

    if (cmdChanged) {
      const newMap = loadCommands();
      ctx.commandsRef.map = newMap;
      return sock.sendMessage(ctx.jid, {
        text: `✅ *Update & reload berhasil!*\n\n📦 ${newMap.size} command aktif\n📄 File diupdate:\n${changedFiles.map(f => `  • ${f}`).join('\n')}`,
      });
    }

    await sock.sendMessage(ctx.jid, { text: `✅ Update selesai!\n📄 ${changedFiles.join(', ')}` });
  },
};
