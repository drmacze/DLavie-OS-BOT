/**
 * DLavie OS - Permission & Role System
 * Role-based access control with command-level permissions.
 */

const config = require('../config');

const ROLES = {
  OWNER: { level: 100, name: 'Owner', permissions: ['*'] },
  ADMIN: { level: 80, name: 'Admin', permissions: [
    'bot.manage', 'bot.restart', 'bot.update', 'plugin.manage',
    'user.manage', 'audit.view', 'monitor.view', 'autofix.trigger',
    'token.give', 'token.deduct', 'broadcast'
  ]},
  USER: { level: 50, name: 'User', permissions: [
    'bot.view', 'bot.command', 'plugin.view', 'plugin.install',
    'monitor.view.self', 'token.view', 'token.use'
  ]},
  GUEST: { level: 10, name: 'Guest', permissions: [
    'bot.view.public', 'info.view', 'help.use'
  ]}
};

const COMMAND_PERMISSIONS = {
  // Owner only
  '!owner': { minRole: 100, category: 'owner' },
  '!status': { minRole: 100, category: 'owner' },
  '!lockdown': { minRole: 100, category: 'owner' },
  '!stealth': { minRole: 100, category: 'owner' },
  '!audit': { minRole: 100, category: 'owner' },

  // Admin+
  '!bot': { minRole: 80, category: 'admin' },
  '!user': { minRole: 80, category: 'admin' },
  '!token': { minRole: 80, category: 'admin', sub: { give: 80, deduct: 80, set: 100 } },
  '!broadcast': { minRole: 80, category: 'admin' },
  '!plugin': { minRole: 80, category: 'admin', sub: { manage: 80, install: 50, remove: 80 } },
  '!monitor': { minRole: 80, category: 'admin', sub: { all: 80, self: 50 } },
  '!schedule': { minRole: 80, category: 'admin' },
  '!group': { minRole: 80, category: 'admin' },

  // User+
  '!menu': { minRole: 10, category: 'user' },
  '!halo': { minRole: 10, category: 'user' },
  '!ping': { minRole: 10, category: 'user' },
  '!info': { minRole: 10, category: 'user' },
  '!help': { minRole: 10, category: 'user' },
  '!token': { minRole: 50, category: 'user', sub: { balance: 50, history: 50, topup: 50 } },
  '!plugin': { minRole: 50, category: 'user', sub: { list: 50, search: 50 } },
  '!bot': { minRole: 50, category: 'user', sub: { connect: 50, status: 50, disconnect: 50 } },
  '!monitor': { minRole: 50, category: 'user', sub: { health: 50, logs: 50 } },

  // Auto-fix (Owner only for apply, anyone for check)
  '!fix': { minRole: 10, category: 'autofix', sub: { help: 10, check: 10, apply: 100, install: 100, ai: 50, full: 100 } }
};

class PermissionManager {
  constructor() {
    this.users = new Map(); // userId -> { role, tempAccess, lockedUntil }
  }

  async init() {
    console.log('[DLAVIE][PERMISSIONS] Initialized');
  }

  registerUser(userId, role = 'GUEST') {
    const roleDef = ROLES[role];
    if (!roleDef) {
      console.warn(`[DLAVIE][PERMISSIONS] Unknown role: ${role}, defaulting to GUEST`);
      role = 'GUEST';
    }
    this.users.set(userId, {
      role,
      level: ROLES[role].level,
      registeredAt: Date.now(),
      tempAccess: [],
      lockedUntil: 0,
      loginAttempts: 0
    });
  }

  getUser(userId) {
    return this.users.get(userId) || null;
  }

  getUserLevel(userId) {
    const user = this.users.get(userId);
    if (!user) return 10; // Guest default
    if (user.lockedUntil > Date.now()) return 0; // Locked
    return user.level;
  }

  canExecute(userId, commandName, subCommand = null) {
    const user = this.users.get(userId);
    if (!user) return { allowed: false, reason: 'User not registered' };
    if (user.lockedUntil > Date.now()) return { allowed: false, reason: 'Account locked' };

    const cmdPerm = COMMAND_PERMISSIONS[commandName.toLowerCase()];
    if (!cmdPerm) return { allowed: true, reason: 'No permission rule defined' };

    let requiredLevel = cmdPerm.minRole;

    // Check sub-command permission
    if (subCommand && cmdPerm.sub && cmdPerm.sub[subCommand] !== undefined) {
      requiredLevel = cmdPerm.sub[subCommand];
    }

    const userLevel = this.getUserLevel(userId);
    const allowed = userLevel >= requiredLevel;

    // Check temp access override
    if (!allowed && user.tempAccess.includes(`${commandName}:${subCommand || '*'}`)) {
      return { allowed: true, reason: 'Temporary access granted' };
    }

    return {
      allowed,
      requiredLevel,
      userLevel,
      reason: allowed ? 'Permission granted' : `Required level ${requiredLevel}, your level ${userLevel}`
    };
  }

  grantTempAccess(userId, command, durationMs = 3600000) {
    const user = this.users.get(userId);
    if (!user) return false;
    user.tempAccess.push(command);
    setTimeout(() => {
      const idx = user.tempAccess.indexOf(command);
      if (idx > -1) user.tempAccess.splice(idx, 1);
    }, durationMs);
    return true;
  }

  revokeTempAccess(userId, command) {
    const user = this.users.get(userId);
    if (!user) return false;
    const idx = user.tempAccess.indexOf(command);
    if (idx > -1) user.tempAccess.splice(idx, 1);
    return true;
  }

  lockAccount(userId, durationMs) {
    const user = this.users.get(userId);
    if (!user) return false;
    user.lockedUntil = Date.now() + durationMs;
    user.loginAttempts = 0;
    return true;
  }

  unlockAccount(userId) {
    const user = this.users.get(userId);
    if (!user) return false;
    user.lockedUntil = 0;
    user.loginAttempts = 0;
    return true;
  }

  recordLoginAttempt(userId) {
    const user = this.users.get(userId);
    if (!user) return false;
    user.loginAttempts++;
    if (user.loginAttempts >= config.security.maxLoginAttempts) {
      this.lockAccount(userId, config.security.lockoutDuration * 1000);
      return { locked: true, duration: config.security.lockoutDuration };
    }
    return { locked: false, attempts: user.loginAttempts };
  }

  resetLoginAttempts(userId) {
    const user = this.users.get(userId);
    if (!user) return false;
    user.loginAttempts = 0;
    return true;
  }

  setRole(userId, role) {
    const roleDef = ROLES[role];
    if (!roleDef) return false;
    const user = this.users.get(userId);
    if (!user) {
      this.registerUser(userId, role);
      return true;
    }
    user.role = role;
    user.level = roleDef.level;
    return true;
  }

  getRoleInfo(role) {
    return ROLES[role] || null;
  }

  getAllRoles() {
    return Object.entries(ROLES).map(([key, value]) => ({ key, ...value }));
  }

  async getStatus() {
    return {
      active: true,
      totalUsers: this.users.size,
      roles: this.getAllRoles()
    };
  }
}

module.exports = { PermissionManager, ROLES, COMMAND_PERMISSIONS };
