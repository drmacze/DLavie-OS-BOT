const { getEngine } = require('../src/core/engine');

const { isOwnerMsg } = require('../src/utils/ownerUtils');
function isOwner(msg, config) { return isOwnerMsg(msg, config.ownerNumber); }

module.exports = {
  name: 'monitor',
  aliases: ['health', 'stats', 'metrics'],
  description: 'Monitoring and diagnostics',
  execute: async (sock, msg, args, config, ctx = {}) => {
    const jid      = msg.key.remoteJid;
    const { extractSenderNumber } = require('../src/utils/ownerUtils');
    const userId   = extractSenderNumber(msg);
    const safeSend = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));
    const engine   = getEngine();
    const health   = engine.getSystem('health');
    const errors   = engine.getSystem('errors');
    const tokenEngine = engine.getSystem('token');
    const mode     = (args.shift() || 'all').toLowerCase();

    // Safe token spend — jika tokenEngine tidak ada, skip
    const spend = (op) => {
      try { if (tokenEngine) { if (!tokenEngine.getAccount(userId)) tokenEngine.registerAccount(userId); return tokenEngine.spend(userId, op); } } catch (_) {}
      return { success: true };
    };

    // ─── All overview ───
    if (mode === 'all' || mode === 'health') {
      let healthText = '';
      try {
        const report = health ? await health.getHealthReport() : null;
        if (report) {
          healthText = `📊 Health: *${report.healthScore || '?'}/100* (${report.status || '?'})\n🧠 Memory: ${report.latest?.memory?.usedPercent || '?'}% | CPU: ${report.latest?.cpu?.usagePercent || '?'}%\n⏱️ Uptime: ${Math.floor((report.uptime || 0) / 60)}m\n⚠️ Anomali: ${report.anomalies?.length || 0}`;
        }
      } catch (_) { healthText = 'Health monitor tidak tersedia'; }

      // Anti-ban status
      let abText = '';
      try {
        const { getAntiBan } = require('../src/antiban/antiBan');
        const ab = getAntiBan();
        const s  = ab.getStatus();
        abText = `\n\n🛡️ *Anti-Ban:* ${s.isHalted ? '⏸️ COOLDOWN' : '✅ Active'}\nMsg/min: ${s.msgThisMinute}/${s.limits.perMinute} | Msg/jam: ${s.msgThisHour}/${s.limits.perHour}\nLevel: ${s.cooldownLevel} | Total sent: ${s.totalSent}`;
      } catch (_) {}

      // Queue status
      let qText = '';
      try {
        const { getMessageQueue } = require('../src/queue/messageQueue');
        const q = getMessageQueue();
        const s = q.getStats();
        qText = `\n\n⏳ *Queue:* ${s.currentQueue} antrian | ${s.currentProcessing} proses\nTotal processed: ${s.processed} | Rejected: ${s.rejected}`;
      } catch (_) {}

      await safeSend(jid, {
        text: `*📊 DLavie OS Monitor*\n\n${healthText}${abText}${qText}\n\nGunakan \`!monitor errors\`, \`!monitor bots\`, atau \`!monitor logs\` untuk detail.`
      });
      return;
    }

    if (mode === 'bots') {
      const multiBot = engine.getSystem('multiBot');
      if (!multiBot) { await safeSend(jid, { text: 'Multi-bot system tidak tersedia.' }); return; }
      try {
        const status = await multiBot.getStatus();
        await safeSend(jid, {
          text: `*🤖 Bot Status*\n\nTotal: ${status.totalBots || 0}\nOnline: ${status.onlineBots || 0}\nAvg Health: ${status.averageHealth || 0}%`
        });
      } catch (err) {
        await safeSend(jid, { text: `Bot status error: ${err.message}` });
      }
      return;
    }

    if (mode === 'errors') {
      if (!isOwner(msg, config)) { await safeSend(jid, { text: '🔒 Owner only.' }); return; }
      try {
        const summary = errors ? await errors.getErrorSummary() : [];
        const lines   = (summary || []).slice(0, 10).map(e => `${e.severity}: ${e.error} (${e.count}x)`);
        await safeSend(jid, { text: `*❌ Error Summary*\n\n${lines.join('\n') || 'Tidak ada error'}` });
      } catch (err) {
        await safeSend(jid, { text: `Error system error: ${err.message}` });
      }
      return;
    }

    if (mode === 'logs') {
      const audit = engine.getSystem('audit');
      if (!audit) { await safeSend(jid, { text: 'Audit system tidak tersedia.' }); return; }
      try {
        const logs  = await audit.query({ userId, limit: 10 });
        const lines = (logs || []).map(l => `${l.action}: ${l.severity || '?'}`);
        await safeSend(jid, { text: `*📋 Audit Log Kamu*\n\n${lines.join('\n') || 'Belum ada log'}` });
      } catch (err) {
        await safeSend(jid, { text: `Audit error: ${err.message}` });
      }
      return;
    }

    await safeSend(jid, {
      text: `*📊 Monitor Commands*\n\n\`!monitor\` — Overview lengkap\n\`!monitor health\` — System health\n\`!monitor bots\` — Status bot\n\`!monitor errors\` — Error summary (owner)\n\`!monitor logs\` — Audit log kamu`
    });
  }
};
