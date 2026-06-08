'use strict';

const { CLASSES } = require('./rpgCharacter');

function loadingBar(pct) {
  const filled = Math.floor(pct / 10);
  const empty  = 10 - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${pct}%`;
}

async function sendLoading(safeSend, jid, label = 'Loading DLavie RPG') {
  const steps = [10, 30, 55, 80, 100];
  for (const pct of steps) {
    await safeSend(jid, {
      text:
        `╔══════════════════════════════╗\n` +
        `║   ⚡  *DLavie RPG*  ⚡        ║\n` +
        `║   Dunia Aethoria Menunggu   ║\n` +
        `╚══════════════════════════════╝\n\n` +
        `🔄 *${label}*\n` +
        `${loadingBar(pct)}\n\n` +
        (pct < 100 ? `_${getLoadingMsg(pct)}_` : `✅ *Siap!*`)
    });
    await sleep(pct < 100 ? 700 : 400);
  }
}

function getLoadingMsg(pct) {
  if (pct <= 10) return 'Memuat assets game...';
  if (pct <= 30) return 'Inisialisasi dunia Aethoria...';
  if (pct <= 55) return 'Menghubungkan ke server game...';
  if (pct <= 80) return 'Memuat data karakter...';
  return 'Selesai!';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function registerScreen(prefix) {
  return {
    text:
      `╔══════════════════════════════╗\n` +
      `║   ⚔️  *SELAMAT DATANG*  ⚔️   ║\n` +
      `║      DLavie RPG — Aethoria  ║\n` +
      `╚══════════════════════════════╝\n\n` +
      `👾 Kamu adalah petualang baru di dunia *Aethoria* — dunia di mana teknologi dan sihir berpadu.\n\n` +
      `🌟 *Mulai Petualangan:*\n` +
      `▸ \`${prefix}play new\` — Buat karakter baru\n` +
      `▸ \`${prefix}play login\` — Masuk ke akun yang ada\n\n` +
      `_"Dunia butuh pahlawan baru... apakah itu kamu?"_\n\n` +
      `╰─ DLavie RPG v1.0 | Dunia Aethoria`
  };
}

function classSelectionScreen(prefix) {
  const lines = Object.entries(CLASSES).map(([key, cls], i) => {
    const s = cls.stats;
    return (
      `${i + 1}. *${cls.label}*\n` +
      `   ${cls.desc}\n` +
      `   HP:${s.maxHp} MP:${s.maxMp} STR:${s.str} INT:${s.int} AGI:${s.agi} VIT:${s.vit} LUK:${s.luk}\n` +
      `   🗡️ Senjata: ${cls.startWeapon}\n` +
      `   ✨ Skill: ${cls.skills.join(', ')}`
    );
  }).join('\n\n');

  return {
    text:
      `╔══════════════════════════════╗\n` +
      `║   ⚔️  PILIH KELAS KARAKTER  ║\n` +
      `╚══════════════════════════════╝\n\n` +
      `${lines}\n\n` +
      `📝 Ketik \`${prefix}play class <angka>\`\n` +
      `Contoh: \`${prefix}play class 1\` untuk Warrior`
  };
}

function lobbyScreen(player, prefix) {
  const hpBar  = hpBarStr(player.hp, player.max_hp);
  const expBar = expBarStr(player.exp, player.exp_to_next);
  const cls    = CLASSES[player.char_class] || CLASSES.balanced;

  return {
    text:
      `╔══════════════════════════════╗\n` +
      `║   🏰  *LOBBY AETHORIA*  🏰   ║\n` +
      `╚══════════════════════════════╝\n\n` +
      `👤 *${player.char_name}* ${cls.label}\n` +
      `⭐ Lv.${player.level}  🪙 ${player.gold}G  💎 ${player.gems || 0}\n` +
      `❤️ HP: ${hpBar} ${player.hp}/${player.max_hp}\n` +
      `✨ EXP: ${expBar} ${player.exp}/${player.exp_to_next}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🎮 *PILIH MODE:*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `1️⃣  \`${prefix}play story\`    — 📖 Story Mode\n` +
      `2️⃣  \`${prefix}play explore\`  — 🗺️ Eksplorasi\n` +
      `3️⃣  \`${prefix}play classic\`  — ⚔️ Classic Hunt\n` +
      `4️⃣  \`${prefix}play pvp\`      — 🏆 PVP Battle\n` +
      `5️⃣  \`${prefix}play rank\`     — 🏅 Leaderboard\n` +
      `6️⃣  \`${prefix}play profile\`  — 👤 Profil Ku\n` +
      `7️⃣  \`${prefix}play friends\`  — 👫 Friends\n` +
      `8️⃣  \`${prefix}play settings\` — ⚙️ Settings\n\n` +
      `\`${prefix}play exit\` — 🚪 Keluar Game\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━`
  };
}

function profileScreen(player, prefix) {
  const cls = CLASSES[player.char_class] || CLASSES.balanced;
  return {
    text:
      `╔══════════════════════════════╗\n` +
      `║   👤  PROFIL KARAKTER        ║\n` +
      `╚══════════════════════════════╝\n\n` +
      `🧑 *${player.char_name}* (${cls.label})\n` +
      `📊 Level: *${player.level}*  EXP: ${player.exp}/${player.exp_to_next}\n\n` +
      `━━ 📈 STATISTIK ━━\n` +
      `❤️ HP  : ${player.hp}/${player.max_hp}\n` +
      `🔷 MP  : ${player.mp}/${player.max_mp}\n` +
      `⚔️ STR : ${player.str}\n` +
      `🔮 INT : ${player.int_stat}\n` +
      `💨 AGI : ${player.agi}\n` +
      `🛡️ VIT : ${player.vit}\n` +
      `🍀 LUK : ${player.luk}\n\n` +
      `━━ 🏆 STATISTIK GAME ━━\n` +
      `🪙 Gold    : ${player.gold}\n` +
      `💎 Gems    : ${player.gems || 0}\n` +
      `👹 Kill    : ${player.monsters_killed}\n` +
      `📜 Quest   : ${player.quests_done}\n` +
      `⚔️ PVP W/L : ${player.pvp_wins}/${player.pvp_losses}\n` +
      `📡 Rating  : ${player.pvp_rating}\n\n` +
      `\`${prefix}play lobby\` — Kembali ke Lobby`
  };
}

function rankScreen(leaderboard, prefix) {
  const medals = ['🥇', '🥈', '🥉'];
  const rows = leaderboard.map((p, i) => {
    const m   = medals[i] || `${i + 1}.`;
    const cls = CLASSES[p.char_class]?.label?.split(' ')[0] || '⚖️';
    return `${m} *${p.char_name}* ${cls} Lv.${p.level} | ⭐${p.pvp_rating} | 👹${p.monsters_killed}`;
  }).join('\n');

  return {
    text:
      `╔══════════════════════════════╗\n` +
      `║   🏅  LEADERBOARD AETHORIA  ║\n` +
      `╚══════════════════════════════╝\n\n` +
      (rows || '_(Leaderboard masih kosong)_') +
      `\n\n\`${prefix}play lobby\` — Kembali ke Lobby`
  };
}

function hpBarStr(hp, maxHp) {
  const pct = Math.max(0, Math.min(1, hp / maxHp));
  const filled = Math.floor(pct * 8);
  const c = pct > 0.5 ? '🟩' : pct > 0.25 ? '🟨' : '🟥';
  return c.repeat(filled) + '⬛'.repeat(8 - filled);
}

function expBarStr(exp, needed) {
  const pct = Math.max(0, Math.min(1, exp / needed));
  const filled = Math.floor(pct * 6);
  return '🟦'.repeat(filled) + '⬛'.repeat(6 - filled);
}

function combatHeader(player, enemy, round) {
  return (
    `╔══════════════════════════════╗\n` +
    `║   ⚔️  PERTARUNGAN  ⚔️         ║\n` +
    `╚══════════════════════════════╝\n` +
    `Ronde: ${round}\n\n` +
    `👤 *${player.char_name}* Lv.${player.level}\n` +
    `❤️ ${hpBarStr(player.hp, player.max_hp)} ${player.hp}/${player.max_hp}\n` +
    `🔷 MP: ${player.mp}/${player.max_mp}\n\n` +
    `👹 *${enemy.name}* Lv.${enemy.level}\n` +
    `❤️ ${hpBarStr(enemy.hp, enemy.maxHp)} ${enemy.hp}/${enemy.maxHp}\n`
  );
}

function friendsScreen(prefix) {
  return {
    text:
      `╔══════════════════════════════╗\n` +
      `║   👫  FRIENDS — Aethoria     ║\n` +
      `╚══════════════════════════════╝\n\n` +
      `🔗 Ajak teman bergabung ke DLavie RPG!\n\n` +
      `📨 *Cara Invite:*\n` +
      `▸ Bagikan perintah \`${prefix}play\` ke temanmu\n` +
      `▸ Mereka daftar dan otomatis bergabung di Aethoria\n\n` +
      `⚔️ *PVP Teman:*\n` +
      `▸ \`${prefix}play pvp\` — Challenge sembarang lawan\n\n` +
      `🏆 *Rank Bersama:*\n` +
      `▸ \`${prefix}play rank\` — Lihat posisi temanmu\n\n` +
      `\`${prefix}play lobby\` — Kembali ke Lobby`
  };
}

function settingsScreen(player, prefix) {
  return {
    text:
      `╔══════════════════════════════╗\n` +
      `║   ⚙️  GAME SETTINGS          ║\n` +
      `╚══════════════════════════════╝\n\n` +
      `👤 Karakter: *${player.char_name}*\n` +
      `🎨 Theme: *${player.settings?.theme || 'classic'}*\n` +
      `🔔 Notifikasi: *${player.settings?.notifications ? 'ON' : 'OFF'}*\n\n` +
      `━━ OPSI ━━\n` +
      `▸ \`${prefix}play settings theme classic\` — Theme Classic\n` +
      `▸ \`${prefix}play settings theme neon\` — Theme Neon\n` +
      `▸ \`${prefix}play settings notif on/off\` — Notifikasi\n\n` +
      `⚠️ *BERBAHAYA:*\n` +
      `▸ \`${prefix}play settings reset\` — Reset karakter (tidak bisa dibatalkan)\n\n` +
      `\`${prefix}play lobby\` — Kembali ke Lobby`
  };
}

module.exports = {
  sendLoading, registerScreen, classSelectionScreen, lobbyScreen,
  profileScreen, rankScreen, combatHeader, hpBarStr, expBarStr,
  friendsScreen, settingsScreen, sleep,
};
