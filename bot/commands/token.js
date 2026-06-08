const { getEngine } = require('../src/core/engine');

const { isOwnerMsg, normalizeNumber } = require('../src/utils/ownerUtils');
function isOwner(msg, config) { return isOwnerMsg(msg, config.ownerNumber); }
function digitsOnly(v) { return normalizeNumber(v); }

module.exports = {
  name: 'token',
  aliases: ['tokens', 'balance'],
  description: 'Token system commands',
  execute: async (sock, msg, args, config) => {
    const { extractSenderNumber } = require('../src/utils/ownerUtils');
    const userId = extractSenderNumber(msg);
    const engine = getEngine();
    const tokenEngine = engine.getSystem('token');
    const permissions = engine.getSystem('permissions');
    const mode = (args.shift() || 'balance').toLowerCase();

    if (!tokenEngine) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Token system belum aktif.' });
      return;
    }

    // Ensure account exists
    if (!tokenEngine.getAccount(userId)) {
      tokenEngine.registerAccount(userId);
    }

    if (mode === 'balance') {
      const balance = tokenEngine.getBalance(userId);
      const warning = tokenEngine.getLowTokenWarning(userId);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Token Balance*\n\nBalance: ${balance.toLocaleString()} tokens\nStatus: ${warning.warning}\n${warning.message}`
      });
      return;
    }

    if (mode === 'history') {
      const history = tokenEngine.getHistory(userId, 20);
      const lines = history.map(h => {
        const type = h.type === 'spend' ? `-${h.cost}` : h.type === 'earn' ? `+${h.amount}` : `-${h.amount}`;
        return `${new Date(h.timestamp).toLocaleString()}: ${type} (${h.feature || h.reason})`;
      });
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Token History*\n\n${lines.join('\n') || 'No transactions'}`
      });
      return;
    }

    if (mode === 'heatmap') {
      const heatmap = tokenEngine.getHeatmap(userId);
      const lines = heatmap.map(h => `${h.day}: Spent ${h.spent}, Earned ${h.earned}, ${h.transactions} tx`);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Token Heatmap (7 Days)*\n\n${lines.join('\n')}`
      });
      return;
    }

    if (mode === 'features') {
      const costs = tokenEngine.getFeatureCosts();
      const lines = Object.entries(costs).map(([k, v]) => `${k}: ${v.cost} tokens - ${v.description}`);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Feature Costs*\n\n${lines.join('\n')}`
      });
      return;
    }

    // Admin commands
    if (mode === 'give') {
      if (!isOwner(msg, config)) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Owner only.' });
        return;
      }
      const target = digitsOnly(args.shift());
      const amount = parseInt(args.shift());
      if (!target || !amount) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !token give <userId> <amount>' });
        return;
      }
      if (!tokenEngine.getAccount(target)) tokenEngine.registerAccount(target);
      const result = tokenEngine.earn(target, amount, 'admin_give');
      await sock.sendMessage(msg.key.remoteJid, {
        text: result.success ? `Gave ${amount} tokens to ${target}. New balance: ${result.balance}` : `Error: ${result.error}`
      });
      return;
    }

    if (mode === 'deduct') {
      if (!isOwner(msg, config)) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Owner only.' });
        return;
      }
      const target = digitsOnly(args.shift());
      const amount = parseInt(args.shift());
      if (!target || !amount) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !token deduct <userId> <amount>' });
        return;
      }
      const result = tokenEngine.deduct(target, amount, 'admin_deduct');
      await sock.sendMessage(msg.key.remoteJid, {
        text: result.success ? `Deducted ${amount} tokens from ${target}. New balance: ${result.balance}` : `Error: ${result.error}`
      });
      return;
    }

    if (mode === 'topup') {
      const amount = parseInt(args.shift());
      if (!amount) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !token topup <amount> (via website)' });
        return;
      }
      await sock.sendMessage(msg.key.remoteJid, {
        text: `Topup ${amount} tokens via website DLavie OS Dashboard. (Coming soon)`
      });
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `*Token Commands*\n\n!token balance - Check balance\n!token history - Transaction history\n!token heatmap - Usage heatmap\n!token features - Feature costs\n!token topup <amount> - Topup tokens\n(Owner: !token give/deduct <user> <amount>)`
    });
  }
};
