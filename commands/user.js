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

function isAdmin(msg, config) {
  const userId = senderNumber(msg);
  const engine = getEngine();
  const perms = engine.getSystem('permissions');
  if (!perms) return false;
  const level = perms.getUserLevel(userId);
  return level >= 80;
}

module.exports = {
  name: 'user',
  aliases: ['users'],
  description: 'User management commands',
  execute: async (sock, msg, args, config) => {
    const userId = senderNumber(msg);
    const engine = getEngine();
    const perms = engine.getSystem('permissions');
    const tokenEngine = engine.getSystem('token');
    const mode = (args.shift() || 'me').toLowerCase();

    if (!perms || !tokenEngine) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Sistem belum aktif.' });
      return;
    }

    if (!tokenEngine.getAccount(userId)) tokenEngine.registerAccount(userId);
    if (!perms.getUser(userId)) perms.registerUser(userId, 'GUEST');

    if (mode === 'me') {
      const user = perms.getUser(userId);
      const balance = tokenEngine.getBalance(userId);
      const warning = tokenEngine.getLowTokenWarning(userId);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Your Profile*\n\nID: ${userId}\nRole: ${user?.role || 'GUEST'}\nLevel: ${user?.level || 10}\nTokens: ${balance.toLocaleString()}\nStatus: ${warning.warning}`
      });
      return;
    }

    if (mode === 'role') {
      if (!isOwner(msg, config)) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Owner only.' });
        return;
      }
      const target = digitsOnly(args.shift());
      const role = (args.shift() || '').toUpperCase();
      if (!target || !role) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !user role <userId> <OWNER/ADMIN/USER/GUEST>' });
        return;
      }
      if (!perms.getUser(target)) perms.registerUser(target, 'GUEST');
      const result = perms.setRole(target, role);
      await sock.sendMessage(msg.key.remoteJid, {
        text: result ? `Role set: ${target} -> ${role}` : `Failed to set role`
      });
      return;
    }

    if (mode === 'list') {
      if (!isAdmin(msg, config)) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Admin only.' });
        return;
      }
      const status = await perms.getStatus();
      const lines = status.roles.map(r => `${r.key}: Level ${r.level}`);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*User System*\n\nTotal: ${status.totalUsers}\nRoles:\n${lines.join('\n')}`
      });
      return;
    }

    if (mode === 'lock') {
      if (!isOwner(msg, config)) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Owner only.' });
        return;
      }
      const target = digitsOnly(args.shift());
      const duration = parseInt(args.shift() || '3600');
      if (!target) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !user lock <userId> [duration_seconds]' });
        return;
      }
      if (!perms.getUser(target)) perms.registerUser(target, 'GUEST');
      perms.lockAccount(target, duration * 1000);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `User ${target} locked for ${duration} seconds.`
      });
      return;
    }

    if (mode === 'unlock') {
      if (!isOwner(msg, config)) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Owner only.' });
        return;
      }
      const target = digitsOnly(args.shift());
      if (!target) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !user unlock <userId>' });
        return;
      }
      perms.unlockAccount(target);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `User ${target} unlocked.`
      });
      return;
    }

    if (mode === 'temp') {
      if (!isAdmin(msg, config)) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Admin only.' });
        return;
      }
      const target = digitsOnly(args.shift());
      const command = args.shift();
      const duration = parseInt(args.shift() || '3600');
      if (!target || !command) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !user temp <userId> <command> [duration_seconds]' });
        return;
      }
      if (!perms.getUser(target)) perms.registerUser(target, 'GUEST');
      perms.grantTempAccess(target, command, duration * 1000);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `Temp access granted: ${target} -> ${command} for ${duration}s`
      });
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `*User Commands*\n\n!user me - Your profile\n!user role <id> <role> - Set role (owner)\n!user list - List users (admin)\n!user lock <id> [duration] - Lock user (owner)\n!user unlock <id> - Unlock user (owner)\n!user temp <id> <cmd> [duration] - Grant temp access (admin)`
    });
  }
};
