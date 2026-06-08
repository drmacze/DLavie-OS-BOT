'use strict';

const CLASSES = {
  warrior: {
    label: '🗡️ Warrior',
    desc: 'Pejuang tangguh. HP tinggi, serangan fisik kuat.',
    stats: { maxHp: 150, maxMp: 30, str: 16, int: 6, agi: 9, vit: 14, luk: 7 },
    skills: ['Slash', 'Shield Bash', 'Battle Cry'],
    startWeapon: 'Rusty Sword',
  },
  mage: {
    label: '🔮 Mage',
    desc: 'Ilmuwan sihir. MP besar, sihir mematikan.',
    stats: { maxHp: 80, maxMp: 120, str: 5, int: 18, agi: 10, vit: 6, luk: 9 },
    skills: ['Fireball', 'Ice Lance', 'Mana Shield'],
    startWeapon: 'Apprentice Staff',
  },
  rogue: {
    label: '🎯 Rogue',
    desc: 'Pencuri bayangan. Cepat, kritis tinggi, pengelak ulung.',
    stats: { maxHp: 100, maxMp: 50, str: 12, int: 8, agi: 18, vit: 8, luk: 14 },
    skills: ['Backstab', 'Evasion', 'Poison Blade'],
    startWeapon: 'Jagged Dagger',
  },
  paladin: {
    label: '🛡️ Paladin',
    desc: 'Ksatria suci. Pertahanan sangat tinggi, heal diri sendiri.',
    stats: { maxHp: 130, maxMp: 70, str: 13, int: 10, agi: 7, vit: 17, luk: 8 },
    skills: ['Holy Strike', 'Divine Shield', 'Heal'],
    startWeapon: 'Holy Mace',
  },
  balanced: {
    label: '⚖️ Balanced',
    desc: 'Semua stat seimbang. Ideal untuk pemula.',
    stats: { maxHp: 110, maxMp: 70, str: 11, int: 11, agi: 11, vit: 11, luk: 11 },
    skills: ['Strike', 'Focus', 'Resilience'],
    startWeapon: 'Iron Sword',
  },
};

const SKILLS_DB = {
  Slash:        { cost: 5, dmgMult: 1.5, type: 'physical', desc: 'Tebasan dasar, damage fisik 1.5x' },
  'Shield Bash':{ cost: 8, dmgMult: 1.2, type: 'physical', stun: true, desc: 'Memukul dengan tameng, ada peluang stun' },
  'Battle Cry': { cost: 10, buff: { str: 3 }, duration: 3, desc: 'Tingkatkan STR +3 selama 3 ronde' },
  Fireball:     { cost: 15, dmgMult: 2.2, type: 'magic', desc: 'Bola api dahsyat, damage sihir 2.2x' },
  'Ice Lance':  { cost: 12, dmgMult: 1.8, type: 'magic', slow: true, desc: 'Tombak es, ada peluang slow' },
  'Mana Shield':{ cost: 20, shield: 30, desc: 'Lindungi diri dengan barrier mana (+30 shield)' },
  Backstab:     { cost: 8, dmgMult: 2.5, type: 'physical', crit: true, desc: 'Serangan dari belakang, kritis tinggi' },
  Evasion:      { cost: 12, evade: 2, desc: 'Meningkatkan peluang menghindar selama 2 ronde' },
  'Poison Blade':{ cost: 10, poison: 3, dmgMult: 1.2, desc: 'Racun berlangsung 3 ronde' },
  'Holy Strike': { cost: 10, dmgMult: 1.8, type: 'holy', desc: 'Serangan cahaya suci, 1.8x damage' },
  'Divine Shield':{ cost: 20, shield: 50, desc: 'Pelindung ilahi (+50 shield)' },
  Heal:         { cost: 18, heal: 40, desc: 'Pulihkan 40 HP diri sendiri' },
  Strike:       { cost: 5, dmgMult: 1.3, type: 'physical', desc: 'Serangan standar 1.3x' },
  Focus:        { cost: 10, buff: { int: 2, str: 2 }, duration: 2, desc: 'Fokus: +2 STR & INT selama 2 ronde' },
  Resilience:   { cost: 12, shield: 20, heal: 10, desc: 'Bertahan (+20 shield, pulih 10 HP)' },
};

const LEVELS = Array.from({ length: 50 }, (_, i) => ({
  level: i + 1,
  expRequired: Math.floor(100 * Math.pow(1.35, i)),
  hpGain: Math.floor(8 + i * 2),
  mpGain: Math.floor(5 + i),
  statGain: i % 3 === 0 ? 2 : 1,
}));

function getClassInfo(cls) { return CLASSES[cls] || CLASSES.balanced; }
function getAllClasses()    { return CLASSES; }
function getSkill(name)    { return SKILLS_DB[name] || null; }

function calcLevelUp(player) {
  let p = { ...player };
  const updates = [];
  let changed = false;
  while (p.exp >= p.exp_to_next && p.level < 50) {
    const lvlData = LEVELS[p.level] || LEVELS[LEVELS.length - 1];
    p.level++;
    p.exp -= p.exp_to_next;
    p.exp_to_next = Math.floor(100 * Math.pow(1.35, p.level - 1));
    p.max_hp += lvlData.hpGain;
    p.hp = p.max_hp;
    p.max_mp += lvlData.mpGain;
    p.mp = p.max_mp;
    p.str += lvlData.statGain;
    p.int_stat += lvlData.statGain;
    p.agi += lvlData.statGain;
    p.vit += lvlData.statGain;
    updates.push(`✨ Level UP! → Lv.${p.level} | HP+${lvlData.hpGain} MP+${lvlData.mpGain} Stats+${lvlData.statGain}`);
    changed = true;
  }
  return { player: p, updates, changed };
}

function physicalDamage(attacker, skillMult = 1) {
  const base = attacker.str * 2 + Math.floor(Math.random() * attacker.str);
  return Math.floor(base * skillMult);
}

function magicDamage(attacker, skillMult = 1) {
  const base = (attacker.int_stat || attacker.int_stat) * 2 + Math.floor(Math.random() * (attacker.int_stat || 1));
  return Math.floor(base * skillMult);
}

function critChance(agi, luk) {
  return Math.min(0.5, 0.05 + (agi + luk) * 0.005);
}

module.exports = { CLASSES, SKILLS_DB, getClassInfo, getAllClasses, getSkill, calcLevelUp, physicalDamage, magicDamage, critChance };
