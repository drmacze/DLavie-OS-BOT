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
  name: 'status',
  aliases: ['sys'],
  description: 'Full system status',
  execute: async (sock, msg, args, config, ctx = {}) => {
    const safeSend = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));
    if (!isOwner(msg, config)) {
      await safeSend(msg.key.remoteJid, { text: '🔒 Command ini khusus Owner.' });
      return;
    }

    const engine = getEngine();
    const status = await engine.getStatus();
    const token = engine.getSystem('token');
    const multiBot = engine.getSystem('multiBot');
    const health = engine.getSystem('health');
    const errors = engine.getSystem('errors');
    const plugins = engine.getSystem('plugins');
    const audit = engine.getSystem('audit');
    const autoFix = engine.getSystem('autoFix');

    const tokenStatus = token ? await token.getStatus() : null;
    const botStatus = multiBot ? await multiBot.getStatus() : null;
    const healthStatus = health ? await health.getStatus() : null;
    const errorStatus = errors ? await errors.getStatus() : null;
    const pluginStatus = plugins ? await plugins.getStatus() : null;
    const auditStatus = audit ? await audit.getStatus() : null;
    const autoFixStatus = autoFix ? await autoFix.getStatus() : null;

    const text = `
*DLAVIE OS - Full System Status*

Engine: ${status.engine}
Uptime: ${Math.floor((Date.now() - status.startedAt) / 1000 / 60)}m
Lockdown: ${status.emergencyLockdown ? 'YES' : 'No'}

*Token System*
Accounts: ${tokenStatus?.totalAccounts || 'N/A'}
Total Tokens: ${tokenStatus?.totalTokens?.toLocaleString() || 'N/A'}

*Multi-Bot*
Bots: ${botStatus?.totalBots || 'N/A'} (Online: ${botStatus?.onlineBots || 'N/A'})
Avg Health: ${botStatus?.averageHealth || 'N/A'}%

*Health Monitor*
Metrics: ${healthStatus?.totalMetrics || 'N/A'}
Anomalies: ${healthStatus?.totalAnomalies || 'N/A'}

*Error Aggregator*
Total: ${errorStatus?.totalErrors || 'N/A'}
Unique: ${errorStatus?.uniqueErrors || 'N/A'}
Unresolved: ${errorStatus?.unresolved || 'N/A'}

*Plugin Manager*
Installed: ${pluginStatus?.installed || 'N/A'}
Avg Health: ${pluginStatus?.averageHealth || 'N/A'}%

*Audit Log*
Total: ${auditStatus?.totalLogs || 'N/A'}

*Auto Fix*
Enabled: ${autoFixStatus?.enabled || 'N/A'}
Pending: ${autoFixStatus?.pendingCount || 'N/A'}

*Systems*
${Object.entries(status.systems || {}).map(([k, v]) => {
  if (v && typeof v === 'object') return `${k}: ${v.active ? 'OK' : 'OFF'}`;
  return `${k}: ${v}`;
}).join('\n')}
`.trim();

    await safeSend(msg.key.remoteJid, { text });
  }
};
