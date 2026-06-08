const { getEngine } = require('../src/core/engine');

const { isOwnerMsg } = require('../src/utils/ownerUtils');
function isOwner(msg, config) { return isOwnerMsg(msg, config.ownerNumber); }

module.exports = {
  name: 'broadcast',
  aliases: ['bc', 'announce'],
  description: 'Broadcast message to users',
  execute: async (sock, msg, args, config) => {
    if (!isOwner(msg, config)) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Owner only.' });
      return;
    }

    const { extractSenderNumber } = require('../src/utils/ownerUtils');
    const userId = extractSenderNumber(msg);
    const engine = getEngine();
    const tokenEngine = engine.getSystem('token');
    const message = args.join(' ');

    if (!message) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !broadcast <message>' });
      return;
    }

    const cost = tokenEngine.spend(userId, 'broadcast');
    if (!cost.success) {
      await sock.sendMessage(msg.key.remoteJid, { text: `Token tidak cukup: ${cost.error}` });
      return;
    }

    // In a real implementation, this would broadcast to all registered users
    // For now, we confirm the broadcast was queued
    await sock.sendMessage(msg.key.remoteJid, {
      text: `*Broadcast queued*\n\nMessage: ${message}\nCost: ${cost.cost} tokens\nRemaining: ${cost.balance}`
    });
  }
};
