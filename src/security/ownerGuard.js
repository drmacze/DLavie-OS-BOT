'use strict';

const DEFAULT_OWNER_NUMBER = '62882007437216';

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function senderNumber(msg) {
  return digitsOnly(
    msg?.key?.participant ||
    msg?.participant ||
    msg?.key?.remoteJid ||
    msg?.remoteJid ||
    ''
  );
}

function readDlavieConfigOwner() {
  try {
    const cfg = require('../../DLavieConfig');
    return cfg?.bot?.ownerNumber || cfg?.ownerNumber || '';
  } catch (_) {
    return '';
  }
}

function ownerCandidates(config = {}) {
  const candidates = [
    process.env.OWNER_NUMBER,
    process.env.BOT_OWNER,
    process.env.DLAVIE_OWNER_NUMBER,
    config.ownerNumber,
    config.owner?.number,
    config.owner?.phone,
    config.bot?.ownerNumber,
    config.bot?.owner,
    config.security?.ownerNumber,
    readDlavieConfigOwner(),
    DEFAULT_OWNER_NUMBER,
  ];

  return Array.from(new Set(
    candidates
      .map(digitsOnly)
      .filter(Boolean)
  ));
}

function isOwner(msg, config = {}) {
  if (msg?.key?.fromMe) return true;

  const sender = senderNumber(msg);
  if (!sender) return false;

  return ownerCandidates(config).some((owner) => {
    return sender === owner || sender.endsWith(owner) || owner.endsWith(sender);
  });
}

module.exports = {
  DEFAULT_OWNER_NUMBER,
  digitsOnly,
  senderNumber,
  ownerCandidates,
  isOwner,
};
