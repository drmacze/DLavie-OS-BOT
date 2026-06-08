const { getEngine } = require('../src/core/engine');

const { isOwnerMsg } = require('../src/utils/ownerUtils');
function isOwner(msg, config) { return isOwnerMsg(msg, config.ownerNumber); }

module.exports = {
  name: 'plugin',
  aliases: ['plugins', 'pl'],
  description: 'Plugin management commands',
  execute: async (sock, msg, args, config) => {
    const { extractSenderNumber } = require('../src/utils/ownerUtils');
    const userId = extractSenderNumber(msg);
    const engine = getEngine();
    const plugins = engine.getSystem('plugins');
    const tokenEngine = engine.getSystem('token');
    const mode = (args.shift() || 'list').toLowerCase();

    if (!plugins) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Plugin system belum aktif.' });
      return;
    }

    if (!tokenEngine.getAccount(userId)) tokenEngine.registerAccount(userId);

    if (mode === 'list') {
      const installed = await plugins.getInstalled();
      const lines = installed.map(p => `${p.name}: v${p.version} (${p.enabled ? 'ON' : 'OFF'}) Health: ${p.healthScore}%`);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Installed Plugins*\n\n${lines.join('\n') || 'No plugins installed'}`
      });
      return;
    }

    if (mode === 'search') {
      const query = args.join(' ');
      const results = await plugins.search(query);
      const lines = results.slice(0, 10).map(p => `${p.name} v${p.version}: ${p.description}`);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Plugin Search*\n\n${lines.join('\n') || 'No results'}`
      });
      return;
    }

    if (mode === 'install') {
      const pluginId = args.shift();
      if (!pluginId) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !plugin install <pluginId>' });
        return;
      }
      const cost = tokenEngine.spend(userId, 'plugin_install');
      if (!cost.success) {
        await sock.sendMessage(msg.key.remoteJid, { text: `Token tidak cukup: ${cost.error}` });
        return;
      }
      const result = await plugins.install(pluginId);
      await sock.sendMessage(msg.key.remoteJid, {
        text: result.success ? `Installed: ${result.plugin.name} v${result.plugin.version}` : `Error: ${result.error}`
      });
      return;
    }

    if (mode === 'remove') {
      if (!isOwner(msg, config)) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Owner only.' });
        return;
      }
      const pluginId = args.shift();
      if (!pluginId) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !plugin remove <pluginId>' });
        return;
      }
      const result = await plugins.uninstall(pluginId);
      await sock.sendMessage(msg.key.remoteJid, {
        text: result.success ? `Removed: ${pluginId}` : `Error: ${result.error}`
      });
      return;
    }

    if (mode === 'update') {
      const pluginId = args.shift();
      if (!pluginId) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !plugin update <pluginId>' });
        return;
      }
      const cost = tokenEngine.spend(userId, 'plugin_update');
      if (!cost.success) {
        await sock.sendMessage(msg.key.remoteJid, { text: `Token tidak cukup: ${cost.error}` });
        return;
      }
      const result = await plugins.update(pluginId);
      await sock.sendMessage(msg.key.remoteJid, {
        text: result.success ? (result.updated ? `Updated to v${result.newVersion}` : result.message) : `Error: ${result.error}`
      });
      return;
    }

    if (mode === 'health') {
      const health = await plugins.getAllHealth();
      const lines = health.map(p => `${p.name}: ${p.healthScore}% (${p.enabled ? 'ON' : 'OFF'})`);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Plugin Health*\n\n${lines.join('\n') || 'No plugins'}`
      });
      return;
    }

    if (mode === 'check') {
      if (!isOwner(msg, config)) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Owner only.' });
        return;
      }
      const updates = await plugins.checkUpdates();
      const lines = updates.map(u => `${u.id}: ${u.current} -> ${u.latest}`);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Available Updates*\n\n${lines.join('\n') || 'All up to date'}`
      });
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `*Plugin Commands*\n\n!plugin list - Installed plugins\n!plugin search <query> - Search marketplace\n!plugin install <id> - Install plugin\n!plugin remove <id> - Remove plugin (owner)\n!plugin update <id> - Update plugin\n!plugin health - Health check\n!plugin check - Check updates (owner)`
    });
  }
};
