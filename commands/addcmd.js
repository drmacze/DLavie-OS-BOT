const fs   = require('fs');
const path = require('path');
const { loadCommands } = require('../src/commandLoader');

module.exports = {
  name: 'addcmd',
  description: 'Tambah command baru dari pesan (owner only)',
  execute: async (sock, msg, args, config, ctx) => {
    if (!ctx.isOwner) return sock.sendMessage(ctx.jid, { text: '⛔ Owner only.' });

    const filename = args[0]?.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const code     = ctx.body?.trim();

    if (!filename || !code) {
      return sock.sendMessage(ctx.jid, {
        text:
          '❓ *Format penggunaan:*\n\n' +
          '```\n!addcmd namacommand\n' +
          "module.exports = {\n  name: 'namacommand',\n  execute: async (sock, msg, args, config, ctx) => {\n    await sock.sendMessage(ctx.jid, { text: 'Halo!' });\n  },\n};\n```",
      });
    }

    const filepath = path.join(process.cwd(), 'commands', `${filename}.js`);
    const exists   = fs.existsSync(filepath);

    try {
      // Validate code syntax
      new Function(code); // will throw if syntax error
    } catch (e) {
      return sock.sendMessage(ctx.jid, { text: `❌ Syntax error pada code:\n${e.message}` });
    }

    try {
      fs.writeFileSync(filepath, code, 'utf8');
      const newMap = loadCommands();
      ctx.commandsRef.map = newMap;
      await sock.sendMessage(ctx.jid, {
        text:
          `${exists ? '✏️ Command diupdate' : '✅ Command ditambahkan'}: *${filename}.js*\n` +
          `📦 Total command aktif: ${newMap.size}`,
      });
    } catch (err) {
      await sock.sendMessage(ctx.jid, { text: `❌ Gagal menyimpan command: ${err.message}` });
    }
  },
};
