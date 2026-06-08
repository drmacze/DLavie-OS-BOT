'use strict';

const SESSION_TTL = 30 * 60 * 1000;

const sessions = new Map();

const PHASES = {
  LOADING:    'loading',
  REGISTER:   'register',
  NAME_INPUT: 'name_input',
  CLASS_SEL:  'class_sel',
  LOBBY:      'lobby',
  STORY:      'story',
  EXPLORE:    'explore',
  CLASSIC:    'classic',
  PVP:        'pvp',
  RANK:       'rank',
  PROFILE:    'profile',
  FRIENDS:    'friends',
  SETTINGS:   'settings',
  COMBAT:     'combat',
  DEAD:       'dead',
};

function getSession(userId) {
  const s = sessions.get(userId);
  if (!s) return null;
  if (Date.now() - s.lastActivity > SESSION_TTL) {
    sessions.delete(userId);
    return null;
  }
  s.lastActivity = Date.now();
  return s;
}

function createSession(userId, phase = PHASES.LOADING) {
  const s = {
    userId,
    phase,
    player: null,
    lastActivity: Date.now(),
    data: {},
  };
  sessions.set(userId, s);
  return s;
}

function setPhase(userId, phase, data = {}) {
  const s = getSession(userId) || createSession(userId, phase);
  s.phase = phase;
  s.data = { ...s.data, ...data };
  s.lastActivity = Date.now();
  sessions.set(userId, s);
  return s;
}

function endSession(userId) {
  sessions.delete(userId);
}

function hasSession(userId) {
  return Boolean(getSession(userId));
}

function updatePlayer(userId, playerData) {
  const s = getSession(userId);
  if (s) {
    s.player = playerData;
    s.lastActivity = Date.now();
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions.entries()) {
    if (now - s.lastActivity > SESSION_TTL) sessions.delete(id);
  }
}, 5 * 60 * 1000);

module.exports = { PHASES, getSession, createSession, setPhase, endSession, hasSession, updatePlayer };
