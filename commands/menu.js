const { FEATURE_COSTS } = require('../src/token/tokenEngine');

module.exports = {
  name: 'menu',
  aliases: ['help', 'start'],
  description: 'Show DLavie OS menu',
  execute: async (sock, msg, args, config) => {
    const text = `
*DLAVIE OS - Control Panel*

*Basic Commands*
!menu - Show this menu
!halo - Greeting
!ping - Check bot status
!info - System info
!help - Command help

*User Commands*
!token balance - Check token balance
!token history - Token history
!bot connect - Connect your bot
!bot status - Bot status
!plugin list - List plugins
!plugin search - Search plugins

*Admin Commands*
!bot relay <command> - Relay to bot
!broadcast <msg> - Broadcast
!monitor health - Health check
!plugin install - Install plugin
!user list - List users
!token give - Give tokens

*Owner Commands*
!owner - Owner info
!status - Full status
!lockdown - Emergency lockdown
!stealth - Stealth mode
!audit - Audit logs
!fix - Auto-fix system

*Token System*
Free tokens: 5,000
Rate limit: 100/10min

Powered by DLavie OS v2.0
`.trim();
    await sock.sendMessage(msg.key.remoteJid, { text });
  }
};
