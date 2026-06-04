const { getEngine } = require('../src/core/engine');

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function senderNumber(msg) {
  return digitsOnly(msg.key.participant || msg.key.remoteJid || '');
}

function isOwner(msg, config) {
  const owner = digitsOnly(config.ownerNumber);
  return msg.key.fromMe || (owner && senderNumber(msg).includes(owner));
}

module.exports = {
  name: 'monitor',
  aliases: ['health', 'stats', 'metrics'],
  description: 'Monitoring and diagnostics',
  execute: async (sock, msg, args, config) => {
    const userId = senderNumber(msg);
    const engine = getEngine();
    const health = engine.getSystem('health');
    const errors = engine.getSystem('errors');
    const tokenEngine = engine.getSystem('token');
    const mode = (args.shift() || 'health').toLowerCase();

    if (!tokenEngine.getAccount(userId)) tokenEngine.registerAccount(userId);

    if (mode === 'health') {
      const cost = tokenEngine.spend(userId, 'monitor_advanced');
      if (!cost.success) {
        await sock.sendMessage(msg.key.remoteJid, { text: `Token tidak cukup: ${cost.error}` });
        return;
      }
      const report = await health.getHealthReport();
      const text = `
*Health Report*

Status: ${report.status}
Health Score: ${report.healthScore}/100

Memory: ${report.latest?.memory?.usedPercent || 'N/A'}% used
CPU: ${report.latest?.cpu?.usagePercent || 'N/A'}%
Uptime: ${Math.floor(report.uptime / 60)}m

Anomalies: ${report.anomalies?.length || 0}
`.trim();
      await sock.sendMessage(msg.key.remoteJid, { text });
      return;
    }

    if (mode === 'errors') {
      if (!isOwner(msg, config)) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Owner only.' });
        return;
      }
      const summary = await errors.getErrorSummary();
      const lines = summary.slice(0, 10).map(e =>
        `${e.severity}: ${e.error} (${e.count}x)`
      );
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Error Summary*\n\n${lines.join('\n') || 'No errors'}`
      });
      return;
    }

    if (mode === 'logs') {
      const audit = engine.getSystem('audit');
      if (!audit) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Audit system not available.' });
        return;
      }
      const logs = await audit.query({ userId, limit: 20 });
      const lines = logs.map(l => `${l.action}: ${l.severity}`);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Your Audit Logs*\n\n${lines.join('\n') || 'No logs'}`
      });
      return;
    }

    if (mode === 'system') {
      if (!isOwner(msg, config)) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Owner only.' });
        return;
      }
      const engine = getEngine();
      const status = await engine.getStatus();
      const lines = Object.entries(status.systems || {}).map(([k, v]) => {
        if (typeof v === 'object') {
          return `${k}: ${v.active !== undefined ? (v.active ? 'OK' : 'OFF') : 'OK'}`;
        }
        return `${k}: ${v}`;
      });
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*System Status*\n\n${lines.join('\n')}`
      });
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `*Monitor Commands*\n\n!monitor health - System health\n!monitor errors - Error summary (owner)\n!monitor logs - Your audit logs\n!monitor system - Full system status (owner)`
    });
  }
};
