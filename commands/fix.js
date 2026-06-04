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
  execute: async (sock, msg, args, config) => {
    if (!isOwner(msg, config)) {
      await reply(sock, msg, '⛔ Command ini khusus owner DLavie OS.');
      return;
    }

    const mode = (args.shift() || 'check').toLowerCase();
    const payload = args.join(' ').trim();

    if (['help', 'menu'].includes(mode)) {
      await reply(sock, msg, [
        '🛠️ DLavie Auto-Fix',
        '',
        '!fix check  → cek masalah deterministik tanpa mengubah file',
        '!fix apply  → perbaiki masalah deterministik yang aman',
        '!fix install <module>  → install dependency allowlist yang hilang',
        '!fix ai <error/log>  → analisis fallback AI pakai Gemini/ChatGPT/Grok',
        '!fix full <error/log>  → apply deterministic fix lalu fallback AI jika perlu',
        '',
        `Allowlist install: ${Array.from(SAFE_INSTALL_ALLOWLIST).join(', ')}`
      ].join('\n'));
      return;
    }

    if (mode === 'check') {
      const report = await runDeterministicRepair({ apply: false, source: 'wa-command:check' });
      await reply(sock, msg, formatRepairReport(report));
      return;
    }

    if (mode === 'apply') {
      const report = await runDeterministicRepair({ apply: true, source: 'wa-command:apply' });
      await reply(sock, msg, formatRepairReport(report));
      return;
    }

    if (mode === 'install') {
      if (!payload) {
        await reply(sock, msg, 'Format: !fix install <module>');
        return;
      }
      if (!SAFE_INSTALL_ALLOWLIST.has(payload)) {
        await reply(sock, msg, `Module '${payload}' tidak ada di allowlist demi keamanan.`);
        return;
      }
      const report = await runDeterministicRepair({
        apply: true,
        installMissing: true,
        errorText: `Cannot find module '${payload}'`,
        source: 'wa-command:install'
      });
      await reply(sock, msg, formatRepairReport(report));
      return;
    }

    if (mode === 'ai') {
      if (!payload) {
        await reply(sock, msg, 'Format: !fix ai <paste error/log>');
        return;
      }
      const ai = await askAiFallback({ errorText: payload, provider: 'auto', context: 'Manual WhatsApp command !fix ai' });
      await reply(sock, msg, `🤖 AI fallback aktif: ${ai.provider}\n\n${ai.text}`);
      return;
    }

    if (mode === 'full') {
      const report = await runDeterministicRepair({ apply: true, errorText: payload, source: 'wa-command:full' });
      let text = formatRepairReport(report);

      if (payload) {
        try {
          const ai = await askAiFallback({ errorText: payload, provider: 'auto', context: 'Manual WhatsApp command !fix full' });
          text += `\n\n🤖 AI fallback aktif: ${ai.provider}\n\n${ai.text}`;
        } catch (err) {
          text += `\n\n🤖 AI fallback gagal: ${err.message}`;
        }
      }

      await reply(sock, msg, text);
      return;
    }

    await reply(sock, msg, 'Mode tidak dikenal. Ketik !fix help');
  }
};
