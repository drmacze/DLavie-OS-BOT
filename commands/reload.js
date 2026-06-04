const { loadCommands } = require('../src/commandLoader');

module.exports = {
  name: 'reload',
  description: 'Hot reload semua command tanpa restart bot (owner only)',
  execute: async (sock, msg, args, config, ctx) => {
    if (!ctx.isOwner) return sock.sendMessage(ctx.jid, { text: '⛔ Owner only.' });

    await sock.sendMessage(ctx.jid, { text: '🔄 Memuat ulang semua command...' });
    try {
      const newMap = loadCommands();
      ctx.commandsRef.map = newMap;
      await sock.sendMessage(ctx.jid, {
        text: `✅ *Reload berhasil!*\n📦 ${newMap.size} command aktif.`,
      });
    } catch (err) {
      await sock.sendMessage(ctx.jid, { text: `❌ Reload gagal: ${err.message}` });
    }
  },
};
