'use strict';

const fs = require('fs');
const path = require('path');

const CONNECTIONS_FILE = path.join(__dirname, '..', '..', 'tmp', 'bot_connections.json');

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function loadConnections() {
  try {
    if (fs.existsSync(CONNECTIONS_FILE)) {
      return JSON.parse(fs.readFileSync(CONNECTIONS_FILE, 'utf8'));
    }
  } catch (_) {}
  return {};
}

function getSockNumber(sock) {
  return digitsOnly(
    sock?.user?.id ||
    sock?.user?.jid ||
    sock?.user?.lid ||
    ''
  );
}

function getConfigBotNumber(config = {}) {
  return digitsOnly(
    config.botNumber ||
    config.bot?.number ||
    process.env.BOT_NUMBER ||
    ''
  );
}

function findActiveBot(sock, config = {}) {
  const connections = loadConnections();
  const bots = Object.values(connections).filter((item) => item && item.botId);
  if (!bots.length) return null;

  const sockNumber = getSockNumber(sock);
  const configNumber = getConfigBotNumber(config);
  const candidates = [sockNumber, configNumber].filter(Boolean);

  for (const candidate of candidates) {
    const found = bots.find((bot) => {
      const botNumber = digitsOnly(bot.botNumber || bot.number || bot.jid || '');
      return botNumber && (botNumber === candidate || botNumber.endsWith(candidate) || candidate.endsWith(botNumber));
    });
    if (found) return found;
  }

  const activeBots = bots.filter((bot) => bot.status === 'active');
  if (activeBots.length === 1) return activeBots[0];
  if (bots.length === 1) return bots[0];

  return null;
}

function defaultSettings(config = {}) {
  return {
    name: config.botName || config.bot?.name || 'DLavie OS',
    prefix: config.botPrefix || config.bot?.prefix || '!',
    bio: config.bot?.bio || 'WhatsApp Multi-Bot Control',
    language: config.bot?.language || 'id',
    timezone: config.bot?.timezone || 'Asia/Jakarta',
    menuTitle: config.bot?.menuTitle || '',
    menuFooter: config.bot?.menuFooter || '',
    welcomeMsg: config.bot?.welcomeMsg || '',
    antiSpam: config.bot?.antiSpam || false,
  };
}

function getBotCustomization(sock, config = {}) {
  const fallback = defaultSettings(config);
  const bot = findActiveBot(sock, config);
  const settings = bot?.settings || {};

  const merged = {
    ...fallback,
    ...Object.fromEntries(Object.entries(settings).filter(([, value]) => value !== undefined && value !== null && value !== '')),
  };

  return {
    botId: bot?.botId || null,
    botNumber: bot?.botNumber || getConfigBotNumber(config) || getSockNumber(sock) || '',
    settings: merged,
    raw: bot || null,
    found: Boolean(bot),
  };
}

function getBotSettings(sock, config = {}) {
  return getBotCustomization(sock, config).settings;
}

function getBotName(sock, config = {}) {
  return getBotSettings(sock, config).name || 'DLavie OS';
}

function getBotPrefix(sock, config = {}) {
  return getBotSettings(sock, config).prefix || '!';
}

function renderMenuHeader(sock, config = {}, fallbackTitle = 'DLavie OS') {
  const { settings } = getBotCustomization(sock, config);
  const title = settings.menuTitle || settings.name || fallbackTitle;
  const subtitle = settings.bio || 'WhatsApp Multi-Bot Control';

  return `╔══════════════════════════════╗\n` +
    `║   ⚡  *${title}*  ⚡\n` +
    `║  ${subtitle}\n` +
    `╚══════════════════════════════╝`;
}

function renderMenuFooter(sock, config = {}) {
  const { settings } = getBotCustomization(sock, config);
  const footer = settings.menuFooter || `DLavie OS v${config.bot?.version || '2.0.0'} • Anti-Ban Active`;
  return footer;
}

module.exports = {
  digitsOnly,
  loadConnections,
  findActiveBot,
  getBotCustomization,
  getBotSettings,
  getBotName,
  getBotPrefix,
  renderMenuHeader,
  renderMenuFooter,
};
