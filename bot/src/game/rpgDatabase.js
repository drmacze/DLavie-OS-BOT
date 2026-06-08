'use strict';

const { query, isConnected } = require('../database/replitPg');
const fs   = require('fs');
const path = require('path');

const LOCAL_FILE = path.join(__dirname, '../../tmp/rpg_players.json');

function loadLocal() {
  try { if (fs.existsSync(LOCAL_FILE)) return JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8')); } catch (_) {}
  return {};
}
function saveLocal(data) {
  try {
    const d = path.dirname(LOCAL_FILE);
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(LOCAL_FILE, JSON.stringify(data, null, 2));
  } catch (_) {}
}

async function initRpgTables() {
  if (!isConnected()) return;
  const sql = fs.readFileSync(path.join(__dirname, '../../config/rpg-schema.sql'), 'utf8');
  const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await query(stmt);
  }
}

async function getPlayer(phone) {
  if (isConnected()) {
    const r = await query('SELECT * FROM dlavie_rpg_players WHERE phone_number = $1', [phone]);
    if (r.rows.length) return r.rows[0];
    return null;
  }
  const local = loadLocal();
  return local[phone] || null;
}

async function createPlayer(phone, displayName, charName, charClass, baseStats) {
  const player = {
    phone_number: phone,
    display_name: displayName,
    char_name: charName,
    char_class: charClass,
    level: 1,
    exp: 0,
    exp_to_next: 100,
    hp: baseStats.maxHp,
    max_hp: baseStats.maxHp,
    mp: baseStats.maxMp,
    max_mp: baseStats.maxMp,
    str: baseStats.str,
    int_stat: baseStats.int,
    agi: baseStats.agi,
    vit: baseStats.vit,
    luk: baseStats.luk,
    gold: 100,
    gems: 0,
    story_chapter: 0,
    story_scene: 0,
    exploration_zone: 'aethoria_forest',
    pvp_wins: 0,
    pvp_losses: 0,
    pvp_rating: 1000,
    quests_done: 0,
    monsters_killed: 0,
    inventory: [],
    equipment: { weapon: null, armor: null, accessory: null },
    skills: [],
    achievements: [],
    settings: { theme: 'classic', notifications: true },
  };
  if (isConnected()) {
    const r = await query(
      `INSERT INTO dlavie_rpg_players
        (phone_number,display_name,char_name,char_class,level,exp,exp_to_next,
         hp,max_hp,mp,max_mp,str,int_stat,agi,vit,luk,gold,gems,
         story_chapter,story_scene,exploration_zone,pvp_wins,pvp_losses,pvp_rating,
         quests_done,monsters_killed,inventory,equipment,skills,achievements,settings)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
       RETURNING *`,
      [
        phone, displayName, charName, charClass, 1, 0, 100,
        player.hp, player.max_hp, player.mp, player.max_mp,
        baseStats.str, baseStats.int, baseStats.agi, baseStats.vit, baseStats.luk,
        100, 0, 0, 0, 'aethoria_forest', 0, 0, 1000, 0, 0,
        JSON.stringify([]), JSON.stringify(player.equipment),
        JSON.stringify([]), JSON.stringify([]), JSON.stringify(player.settings),
      ]
    );
    return r.rows[0] || player;
  }
  const local = loadLocal();
  local[phone] = { ...player, id: `local_${Date.now()}`, created_at: new Date().toISOString() };
  saveLocal(local);
  return local[phone];
}

async function updatePlayer(phone, fields) {
  if (isConnected()) {
    const sets = [];
    const vals = [];
    let i = 1;
    for (const [k, v] of Object.entries(fields)) {
      sets.push(`${k} = $${i++}`);
      vals.push(typeof v === 'object' ? JSON.stringify(v) : v);
    }
    sets.push(`updated_at = NOW()`, `last_played = NOW()`);
    vals.push(phone);
    await query(`UPDATE dlavie_rpg_players SET ${sets.join(',')} WHERE phone_number = $${i}`, vals);
    return getPlayer(phone);
  }
  const local = loadLocal();
  if (local[phone]) {
    Object.assign(local[phone], fields);
    local[phone].updated_at = new Date().toISOString();
    saveLocal(local);
  }
  return local[phone] || null;
}

async function getLeaderboard(limit = 10) {
  if (isConnected()) {
    const r = await query(
      `SELECT char_name, char_class, level, pvp_rating, quests_done, monsters_killed
       FROM dlavie_rpg_players ORDER BY level DESC, exp DESC LIMIT $1`, [limit]
    );
    return r.rows;
  }
  const local = loadLocal();
  return Object.values(local)
    .sort((a, b) => (b.level - a.level) || (b.exp - a.exp))
    .slice(0, limit)
    .map(p => ({
      char_name: p.char_name, char_class: p.char_class,
      level: p.level, pvp_rating: p.pvp_rating,
      quests_done: p.quests_done, monsters_killed: p.monsters_killed,
    }));
}

module.exports = { initRpgTables, getPlayer, createPlayer, updatePlayer, getLeaderboard };
