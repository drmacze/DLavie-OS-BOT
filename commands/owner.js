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
  name: 'owner',
  aliases: ['admin', 'me'],
  description: 'Owner commands and info',
  execute: async (sock, msg, args, config) => {
    if (!isOwner(msg, config)) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Owner only.' });
      return;
    }

    const mode = (args.shift() || 'info').toLowerCase();

    if (mode === 'info') {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Owner Info*\n\nBot: ${config.botName}\nOwner: ${config.ownerNumber}\nBot Number: ${config.botNumber || 'Not set'}\n\nYou are the owner of this DLavie OS instance.`
      });
      return;
    }

    if (mode === 'emergency') {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Emergency Commands*\n\n!lockdown - Lock all accounts\n!stealth - Enable stealth mode\n!audit - View audit logs\n!fix apply - Run auto-fix\n!status - Full system status`
      });
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `*Owner Commands*\n\n!owner info - Owner info\n!owner emergency - Emergency commands list\n!status - Full system status\n!lockdown - Lockdown\n!stealth - Stealth mode\n!audit - Audit logs\n!fix - Auto-fix system`
    });
  }
};
