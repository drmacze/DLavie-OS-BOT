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
 *
 * Safety rules (never allow a bad entry to overwrite a good one):
 *   1. Skip if lid === phone (mapping a value to itself adds no info).
 *   2. Skip if the key already has a DIFFERENT resolved phone stored
 *      (i.e., don't overwrite "lid→realPhone" with "lid→lid").
 */
function setLid(map, lid, phone) {
  if (!lid || !phone) return false;
  if (lid === phone) return false;                 // self-mapping, skip
  if (map.get(lid) === phone) return false;        // already correct, skip

  const existing = map.get(lid);
  if (existing && existing !== lid && existing !== phone) {
    // Already mapped to a different real phone — do not overwrite
    log.debug(`LID store: skip overwrite "${lid}" (existing="${existing}", new="${phone}")`);
    return false;
  }

  map.set(lid, phone);
  saveLidMap(map);
  log.info(`LID store updated: "${lid}" → "${phone}"`);
  return true;
}

module.exports = { loadLidMap, saveLidMap, setLid };
