const { getEngine } = require('../src/core/engine');

const { isOwnerMsg, normalizeNumber } = require('../src/utils/ownerUtils');
function isOwner(msg, config) { return isOwnerMsg(msg, config.ownerNumber); }
function digitsOnly(v) { return normalizeNumber(v); }

module.exports = {
  name: 'audit',
  aliases: ['logs', 'history'],
  description: 'Audit log viewer',
  execute: async (sock, msg, args, config) => {
    if (!isOwner(msg, config)) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Owner only.' });
      return;
    }

    const engine = getEngine();
    const audit = engine.getSystem('audit');
    const mode = (args.shift() || 'recent').toLowerCase();

    if (!audit) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Audit system not available.' });
      return;
    }

    if (mode === 'recent') {
      const logs = await audit.query({ limit: 20 });
      const lines = logs.map(l => `${l.action} | ${l.userId} | ${l.severity}`);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Recent Audit Logs*\n\n${lines.join('\n') || 'No logs'}`
      });
      return;
    }

    if (mode === 'user') {
      const userId = digitsOnly(args.shift());
      if (!userId) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !audit user <userId>' });
        return;
      }
      const logs = await audit.query({ userId, limit: 20 });
      const lines = logs.map(l => `${l.action} | ${l.severity}`);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Audit for ${userId}*\n\n${lines.join('\n') || 'No logs'}`
      });
      return;
    }

    if (mode === 'severity') {
      const sev = args.shift();
      if (!sev) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !audit severity <low/medium/high/critical>' });
        return;
      }
      const logs = await audit.query({ severity: sev, limit: 20 });
      const lines = logs.map(l => `${l.action} | ${l.userId}`);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Audit - ${sev}*\n\n${lines.join('\n') || 'No logs'}`
      });
      return;
    }

    if (mode === 'count') {
      const status = await audit.getStatus();
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Audit Stats*\n\nTotal Logs: ${status.totalLogs}\nPending Flush: ${status.pendingFlush}`
      });
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `*Audit Commands*\n\n!audit recent - Recent logs\n!audit user <id> - User logs\n!audit severity <level> - By severity\n!audit count - Statistics`
    });
  }
};
