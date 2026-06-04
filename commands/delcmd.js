const fs   = require('fs');
const path = require('path');
const { loadCommands } = require('../src/commandLoader');

const PROTECTED = ['ping', 'halo', 'menu', 'info', 'status', 'owner', 'reload', 'update', 'addcmd', 'delcmd', 'listcmd'];

module.exports = {
  name: 'delcmd',
  description: 'Hapus command (owner only)',
  execute: async (sock, msg, args, config, ctx) => {
    if (!ctx.isOwner) return sock.sendMessage(ctx.jid, { text: '⛔ Owner only.' });

    const name = args[0]?.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!name) {
      return sock.sendMessage(ctx.jid, { text: '❓ Format: *!delcmd namacommand*' });
    }

    if (PROTECTED.includes(name)) {
      return sock.sendMessage(ctx.jid, { text: `🔒 Command *${name}* adalah command inti dan tidak bisa dihapus.` });
    }

    const filepath = path.join(process.cwd(), 'commands', `${name}.js`);
    if (!fs.existsSync(filepath)) {
      return sock.sendMessage(ctx.jid, { text: `❌ Command *${name}.js* tidak ditemukan.` });
    }

    try {
      fs.unlinkSync(filepath);
      const newMap = loadCommands();
      ctx.commandsRef.map = newMap;
      await sock.sendMessage(ctx.jid, {
        text: `🗑️ Command *${name}.js* berhasil dihapus.\n📦 Total command aktif: ${newMap.size}`,
      });
    } catch (err) {
      await sock.sendMessage(ctx.jid, { text: `❌ Gagal hapus command: ${err.message}` });
    }
  },
};
