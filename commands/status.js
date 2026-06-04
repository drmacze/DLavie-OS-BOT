module.exports = {
  name: 'status',
  description: 'Cek status bot (owner only)',
  execute: async (sock, msg, args, config, ctx) => {
    if (!ctx.isOwner) {
      return sock.sendMessage(ctx.jid, { text: '⛔ Perintah ini hanya untuk owner.' });
    }
    const uptime = process.uptime();
    const jam    = Math.floor(uptime / 3600);
    const menit  = Math.floor((uptime % 3600) / 60);
    const detik  = Math.floor(uptime % 60);
    const mem    = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    await sock.sendMessage(ctx.jid, {
      text:
        `📊 *Status ${config.botName}*\n\n` +
        `🟢 Status   : Online\n` +
        `⏱️ Uptime   : ${jam}j ${menit}m ${detik}d\n` +
        `💾 Memori   : ${mem} MB\n` +
        `🤖 Versi    : v2.0.0\n` +
        `📱 Platform : WhatsApp Multi-Device`,
    });
  },
};
