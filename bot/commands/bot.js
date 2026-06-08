const { getEngine } = require('../src/core/engine');

const { isOwnerMsg } = require('../src/utils/ownerUtils');
function isOwner(msg, config) { return isOwnerMsg(msg, config.ownerNumber); }

module.exports = {
  name: 'bot',
  aliases: ['bots'],
  description: 'Multi-bot control commands',
  execute: async (sock, msg, args, config) => {
    const { extractSenderNumber } = require('../src/utils/ownerUtils');
    const userId = extractSenderNumber(msg);
    const engine = getEngine();
    const multiBot = engine.getSystem('multiBot');
    const tokenEngine = engine.getSystem('token');
    const mode = (args.shift() || 'status').toLowerCase();

    if (!multiBot) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Multi-bot system belum aktif.' });
      return;
    }

    if (!tokenEngine.getAccount(userId)) tokenEngine.registerAccount(userId);

    if (mode === 'status') {
      const status = await multiBot.getStatus();
      const text = `
*Multi-Bot Status*

Total Bots: ${status.totalBots}
Online: ${status.onlineBots}
Offline: ${status.offlineBots}
Groups: ${status.totalGroups}
Avg Health: ${status.averageHealth}%
`.trim();
      await sock.sendMessage(msg.key.remoteJid, { text });
      return;
    }

    if (mode === 'list') {
      const bots = await multiBot.getAllBots();
      const lines = bots.map(b => `${b.name}: ${b.status} (Health: ${b.healthScore}%)`);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Connected Bots*\n\n${lines.join('\n') || 'No bots connected'}`
      });
      return;
    }

    if (mode === 'connect') {
      const token = args.shift();
      const name = args.join(' ');
      if (!token || !name) {
        await sock.sendMessage(msg.key.remoteJid, {
          text: 'Format: !bot connect <token> <name>'
        });
        return;
      }
      const cost = tokenEngine.spend(userId, 'bot_connect');
      if (!cost.success) {
        await sock.sendMessage(msg.key.remoteJid, { text: `Token tidak cukup: ${cost.error}` });
        return;
      }
      const bot = await multiBot.registerBot(token, { name, ownerId: userId, phoneNumber: userId });
      await sock.sendMessage(msg.key.remoteJid, {
        text: bot ? `Bot connected: ${bot.name} (${token})` : `Failed to connect bot.`
      });
      return;
    }

    if (mode === 'disconnect') {
      const token = args.shift();
      if (!token) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !bot disconnect <token>' });
        return;
      }
      await multiBot.unregisterBot(token);
      await sock.sendMessage(msg.key.remoteJid, { text: `Bot disconnected: ${token}` });
      return;
    }

    if (mode === 'relay') {
      const token = args.shift();
      const command = args.shift();
      const commandArgs = args.join(' ');
      if (!token || !command) {
        await sock.sendMessage(msg.key.remoteJid, {
          text: 'Format: !bot relay <token> <command> [args]'
        });
        return;
      }
      const cost = tokenEngine.spend(userId, 'bot_relay');
      if (!cost.success) {
        await sock.sendMessage(msg.key.remoteJid, { text: `Token tidak cukup: ${cost.error}` });
        return;
      }
      const result = await multiBot.relayCommand(token, command, { args: commandArgs });
      await sock.sendMessage(msg.key.remoteJid, {
        text: result.success ? `Command relayed to ${token}: ${command}` : `Error: ${result.error}`
      });
      return;
    }

    if (mode === 'health') {
      const token = args.shift();
      if (!token) {
        const bots = await multiBot.getAllBots();
        const lines = bots.map(b => `${b.name}: ${b.healthScore}%`);
        await sock.sendMessage(msg.key.remoteJid, {
          text: `*Bot Health*\n\n${lines.join('\n') || 'No bots'}`
        });
        return;
      }
      const bot = await multiBot.getBotStatus(token);
      await sock.sendMessage(msg.key.remoteJid, {
        text: bot ? `*${bot.name}*\nHealth: ${bot.healthScore}%\nStatus: ${bot.status}\nUptime: ${bot.uptime || 'N/A'}\nMessages: ${bot.messagesProcessed || 0}` : `Bot not found`
      });
      return;
    }

    if (mode === 'group') {
      if (!isOwner(msg, config)) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Owner only.' });
        return;
      }
      const sub = args.shift();
      if (sub === 'create') {
        const name = args.shift();
        const tokens = args;
        if (!name) {
          await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !bot group create <name> [tokens...]' });
          return;
        }
        const group = await multiBot.createGroup(name, userId, tokens);
        await sock.sendMessage(msg.key.remoteJid, { text: `Group created: ${group.name} (${group.id})` });
        return;
      }
      if (sub === 'list') {
        const groups = await multiBot.getGroupsByOwner(userId);
        const lines = groups.map(g => `${g.name}: ${g.botTokens.length} bots`);
        await sock.sendMessage(msg.key.remoteJid, {
          text: `*Bot Groups*\n\n${lines.join('\n') || 'No groups'}`
        });
        return;
      }
      return;
    }

    // Bulk commands (owner only)
    if (mode === 'bulk') {
      if (!isOwner(msg, config)) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Owner only.' });
        return;
      }
      const command = args.shift();
      const tokens = args;
      if (!command || tokens.length === 0) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !bot bulk <command> <tokens...>' });
        return;
      }
      const results = await multiBot.bulkCommand(tokens, command);
      const lines = results.map(r => `${r.token}: ${r.success ? 'OK' : r.error}`);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Bulk Command: ${command}*\n\n${lines.join('\n')}`
      });
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `*Bot Commands*\n\n!bot status - Multi-bot status\n!bot list - List connected bots\n!bot connect <token> <name> - Connect bot\n!bot disconnect <token> - Disconnect bot\n!bot relay <token> <cmd> - Relay command\n!bot health [token] - Bot health\n!bot group create/list - Manage groups\n!bot bulk <cmd> <tokens> - Bulk command (owner)`
    });
  }
};
