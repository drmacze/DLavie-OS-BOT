/**
 * DLavie OS — !shell command
 * Eksekusi shell command — hanya Owner & Admin
 * Cost: 10 token per command
 */

const { exec } = require('child_process');
const { getEngine }  = require('../src/core/engine');
const { getWebAuth } = require('../src/auth/webAuth');

const BLOCKED_CMDS = [
  'rm -rf /',
  'dd if=',
  ':(){ :|:& };:',
  'mkfs',
  'chmod 777 /',
  'format',
  'del /f /s /q',
  'shutdown',
  'reboot',
  'halt',
  'poweroff',
];

const MAX_OUTPUT = 3000;
const TIMEOUT_MS = 30_000;

function isBlocked(cmd) {
  const lower = cmd.toLowerCase();
  return BLOCKED_CMDS.some(b => lower.includes(b.toLowerCase()));
}

function digitsOnly(v) { return String(v || '').replace(/\D/g, ''); }
function senderId(msg) {
  return digitsOnly(msg.key.participant || msg.key.remoteJid || '');
}

module.exports = {
  name: 'shell',
  aliases: ['sh', 'exec', 'run', 'cmd'],
  description: 'Eksekusi shell command (Owner/Admin)',

  execute: async (sock, msg, args, config, ctx = {}) => {
    const jid      = msg.key.remoteJid;
    const userId   = senderId(msg);
    const safeSend = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));
    const webAuth  = getWebAuth();
    const engine   = getEngine();
    const perms    = engine.getSystem('permissions');
    const tokenEng = engine.getSystem('token');

    // ─── Permission check ───
    const isOwner = webAuth.isOwner(userId, config.ownerNumber || config.bot?.ownerNumber) || msg.key.fromMe;
    const userLevel = perms?.getUserLevel(userId) || 10;
    if (!isOwner && userLevel < 80) {
      await safeSend(jid, { text: '🔒 Hanya *Owner* dan *Admin* yang bisa menggunakan shell.' });
      return;
    }

    const mode = (args[0] || '').toLowerCase();

    // ─── Help ───
    if (!args.length || mode === 'help') {
      await safeSend(jid, {
        text: `*🖥️ Shell Access*\n\n\`!shell <command>\` - Jalankan command\n\`!shell pwd\` - Direktori aktif\n\`!shell ls\` - List files\n\`!shell ps aux\` - Lihat proses\n\`!shell env\` - Environment vars\n\`!shell kill <pid>\` - Kill proses\n\n⚠️ Beberapa command berbahaya diblokir.\nCost: 10 token/command`
      });
      return;
    }

    const command = args.join(' ');

    // ─── Block dangerous commands ───
    if (isBlocked(command)) {
      await safeSend(jid, { text: `🚫 Command diblokir karena berpotensi merusak sistem:\n\`${command}\`` });
      return;
    }

    // ─── Token deduction ───
    if (tokenEng) {
      const tokenResult = tokenEng.spend(userId, 'shellCommand');
      if (!tokenResult.success) {
        await safeSend(jid, { text: `💰 Token tidak cukup.\n${tokenResult.error}\n\nSaldo: ${tokenResult.balance} token` });
        return;
      }
    }

    // ─── Confirm untuk command sensitif ───
    const SENSITIVE = ['rm ', 'pkill', 'kill ', 'npm install', 'pip install', 'apt'];
    const isSensitive = SENSITIVE.some(s => command.toLowerCase().includes(s));
    if (isSensitive && !args.includes('--confirm')) {
      await safeSend(jid, {
        text: `⚠️ *Command Sensitif*\n\n\`${command}\`\n\nTambahkan \`--confirm\` untuk melanjutkan:\n\`!shell ${command} --confirm\``
      });
      return;
    }

    // Strip --confirm dari command aktual
    const realCmd = command.replace(' --confirm', '').trim();

    await safeSend(jid, { text: `⏳ Menjalankan: \`${realCmd}\`...` });

    // ─── Execute ───
    exec(realCmd, { timeout: TIMEOUT_MS, maxBuffer: 1024 * 512 }, async (err, stdout, stderr) => {
      const output = (stdout || '') + (stderr ? `\n[STDERR]\n${stderr}` : '');
      const trimmed = output.trim();

      let reply;
      if (err && !trimmed) {
        reply = `❌ *Error*\n\n${err.message}`;
      } else {
        const display = trimmed.slice(0, MAX_OUTPUT);
        const truncated = trimmed.length > MAX_OUTPUT ? `\n... (${trimmed.length - MAX_OUTPUT} karakter dipotong)` : '';
        reply = `✅ *Shell Output*\n\`\`\`\n${display}${truncated}\n\`\`\`\n\nCommand: \`${realCmd}\`${err ? '\n⚠️ Exit with error' : ''}`;
      }

      try {
        await safeSend(jid, { text: reply.slice(0, 3800) });
      } catch (sendErr) {
        await sock.sendMessage(jid, { text: reply.slice(0, 3800) });
      }

      // Audit log
      try {
        const audit = engine.getSystem('audit');
        if (audit) audit.log('shell_exec', userId, { command: realCmd, success: !err });
      } catch (_) {}
    });
  }
};
