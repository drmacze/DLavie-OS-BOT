const fs   = require('fs');
const path = require('path');

module.exports = {
  name: 'listcmd',
  aliases: ['cmds'],
  description: 'Tampilkan semua file command aktif',
  execute: async (sock, msg, args, config, ctx) => {
    if (!ctx.isOwner) return sock.sendMessage(ctx.jid, { text: '⛔ Owner only.' });

    const dir   = path.join(process.cwd(), 'commands');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();

    const lines = [];
    for (const file of files) {
      try {
        delete require.cache[require.resolve(path.join(dir, file))];
        const cmd = require(path.join(dir, file));
        const aliases = cmd.aliases?.length ? ` (alias: ${cmd.aliases.join(', ')})` : '';
        const desc    = cmd.description ? ` — ${cmd.description}` : '';
        lines.push(`  • *${config.prefix}${cmd.name || file}*${aliases}${desc}`);
      } catch (_) {
        lines.push(`  ⚠️ ${file} (gagal dimuat)`);
      }
    }

    await sock.sendMessage(ctx.jid, {
      text:
        `📦 *Command Files (${files.length})*\n\n` +
        lines.join('\n') +
        `\n\n_Prefix: *${config.prefix}*_`,
    });
  },
};
