const config = require('../src/config');

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
  name: 'config',
  aliases: ['settings', 'env', 'cfg'],
  description: 'View and manage config',
  execute: async (sock, msg, args, config) => {
    if (!isOwner(msg, config)) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Owner only.' });
      return;
    }

    const mode = (args.shift() || 'view').toLowerCase();
    const key = args.shift();
    const value = args.join(' ');

    if (mode === 'view') {
      const text = `
*Config Overview*

Bot: ${config.botName}
Bot Number: ${config.botNumber || 'Not set'}
Owner: ${config.ownerNumber}

API Port: ${config.api.port}
WebSocket: ${config.websocket.enabled ? 'ON' : 'OFF'}

Supabase: ${config.supabase.url ? 'Connected' : 'Not configured'}

Auto-Fix: ${config.autoFix.startupRepair ? 'ON' : 'OFF'}
AI Fallback: ${config.autoFix.aiFallback ? 'ON' : 'OFF'}

Token Default: ${config.token.defaultFreeTokens}
Rate Limit: ${config.token.rateLimitAmount}/${config.token.rateLimitWindow}s

Max Bots/User: ${config.multiBot.maxBotsPerUser}
Heartbeat: ${config.multiBot.heartbeatInterval}s

Stealth: ${config.security.stealthMode ? 'ON' : 'OFF'}
Lockdown: ${config.security.emergencyLockdown ? 'ON' : 'OFF'}

Health Check: ${config.monitoring.healthCheckInterval}s
Log Retention: ${config.monitoring.logRetention} days

Plugin Sandbox: ${config.plugin.sandboxEnabled ? 'ON' : 'OFF'}
Auto Update: ${config.plugin.autoUpdate ? 'ON' : 'OFF'}

Webhook: ${config.website.enableWebhook ? 'ON' : 'OFF'}
Dashboard: ${config.website.dashboardUrl || 'Not set'}
`.trim();
      await sock.sendMessage(msg.key.remoteJid, { text });
      return;
    }

    if (mode === 'get') {
      if (!key) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !config get <key>' });
        return;
      }
      const val = config[key] || config.supabase[key] || config.api[key] || config.token[key] || config.multiBot[key] || config.security[key] || config.monitoring[key] || config.plugin[key] || config.website[key] || config.autoFix[key] || config.ai[key] || config.websocket[key];
      await sock.sendMessage(msg.key.remoteJid, {
        text: `${key}: ${JSON.stringify(val) || 'not found'}`
      });
      return;
    }

    if (mode === 'toggle') {
      if (!key) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !config toggle <key>' });
        return;
      }
      // Simple toggle for boolean configs
      if (config.security.hasOwnProperty(key)) {
        config.security[key] = !config.security[key];
        await sock.sendMessage(msg.key.remoteJid, { text: `${key} toggled to ${config.security[key]}` });
      } else if (config.autoFix.hasOwnProperty(key)) {
        config.autoFix[key] = !config.autoFix[key];
        await sock.sendMessage(msg.key.remoteJid, { text: `${key} toggled to ${config.autoFix[key]}` });
      } else {
        await sock.sendMessage(msg.key.remoteJid, { text: `Key ${key} not found or not toggleable.` });
      }
      return;
    }

    if (mode === 'list') {
      const keys = Object.keys(config).filter(k => typeof config[k] !== 'function');
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Config Keys*\n\n${keys.join(', ')}`
      });
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `*Config Commands*\n\n!config view - View all config\n!config get <key> - Get value\n!config toggle <key> - Toggle boolean\n!config list - List keys`
    });
  }
};
