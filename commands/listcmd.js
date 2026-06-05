const fs = require('fs');
const path = require('path');

const PLUGIN_ID = 'PLG-LISTCMD-19DAAF57';
const COMMANDS_DIR = __dirname;

function commandPrefix(config) {
  return config.botPrefix || config.bot?.prefix || '!';
}

function normalizeAliases(aliases) {
  if (!Array.isArray(aliases) || !aliases.length) return '';
  return ` (alias: ${aliases.map(String).join(', ')})`;
}

function loadCommandSummaries() {
  const files = fs.readdirSync(COMMANDS_DIR)
    .filter((file) => file.endsWith('.js'))
    .sort();

  const summaries = [];

  for (const file of files) {
    const fullPath = path.join(COMMANDS_DIR, file);
    try {
      delete require.cache[require.resolve(fullPath)];
      const cmd = require(fullPath);
      if (!cmd || !cmd.name || typeof cmd.execute !== 'function') continue;
      summaries.push({
        name: String(cmd.name).toLowerCase(),
        aliases: Array.isArray(cmd.aliases) ? cmd.aliases : [],
        description: cmd.description || '',
        file
      });
    } catch (err) {
      summaries.push({
        name: file.replace(/\.js$/, ''),
        aliases: [],
        description: `gagal load: ${err.message}`,
        file,
        error: true
      });
    }
  }

  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = {
  name: 'listcmd',
  aliases: ['cmds', 'commands', 'pluginlist'],
  pluginId: PLUGIN_ID,
  description: 'Tampilkan semua command aktif + Plugin ID compatibility',
  execute: async (sock, msg, args, config, ctx = {}) => {
    const safeSend = ctx.safeSend || ((jid, payload) => sock.sendMessage(jid, payload));
    const prefix = commandPrefix(config);
    const summaries = loadCommandSummaries();

    const lines = [
      `📦 *Command Files (${summaries.length})*`,
      '━━━━━━━━━━━━━━━━━━━━'
    ];

    for (const item of summaries) {
      const marker = item.error ? '⚠️' : '•';
      const aliasText = normalizeAliases(item.aliases);
      const description = item.description ? ` — ${item.description}` : '';
      lines.push(`${marker} *${prefix}${item.name}*${aliasText}${description}`);
    }

    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push(`🆔 \`${PLUGIN_ID}\``);
    lines.push(`_Prefix: *${prefix}*_`);

    await safeSend(msg.key.remoteJid, { text: lines.join('\n').slice(0, 3900) });
  }
};
