/**
 * DLavie OS — !ping command (PUBLIC — tidak perlu login)
 */
module.exports = {
  name: 'ping',
  aliases: ['p'],
  description: 'Cek koneksi bot',

  execute: async (sock, msg, args, config, ctx = {}) => {
    const jid      = msg.key.remoteJid;
    const safeSend = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));
    const start    = Date.now();
    const name     = config.botName || config.bot?.name || 'DLavie OS';
    const version  = config.bot?.version || '2.0.0';

    // Anti-ban status
    let abStatus = '';
    try {
      const { getAntiBan } = require('../src/antiban/antiBan');
      const ab = getAntiBan();
      const st = ab.getStatus();
      abStatus = `\n🛡️ Anti-Ban: ${st.isHalted ? '⏸️ Cooldown' : '✅ Active'} (${st.cooldownLevel})`;
    } catch (_) {}

    // Queue status
    let qStatus = '';
    try {
      const { getMessageQueue } = require('../src/queue/messageQueue');
      const q = getMessageQueue();
      const s = q.getStats();
      qStatus = `\n⏳ Queue: ${s.currentQueue} antrian | ${s.currentProcessing} proses`;
    } catch (_) {}

    await safeSend(jid, {
      text: `🏓 *Pong!*\n\n⚡ *${name}* v${version}\n🟢 Online & Ready${abStatus}${qStatus}\n⏱️ Latensi: ${Date.now() - start}ms`
    });
  }
};