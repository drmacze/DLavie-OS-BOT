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
  name: 'lockdown',
  aliases: ['emergency', 'shutdown'],
  description: 'Emergency lockdown control',
  execute: async (sock, msg, args, config) => {
    if (!isOwner(msg, config)) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Owner only.' });
      return;
    }

    const engine = getEngine();
    const mode = (args.shift() || 'status').toLowerCase();

    if (mode === 'on') {
      await engine.triggerEmergencyLockdown();
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*EMERGENCY LOCKDOWN ACTIVATED*\n\nAll systems are now locked down. Only owner can access. Use !lockdown off to lift.`
      });
      return;
    }

    if (mode === 'off') {
      await engine.liftEmergencyLockdown();
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Lockdown lifted*\n\nAll systems are now operational.`
      });
      return;
    }

    if (mode === 'status') {
      const status = await engine.getStatus();
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Lockdown Status*\n\nActive: ${status.emergencyLockdown ? 'YES' : 'No'}\nEngine: ${status.engine}`
      });
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `*Lockdown Commands*\n\n!lockdown on - Activate lockdown\n!lockdown off - Lift lockdown\n!lockdown status - Check status`
    });
  }
};
