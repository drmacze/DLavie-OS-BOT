/**
 * DLavie OS — !debug command
 * Diagnostik owner: tampilkan JID, nomor terdeteksi, status owner, config.
 * Owner only — command ini critical untuk troubleshooting.
 */

'use strict';

const { extractSenderNumber, parseJid, normalizeNumber, isOwnerMsg } = require('../src/utils/ownerUtils');
const { getWebAuth } = require('../src/auth/webAuth');

module.exports = {
  name: 'debug',
  aliases: ['diag', 'whoami', 'checkowner'],
  description: 'Diagnostik JID dan status owner (Owner only)',

  execute: async (sock, msg, args, config, ctx = {}) => {
    const jid      = msg.key.remoteJid;
    const safeSend = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));

    const rawParticipant = msg.key.participant || '';
    const rawRemoteJid   = msg.key.remoteJid   || '';
    const rawJid         = rawParticipant || rawRemoteJid;

    const parsedSender   = parseJid(rawJid);
    const extractedId    = extractSenderNumber(msg);
    const ownerNum       = config.ownerNumber || config.bot?.ownerNumber || '';
    const normalizedOwner = normalizeNumber(ownerNum);

    const ownerDetected  = isOwnerMsg(msg, ownerNum);
    const webAuth        = getWebAuth();
    const isLoggedIn     = webAuth.isLoggedIn(extractedId);
    const session        = webAuth.getSession(extractedId);

    const mode = (args[0] || 'jid').toLowerCase();

    if (mode === 'jid' || mode === 'owner' || mode === 'all') {
      const lines = [
        `*🔍 DLavie OS — Debug Info*`,
        ``,
        `*JID Raw:*`,
        `• participant: \`${rawParticipant || '(kosong)'}\``,
        `• remoteJid:   \`${rawRemoteJid}\``,
        `• fromMe:      \`${msg.key.fromMe}\``,
        ``,
        `*Hasil Parsing:*`,
        `• parseJid():        \`${parsedSender}\``,
        `• extractSenderNumber(): \`${extractedId}\``,
        ``,
        `*Owner Check:*`,
        `• OWNER_NUMBER env:  \`${ownerNum || '(tidak diset)'}\``,
        `• Normalized owner:  \`${normalizedOwner || '(kosong)'}\``,
        `• Sender parsed:     \`${extractedId}\``,
        `• ✅ isOwner:        \`${ownerDetected ? 'YA — OWNER TERDETEKSI ✅' : 'TIDAK — bukan owner ❌'}\``,
        ``,
        `*Session:*`,
        `• Login status: \`${isLoggedIn ? 'Logged in ✅' : 'Tidak login'}\``,
        `• Email: \`${session?.email || '-'}\``,
        `• Plan:  \`${session?.plan  || '-'}\``,
        ``,
        `*Config:*`,
        `• botName:  \`${config.botName || '-'}\``,
        `• botNumber: \`${config.botNumber || '-'}\``,
        `• prefix:    \`${config.botPrefix || '!'}\``,
      ];

      await safeSend(jid, { text: lines.join('\n') });
    }

    if (mode === 'config' || mode === 'all') {
      const cfgLines = [
        `*⚙️ Runtime Config*`,
        ``,
        `• autoFix.aiFallback: \`${config.autoFix?.aiFallback}\``,
        `• security.stealthMode: \`${config.security?.stealthMode}\``,
        `• security.emergencyLockdown: \`${config.security?.emergencyLockdown}\``,
        `• token.defaultFreeTokens: \`${config.token?.defaultFreeTokens}\``,
        `• multiBot.maxBotsPerUser: \`${config.multiBot?.maxBotsPerUser}\``,
        `• multiBot.autoReconnect: \`${config.multiBot?.autoReconnect}\``,
        `• api.port: \`${config.api?.port}\``,
        `• website.dashboardUrl: \`${config.website?.dashboardUrl || '-'}\``,
      ];
      await safeSend(jid, { text: cfgLines.join('\n') });
    }

    if (mode === 'env') {
      // Tampilkan environment tools yang tersedia (tanpa nilai sensitif)
      const checks = {
        OWNER_NUMBER: !!process.env.OWNER_NUMBER,
        BOT_NUMBER:   !!process.env.BOT_NUMBER,
        JWT_SECRET:   !!process.env.JWT_SECRET,
        DATABASE_URL: !!process.env.DATABASE_URL,
        GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
        OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
        GROK_API_KEY:   !!process.env.GROK_API_KEY,
      };
      const envLines = [`*🌍 Environment Variables*`, ''];
      for (const [k, v] of Object.entries(checks)) {
        envLines.push(`• ${k}: ${v ? '✅ diset' : '❌ tidak diset'}`);
      }
      await safeSend(jid, { text: envLines.join('\n') });
    }

    if (!['jid', 'owner', 'all', 'config', 'env'].includes(mode)) {
      await safeSend(jid, {
        text: `*🔍 Debug Command*\n\n\`!debug\` / \`!debug jid\` — Info JID & owner status\n\`!debug config\` — Runtime config\n\`!debug env\` — Environment variables\n\`!debug all\` — Semua info`
      });
    }
  }
};
