const fs = require('fs');
const path = require('path');
const { getEngine } = require('../src/core/engine');

const PLUGIN_ID = 'PLG-ERRORLOG-1CA2C8DB';
const LOG_DIRS = [
  path.join(__dirname, '..', 'logs'),
  path.join(__dirname, '..', '.local', 'state', 'workflow-logs')
];

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function senderNumber(msg) {
  return digitsOnly(msg.key.participant || msg.key.remoteJid || '');
}

function isOwner(msg, config) {
  const owner = digitsOnly(config.ownerNumber || config.bot?.ownerNumber);
  return msg.key.fromMe || Boolean(owner && senderNumber(msg).includes(owner));
}

function readRecentTextFiles(limit = 5) {
  const results = [];

  for (const dir of LOG_DIRS) {
    if (!fs.existsSync(dir)) continue;

    const files = [];
    const stack = [dir];

    while (stack.length) {
      const current = stack.pop();
      for (const entry of fs.readdirSync(current)) {
        const full = path.join(current, entry);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) stack.push(full);
        else files.push({ full, stat });
      }
    }

    files
      .filter(({ full }) => /\.(log|txt|json|exec)$/i.test(full))
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
      .slice(0, limit)
      .forEach(({ full }) => {
        try {
          const raw = fs.readFileSync(full, 'utf8');
          const lines = raw.split(/\r?\n/)
            .filter((line) => /error|failed|fatal|timeout|closed|syntax|exception|plugin/i.test(line))
            .slice(-8);
          if (lines.length) {
            results.push({ file: path.relative(path.join(__dirname, '..'), full), lines });
          }
        } catch (_) {}
      });
  }

  return results;
}

module.exports = {
  name: 'errorlog',
  aliases: ['errors', 'errlog', 'logerror'],
  pluginId: PLUGIN_ID,
  description: 'Tampilkan log error plugin terbaru (owner only)',
  execute: async (sock, msg, args, config, ctx = {}) => {
    const safeSend = ctx.safeSend || ((jid, payload) => sock.sendMessage(jid, payload));

    if (!isOwner(msg, config)) {
      await safeSend(msg.key.remoteJid, { text: '🔒 Command ini khusus Owner.' });
      return;
    }

    const output = [
      '🧾 *DLavie OS Error Log*',
      `🆔 \`${PLUGIN_ID}\``,
      '━━━━━━━━━━━━━━━━━━━━'
    ];

    let hasData = false;

    try {
      const errors = getEngine().getSystem('errors');
      if (errors && typeof errors.getErrorSummary === 'function') {
        const summary = await errors.getErrorSummary();
        if (summary && summary.length) {
          hasData = true;
          output.push('*Runtime Error Aggregator:*');
          for (const item of summary.slice(0, 8)) {
            output.push(`• ${item.severity || 'unknown'} — ${item.error || item.hash} (${item.count || 1}x)`);
          }
          output.push('');
        }
      }
    } catch (err) {
      output.push(`⚠️ Error aggregator tidak bisa dibaca: ${err.message}`);
    }

    const fileLogs = readRecentTextFiles(4);
    if (fileLogs.length) {
      hasData = true;
      output.push('*Recent Log Files:*');
      for (const item of fileLogs.slice(0, 4)) {
        output.push(`📄 ${item.file}`);
        for (const line of item.lines.slice(-4)) {
          output.push(`  ${line.slice(0, 180)}`);
        }
      }
    }

    if (!hasData) {
      output.push('✅ Tidak ada error terbaru yang terdeteksi.');
    }

    await safeSend(msg.key.remoteJid, { text: output.join('\n').slice(0, 3900) });
  }
};
