/**
 * Persistent LID ↔ phone-number store.
 * Saves to disk so mappings survive restarts and reconnects.
 */
const fs   = require('fs');
const path = require('path');
const log  = require('./logger');

const STORE_FILE = path.join('auth_info_baileys', 'lid_map.json');

/** Load all saved LID → phone mappings into a Map and return it. */
function loadLidMap() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
      const map  = new Map(Object.entries(data));
      log.info(`LID store loaded: ${map.size} mapping(s) dari disk.`);
      return map;
    }
  } catch (e) {
    log.warn('Gagal baca LID store:', e.message);
  }
  return new Map();
}

/** Persist the current Map to disk. */
function saveLidMap(map) {
  try {
    fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(Object.fromEntries(map), null, 2));
  } catch (e) {
    log.warn('Gagal simpan LID store:', e.message);
  }
}

/**
 * Add a new LID → phone entry to both the in-memory map and disk.
 * Returns true if this was a new/changed entry.
 */
function setLid(map, lid, phone) {
  if (!lid || !phone) return false;
  if (map.get(lid) === phone) return false; // already stored, skip write
  map.set(lid, phone);
  saveLidMap(map);
  log.info(`LID store updated: "${lid}" → "${phone}"`);
  return true;
}

module.exports = { loadLidMap, saveLidMap, setLid };
