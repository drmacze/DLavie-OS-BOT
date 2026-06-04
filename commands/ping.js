module.exports = {
  name: 'ping',
  aliases: ['p'],
  description: 'Cek apakah bot aktif',
  execute: async (sock, msg, args, config, ctx) => {
    const start = Date.now();
    await sock.sendMessage(ctx.jid, { text: '🏓 Pong!' });
    const latency = Date.now() - start;
    await sock.sendMessage(ctx.jid, {
      text: `✅ *${config.botName}* aktif!\n⚡ Latensi: *${latency}ms*`,
    });
  },
};
