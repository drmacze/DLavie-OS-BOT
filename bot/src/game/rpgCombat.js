'use strict';

const { getSkill, physicalDamage, magicDamage, critChance, SKILLS_DB } = require('./rpgCharacter');
const { hpBarStr, combatHeader, sleep } = require('./rpgUI');

const ENEMIES = {
  slime: { name: '🟢 Slime', level: 1, hp: 40, maxHp: 40, str: 5, agi: 3, int: 2, reward: { exp: 15, gold: 8 } },
  goblin: { name: '👺 Goblin', level: 3, hp: 80, maxHp: 80, str: 9, agi: 7, int: 3, reward: { exp: 35, gold: 20 } },
  wolf: { name: '🐺 Shadow Wolf', level: 5, hp: 120, maxHp: 120, str: 14, agi: 12, int: 5, reward: { exp: 60, gold: 35 } },
  orc: { name: '👹 Orc Warrior', level: 8, hp: 200, maxHp: 200, str: 20, agi: 8, int: 4, reward: { exp: 100, gold: 60 } },
  dark_elf: { name: '🧝 Dark Elf Assassin', level: 12, hp: 160, maxHp: 160, str: 18, agi: 20, int: 12, reward: { exp: 150, gold: 90 } },
  golem: { name: '🪨 Iron Golem', level: 15, hp: 350, maxHp: 350, str: 25, agi: 3, int: 5, reward: { exp: 200, gold: 120 } },
  dragon: { name: '🐉 Young Dragon', level: 20, hp: 500, maxHp: 500, str: 32, agi: 15, int: 20, reward: { exp: 350, gold: 250 } },
  boss_guardian: { name: '👾 Data Guardian', level: 25, hp: 800, maxHp: 800, str: 40, agi: 25, int: 35, reward: { exp: 600, gold: 400 } },
};

function getEnemyForLevel(playerLevel) {
  const pool = Object.values(ENEMIES).filter(e => Math.abs(e.level - playerLevel) <= 5);
  return { ...((pool[Math.floor(Math.random() * pool.length)] || ENEMIES.slime)) };
}

function getEnemyByKey(key) { return { ...(ENEMIES[key] || ENEMIES.slime) }; }

function calcPlayerDmg(player, skill = null) {
  if (!skill) {
    const base = physicalDamage(player, 1);
    const isCrit = Math.random() < critChance(player.agi, player.luk);
    return { damage: isCrit ? Math.floor(base * 1.8) : base, crit: isCrit, type: 'physical' };
  }
  const skillData = getSkill(skill) || SKILLS_DB[skill];
  if (!skillData) return calcPlayerDmg(player, null);
  const mult = skillData.dmgMult || 1;
  const isPhys = skillData.type === 'physical';
  const raw = isPhys ? physicalDamage(player, mult) : magicDamage(player, mult);
  const isCrit = skillData.crit ? Math.random() < 0.7 : Math.random() < critChance(player.agi, player.luk);
  return { damage: isCrit ? Math.floor(raw * 1.5) : raw, crit: isCrit, type: skillData.type || 'physical', skillData };
}

function calcEnemyDmg(enemy, player) {
  const base = enemy.str * 1.5 + Math.floor(Math.random() * enemy.str);
  const defense = player.vit * 0.5;
  const raw = Math.max(1, Math.floor(base - defense));
  const isCrit = Math.random() < 0.08;
  return { damage: isCrit ? Math.floor(raw * 1.5) : raw, crit: isCrit };
}

async function runCombatRound(safeSend, jid, prefix, player, enemy, skillName, roundNum) {
  const log = [];
  let p = { ...player };
  let e = { ...enemy };

  const atk = calcPlayerDmg(p, skillName);
  let mpCost = 0;
  if (skillName) {
    const sk = getSkill(skillName);
    if (sk?.cost) {
      mpCost = sk.cost;
      if (p.mp < mpCost) {
        return { player: p, enemy: e, log: [`❌ MP tidak cukup! Serang biasa saja.`], ended: false, victory: false };
      }
      p.mp -= mpCost;
    }
    if (sk?.heal) {
      p.hp = Math.min(p.max_hp, p.hp + sk.heal);
      log.push(`💚 *Heal* +${sk.heal} HP`);
    }
    if (sk?.shield) log.push(`🛡️ *Shield* +${sk.shield} absorb`);
  }

  e.hp = Math.max(0, e.hp - atk.damage);
  log.push(`⚔️ ${atk.crit ? '💥 *CRITICAL!* ' : ''}Kamu serang ${e.name}: *-${atk.damage} HP*${skillName ? ` (${skillName})` : ''}`);

  let ended = false, victory = false;
  if (e.hp <= 0) {
    log.push(`\n🎉 *${e.name} KALAH!*`);
    ended = true; victory = true;
    return { player: p, enemy: e, log, ended, victory };
  }

  const defAtk = calcEnemyDmg(e, p);
  p.hp = Math.max(0, p.hp - defAtk.damage);
  log.push(`👹 ${e.name} balik serang: *-${defAtk.damage} HP*${defAtk.crit ? ' 💥 KRITIS!' : ''}`);

  if (p.hp <= 0) {
    log.push(`\n💀 *Kamu kalah!* ${e.name} menang...`);
    ended = true; victory = false;
  }

  const header = combatHeader(p, e, roundNum);
  await safeSend(jid, { text: header + '\n' + log.join('\n') });

  if (!ended) {
    const skills = (player.skills || []).slice(0, 3);
    const skillOpts = skills.map((s, i) => `${i + 2}. \`${prefix}play skill ${s}\` — ${s} (MP:${getSkill(s)?.cost || 0})`).join('\n');
    await safeSend(jid, {
      text:
        `━━ AKSIMU ━━\n` +
        `1. \`${prefix}play attack\` — Serangan biasa\n` +
        (skillOpts ? skillOpts + '\n' : '') +
        `0. \`${prefix}play run\` — Kabur dari pertarungan`
    });
  }

  return { player: p, enemy: e, log, ended, victory };
}

module.exports = { ENEMIES, getEnemyForLevel, getEnemyByKey, runCombatRound, calcPlayerDmg };
