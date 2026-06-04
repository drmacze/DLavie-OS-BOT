const config = require('../src/config');

module.exports = {
  name: 'info',
  aliases: ['about', 'system'],
  description: 'System information',
  execute: async (sock, msg, args, config) => {
    const text = `
*DLAVIE OS - System Info*

Bot: ${config.botName}
Version: 2.0.0
Platform: Multi-Bot Control

Features:
- Multi-Bot Control
- Token System
- Health Monitoring
- Plugin System
- Auto-Fix
- AI Fallback
- WebSocket API
- Web Dashboard

Database: Supabase
API: REST + WebSocket
Security: RBAC + Audit Log

Status: Online
`.trim();
    await sock.sendMessage(msg.key.remoteJid, { text });
  }
};
