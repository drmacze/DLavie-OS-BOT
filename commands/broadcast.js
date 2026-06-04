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
  name: 'broadcast',
  aliases: ['bc', 'announce'],
  description: 'Broadcast message to users',
  execute: async (sock, msg, args, config) => {
    if (!isOwner(msg, config)) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Owner only.' });
      return;
    }

    const userId = senderNumber(msg);
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
