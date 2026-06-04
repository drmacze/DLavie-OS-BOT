const { runDeterministicRepair, formatRepairReport, SAFE_INSTALL_ALLOWLIST } = require('../src/selfRepair/deterministicRepair');
const { askAiFallback } = require('../src/selfRepair/aiFallback');

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function senderNumber(msg) {
  return digitsOnly(msg.key.participant || msg.key.remoteJid || '');
}

function isOwner(msg, config) {
  const owner = digitsOnly(config.ownerNumber);
  return msg.key.fromMe || (owner && senderNumber(msg).includes(owner));
}

async function reply(sock, msg, text) {
  await sock.sendMessage(msg.key.remoteJid, { text: text.slice(0, 3900) });
}

module.exports = {
  name: 'fix',
  aliases: ['autofix', 'doctor', 'repair'],
  description: 'DLavie Auto-Fix: deterministic repair tanpa AI + optional fallback Gemini/ChatGPT/Grok.',
  execute: async (sock, msg, args, config, ctx = {}) => {
    const safeSend = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));
    const _reply = (text) => safeSend(msg.key.remoteJid, { text: String(text).slice(0, 3900) });

    if (!isOwner(msg, config)) {
      await _reply('⛔ Command ini khusus owner DLavie OS.');
      return;
    }

    const mode = (args.shift() || 'check').toLowerCase();
    const payload = args.join(' ').trim();

    if (['help', 'menu'].includes(mode)) {
      const allowlist = (() => { try { return Array.from(SAFE_INSTALL_ALLOWLIST).join(', '); } catch (_) { return '(tidak tersedia)'; } })();
      await _reply([
        '🛠️ *DLavie Auto-Fix*',
        '',
        '`!fix check`  — cek masalah tanpa mengubah file',
        '`!fix apply`  — perbaiki masalah otomatis',
        '`!fix install <module>`  — install dependency',
        '`!fix ai <error>`  — analisis AI (Grok/Gemini/ChatGPT)',
        '`!fix full <error>`  — full fix + AI fallback',
        '`!fix report`  — lihat error terbaru',
        '',
        `Allowlist: ${allowlist}`,
      ].join('\n'));
      return;
    }

    if (mode === 'check') {
      await _reply('🔍 Scanning sistem...');
      const report = await runDeterministicRepair({ apply: false, source: 'wa-command:check' });
      await _reply(formatRepairReport(report));
      return;
    }

    if (mode === 'apply') {
      await _reply('🔧 Menerapkan perbaikan...');
      const report = await runDeterministicRepair({ apply: true, source: 'wa-command:apply' });
      await _reply(formatRepairReport(report));
      return;
    }

    if (mode === 'install') {
      if (!payload) { await _reply('Format: `!fix install <module>`'); return; }
      let isAllowed = false;
      try { isAllowed = SAFE_INSTALL_ALLOWLIST.has(payload); } catch (_) { isAllowed = true; }
      if (!isAllowed) { await _reply(`Module '${payload}' tidak ada di allowlist demi keamanan.`); return; }
      const report = await runDeterministicRepair({
        apply: true, installMissing: true,
        errorText: `Cannot find module '${payload}'`, source: 'wa-command:install'
      });
      await _reply(formatRepairReport(report));
      return;
    }

    if (mode === 'ai') {
      if (!payload) { await _reply('Format: `!fix ai <paste error/log>`'); return; }
      await _reply('🤖 Meminta analisis AI...');
      try {
        const ai = await askAiFallback({ errorText: payload, provider: 'auto', context: 'Manual WA !fix ai' });
        await _reply(`🤖 *AI: ${ai.provider}*\n\n${ai.text}`);
      } catch (err) {
        await _reply(`❌ AI fallback gagal: ${err.message}`);
      }
      return;
    }

    if (mode === 'full') {
      await _reply('🔧 Full fix + AI fallback sedang berjalan...');
      const report = await runDeterministicRepair({ apply: true, errorText: payload, source: 'wa-command:full' });
      let text = formatRepairReport(report);
      if (payload) {
        try {
          const ai = await askAiFallback({ errorText: payload, provider: 'auto', context: 'WA !fix full' });
          text += `\n\n🤖 *AI: ${ai.provider}*\n${ai.text.slice(0, 1200)}`;
        } catch (err) { text += `\n\n🤖 AI gagal: ${err.message}`; }
      }
      await _reply(text);
      return;
    }

    if (mode === 'report') {
      try {
        const { getEngine } = require('../src/core/engine');
        const errs = getEngine().getSystem('errors');
        if (errs) {
          const summary = await errs.getErrorSummary();
          const lines   = (summary || []).slice(0, 8).map(e => `• ${e.severity}: ${e.error} (${e.count}x)`);
          await _reply(`*❌ Error Report*\n\n${lines.join('\n') || 'Tidak ada error'}`);
        } else {
          await _reply('Error system tidak tersedia.');
        }
      } catch (err) { await _reply(`Error: ${err.message}`); }
      return;
    }

    await _reply('Mode tidak dikenal. Ketik `!fix help`');
  }
};
