const { exec } = require('child_process');

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
  name: 'restart',
  aliases: ['reboot', 'reload'],
  description: 'Restart bot or systems',
  execute: async (sock, msg, args, config) => {
    if (!isOwner(msg, config)) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Owner only.' });
      return;
    }

    const mode = (args.shift() || 'bot').toLowerCase();

    if (mode === 'bot') {
      await sock.sendMessage(msg.key.remoteJid, {
        text: '*Restarting bot...*\nBot will reconnect in a few seconds.'
      });
      setTimeout(() => {
        process.exit(0); // Replit will auto-restart
      }, 2000);
      return;
    }

    if (mode === 'commands') {
      try {
        const cmdDir = require('path').join(__dirname, '..', 'commands');
        const files = require('fs').readdirSync(cmdDir).filter(f => f.endsWith('.js'));
        for (const f of files) {
          const fullPath = require('path').join(cmdDir, f);
          delete require.cache[require.resolve(fullPath)];
        }
        await sock.sendMessage(msg.key.remoteJid, {
          text: `*Commands reloaded*\n${files.length} commands refreshed.`
        });
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { text: `Error: ${err.message}` });
      }
      return;
    }

    if (mode === 'api') {
      await sock.sendMessage(msg.key.remoteJid, {
        text: '*API server restart requested.*\n(Requires manual restart in production)'
      });
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `*Restart Commands*\n\n!restart bot - Restart bot\n!restart commands - Reload commands\n!restart api - Restart API server`
    });
  }
};
