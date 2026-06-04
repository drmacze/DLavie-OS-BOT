module.exports = {
  name: 'menu',
  aliases: ['help', 'bantuan'],
  description: 'Tampilkan semua perintah',
  execute: async (sock, msg, args, config, ctx) => {
    const p = config.prefix;
    const text =
      `╔══════════════════════╗\n` +
      `║   🤖 ${config.botName}   ║\n` +
      `╚══════════════════════╝\n\n` +
      `📋 *DAFTAR PERINTAH*\n\n` +
      `*Umum*\n` +
      `┣ ${p}ping  — Cek latensi bot\n` +
      `┣ ${p}halo  — Sapa bot\n` +
      `┣ ${p}menu  — Tampilkan menu ini\n` +
      `┣ ${p}info  — Info bot\n\n` +
      `*Owner Only*\n` +
      `┣ ${p}status — Status & uptime bot\n` +
      `┗ ${p}owner  — Info owner\n\n` +
      `_Prefix aktif: *${p}*_`;
    await sock.sendMessage(ctx.jid, { text });
  },
};
