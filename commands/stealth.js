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
  name: 'stealth',
  aliases: ['hide', 'silent'],
  description: 'Stealth mode control',
  execute: async (sock, msg, args, config) => {
    if (!isOwner(msg, config)) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Owner only.' });
      return;
    }

    const mode = (args.shift() || 'status').toLowerCase();

    if (mode === 'on') {
      config.security.stealthMode = true;
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*STEALTH MODE ON*\n\nBot will now operate silently. Responses only visible to owner. Audit logging continues.`
      });
      return;
    }

    if (mode === 'off') {
      config.security.stealthMode = false;
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Stealth mode OFF*\n\nBot operating normally.`
      });
      return;
    }

    if (mode === 'status') {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Stealth Mode: ${config.security.stealthMode ? 'ON' : 'OFF'}*`
      });
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `*Stealth Commands*\n\n!stealth on - Enable stealth\n!stealth off - Disable stealth\n!stealth status - Check status`
    });
  }
};
