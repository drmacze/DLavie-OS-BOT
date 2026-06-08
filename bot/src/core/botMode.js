'use strict';

const fs   = require('fs');
const path = require('path');

const MODE_FILE = path.join(__dirname, '../../tmp/bot_mode.json');
const VALID_MODES = ['multibot', 'game'];

const DEFAULT_STATE = {
  mode: 'multibot',
  updatedAt: null,
  updatedBy: null,
};

function loadState() {
  try {
    if (fs.existsSync(MODE_FILE)) return { ...DEFAULT_STATE, ...JSON.parse(fs.readFileSync(MODE_FILE, 'utf8')) };
  } catch (_) {}
  return { ...DEFAULT_STATE };
}

function saveState(state) {
  try {
    const dir = path.dirname(MODE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MODE_FILE, JSON.stringify(state, null, 2));
  } catch (_) {}
}

let _state = null;

function getState() {
  if (!_state) _state = loadState();
  return _state;
}

function getBotMode() {
  return getState().mode || 'multibot';
}

function setBotMode(mode, byEmail = null) {
  if (!VALID_MODES.includes(mode)) throw new Error(`Mode tidak valid. Pilih: ${VALID_MODES.join(', ')}`);
  _state = { mode, updatedAt: new Date().toISOString(), updatedBy: byEmail };
  saveState(_state);
  return _state;
}

function isGameMode()     { return getBotMode() === 'game'; }
function isMultiBotMode() { return getBotMode() === 'multibot'; }

const DEV_EMAIL = 'dev@dlavie.com';
function canChangeBotMode(email) {
  return String(email || '').toLowerCase().trim() === DEV_EMAIL;
}

module.exports = { getBotMode, setBotMode, isGameMode, isMultiBotMode, canChangeBotMode, VALID_MODES, DEV_EMAIL };
