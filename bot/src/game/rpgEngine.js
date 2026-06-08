'use strict';

const db      = require('./rpgDatabase');
const session = require('./rpgSessions');
const ui      = require('./rpgUI');
const char    = require('./rpgCharacter');
const combat  = require('./rpgCombat');
const modes   = require('./rpgModes');
const { PHASES } = session;

let _initialized = false;

async function ensureInit() {
  if (_initialized) return;
  try { await db.initRpgTables(); } catch (e) { console.warn('[RPG] DB init warn:', e.message); }
  _initialized = true;
}

async function handle(sock, msg, args, config, ctx = {}) {
  await ensureInit();
  const jid      = msg.key.remoteJid;
  const userId   = (msg.key.participant || msg.key.remoteJid || '').replace(/[^0-9]/g, '').replace(/:.*/, '');
  const safeSend = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));
  const prefix   = config.botPrefix || config.bot?.prefix || '!';
  const sub      = (args[0] || '').toLowerCase().trim();

  // EXIT — selalu prioritas pertama
  if (sub === 'exit' || sub === 'keluar') {
    session.endSession(userId);
    await safeSend(jid, { text: `👋 Kamu keluar dari DLavie RPG.\n\nKetik \`${prefix}play\` kapan saja untuk kembali!` });
    return;
  }

  // Load data player & session
  let player = await db.getPlayer(userId);
  let sess   = session.getSession(userId);

  // ─── NEW — buat karakter (terlepas dari state session) ───────────────────
  if (sub === 'new' || sub === 'baru') {
    if (player) {
      await safeSend(jid, {
        text:
          `⚠️ Kamu sudah punya karakter!\n\n` +
          `👤 *${player.char_name}* Lv.${player.level}\n\n` +
          `Ketik \`${prefix}play lobby\` untuk masuk ke game.`
      });
      return;
    }
    session.endSession(userId); // clear stale session if any
    session.createSession(userId, PHASES.NAME_INPUT);
    await safeSend(jid, {
      text:
        `╔══════════════════════════════╗\n` +
        `║   ✏️  BUAT KARAKTER BARU     ║\n` +
        `╚══════════════════════════════╝\n\n` +
        `Apa nama karakter petualangmu?\n\n` +
        `Ketik \`${prefix}play <nama>\` untuk melanjutkan.\n` +
        `Contoh: \`${prefix}play Arjuna\`\n\n` +
        `_Nama max 20 karakter, hanya huruf & angka_`
    });
    return;
  }

  // ─── LOGIN — langsung masuk lobby ─────────────────────────────────────────
  if (sub === 'login') {
    if (!player) {
      session.endSession(userId);
      await safeSend(jid, ui.registerScreen(prefix));
      return;
    }
    session.setPhase(userId, PHASES.LOBBY);
    await ui.sendLoading(safeSend, jid, 'Memuat Karakter');
    await safeSend(jid, ui.lobbyScreen(player, prefix));
    return;
  }

  // ─── Kunjungan pertama: belum ada player & session ────────────────────────
  if (!player && !sess) {
    await ui.sendLoading(safeSend, jid);
    await safeSend(jid, ui.registerScreen(prefix));
    session.createSession(userId, PHASES.REGISTER);
    return;
  }

  // ─── NAME INPUT STATE ─────────────────────────────────────────────────────
  sess = session.getSession(userId);
  if (sess?.phase === PHASES.NAME_INPUT) {
    const rawName = args.join(' ').trim();
    if (!rawName || rawName.length < 2 || rawName.length > 20 || !/^[a-zA-Z0-9 ]+$/.test(rawName)) {
      await safeSend(jid, { text: `❌ Nama tidak valid.\n\n• Min 2 karakter, max 20\n• Hanya huruf & angka\n\nCoba lagi: \`${prefix}play <nama>\`` });
      return;
    }
    session.setPhase(userId, PHASES.CLASS_SEL, { pendingName: rawName });
    await safeSend(jid, ui.classSelectionScreen(prefix));
    return;
  }

  // ─── CLASS SELECTION STATE ────────────────────────────────────────────────
  if (sess?.phase === PHASES.CLASS_SEL && sub === 'class') {
    const clsKeys   = Object.keys(char.CLASSES);
    const clsIdx    = parseInt(args[1] || '0', 10) - 1;
    const chosenKey = clsKeys[clsIdx];
    if (!chosenKey) {
      await safeSend(jid, { text: `❌ Pilihan tidak valid. Ketik \`${prefix}play class 1\` hingga \`${prefix}play class ${clsKeys.length}\`` });
      return;
    }
    const clsData   = char.getClassInfo(chosenKey);
    const charName  = sess.data?.pendingName || 'Petualang';
    const displayNm = msg.pushName || userId;

    await safeSend(jid, { text: `✨ Membuat karakter...\n\n_${charName} sang ${clsData.label} sedang lahir di dunia Aethoria..._` });
    await ui.sleep(800);

    player = await db.createPlayer(userId, displayNm, charName, chosenKey, clsData.stats);
    session.setPhase(userId, PHASES.LOBBY, { player });
    session.updatePlayer(userId, player);

    await safeSend(jid, {
      text:
        `╔══════════════════════════════╗\n` +
        `║   🎉  KARAKTER DIBUAT!       ║\n` +
        `╚══════════════════════════════╝\n\n` +
        `⚔️ *${charName}* (${clsData.label})\n\n` +
        `📊 Stats Awal:\n` +
        `❤️ HP: ${clsData.stats.maxHp}  🔷 MP: ${clsData.stats.maxMp}\n` +
        `⚔️ STR:${clsData.stats.str}  🔮 INT:${clsData.stats.int}  💨 AGI:${clsData.stats.agi}\n` +
        `🛡️ VIT:${clsData.stats.vit}  🍀 LUK:${clsData.stats.luk}\n\n` +
        `🗡️ Senjata: ${clsData.startWeapon}\n` +
        `✨ Skills: ${clsData.skills.join(', ')}\n` +
        `🪙 Gold: 100\n\n` +
        `_Petualanganmu dimulai!_`
    });
    await ui.sleep(600);
    player.skills = clsData.skills;
    await db.updatePlayer(userId, { skills: clsData.skills });
    await safeSend(jid, ui.lobbyScreen(player, prefix));
    return;
  }

  // ─── EXISTING PLAYER FLOW ─────────────────────────────────────────────────
  if (!player) {
    session.endSession(userId);
    await safeSend(jid, ui.registerScreen(prefix));
    return;
  }
  session.setPhase(userId, sess?.phase || PHASES.LOBBY);
  session.updatePlayer(userId, player);

  // ─── LOBBY ────────────────────────────────────────────────────────────────
  if (!sub || sub === 'lobby' || sub === 'login') {
    session.setPhase(userId, PHASES.LOBBY);
    if (!sub) await ui.sendLoading(safeSend, jid, 'Memuat Lobby');
    await safeSend(jid, ui.lobbyScreen(player, prefix));
    return;
  }

  // ─── PROFILE ──────────────────────────────────────────────────────────────
  if (sub === 'profile' || sub === 'profil') {
    await safeSend(jid, ui.profileScreen(player, prefix));
    return;
  }

  // ─── RANK ─────────────────────────────────────────────────────────────────
  if (sub === 'rank' || sub === 'ranking' || sub === 'leaderboard') {
    const board = await db.getLeaderboard(10);
    await safeSend(jid, ui.rankScreen(board, prefix));
    return;
  }

  // ─── FRIENDS ──────────────────────────────────────────────────────────────
  if (sub === 'friends' || sub === 'teman') {
    await safeSend(jid, ui.friendsScreen(prefix));
    return;
  }

  // ─── SETTINGS ─────────────────────────────────────────────────────────────
  if (sub === 'settings' || sub === 'setting') {
    const field = args[1];
    const val   = args[2];
    if (field === 'reset') {
      if (args[2] !== 'confirm') {
        await safeSend(jid, { text: `⚠️ Ini akan *menghapus karakter* kamu!\n\nKetik \`${prefix}play settings reset confirm\` untuk konfirmasi.` });
        return;
      }
      await db.updatePlayer(userId, { level: 1, exp: 0, hp: player.max_hp, mp: player.max_mp, gold: 100 });
      session.endSession(userId);
      await safeSend(jid, { text: `✅ Karakter direset. Ketik \`${prefix}play\` untuk mulai lagi.` });
      return;
    }
    if (field === 'theme' && val) {
      const newSettings = { ...(player.settings || {}), theme: val };
      await db.updatePlayer(userId, { settings: newSettings });
      player.settings = newSettings;
      await safeSend(jid, { text: `✅ Theme game → *${val}*` });
      return;
    }
    if (field === 'notif' && val) {
      const notif = val === 'on';
      const newSettings = { ...(player.settings || {}), notifications: notif };
      await db.updatePlayer(userId, { settings: newSettings });
      player.settings = newSettings;
      await safeSend(jid, { text: `✅ Notifikasi → *${notif ? 'ON' : 'OFF'}*` });
      return;
    }
    await safeSend(jid, ui.settingsScreen(player, prefix));
    return;
  }

  // ─── STORY MODE ───────────────────────────────────────────────────────────
  if (sub === 'story') {
    const chap = modes.getChapter(player.story_chapter);
    if (!chap) {
      await safeSend(jid, {
        text: `🎉 *Selamat!* Kamu telah menyelesaikan semua chapter Story Mode!\n\n_More chapters coming soon..._\n\n\`${prefix}play lobby\` — Kembali`
      });
      return;
    }
    const scene = modes.getScene(player.story_chapter, player.story_scene);
    if (!scene) {
      await safeSend(jid, modes.renderStoryScene(chap, chap.scenes[0], prefix));
      await db.updatePlayer(userId, { story_scene: 0 });
      return;
    }
    session.setPhase(userId, PHASES.STORY);
    await safeSend(jid, modes.renderStoryScene(chap, scene, prefix));
    return;
  }

  // ─── STORY CHOICE ─────────────────────────────────────────────────────────
  if (sess?.phase === PHASES.STORY && !isNaN(parseInt(sub, 10))) {
    const choiceIdx = parseInt(sub, 10) - 1;
    const chap      = modes.getChapter(player.story_chapter);
    const scene     = modes.getScene(player.story_chapter, player.story_scene);
    if (!chap || !scene) { await safeSend(jid, ui.lobbyScreen(player, prefix)); return; }

    const choice = scene.choices?.[choiceIdx];
    if (!choice) {
      await safeSend(jid, { text: `❌ Pilihan tidak valid. Masukkan angka 1-${scene.choices.length}` });
      return;
    }

    if (choice.combat) {
      const enemy = combat.getEnemyByKey(choice.combat);
      session.setPhase(userId, PHASES.COMBAT, { enemy, returnPhase: PHASES.STORY, storyScene: scene.id });
      await startCombat(safeSend, jid, prefix, player, enemy);
      return;
    }
    if (choice.cost?.gold) {
      if (player.gold < choice.cost.gold) {
        await safeSend(jid, { text: `❌ Gold tidak cukup! Kamu punya ${player.gold} Gold, perlu ${choice.cost.gold} Gold.` });
        return;
      }
      player.gold -= choice.cost.gold;
      await db.updatePlayer(userId, { gold: player.gold });
    }
    if (choice.bonusExp) {
      player.exp += choice.bonusExp;
      const lvl = char.calcLevelUp(player);
      if (lvl.changed) { player = lvl.player; await db.updatePlayer(userId, { level: player.level, exp: player.exp, exp_to_next: player.exp_to_next }); }
      await safeSend(jid, { text: `✨ Bonus: +${choice.bonusExp} EXP!` });
    }
    if (choice.mpHeal) {
      player.mp = Math.min(player.max_mp, player.mp + choice.mpHeal);
      await db.updatePlayer(userId, { mp: player.mp });
    }

    const nextScene = modes.getScene(player.story_chapter, choice.next);
    if (nextScene) {
      await db.updatePlayer(userId, { story_scene: choice.next });
      player.story_scene = choice.next;
      session.updatePlayer(userId, player);
      await safeSend(jid, modes.renderStoryScene(chap, nextScene, prefix));
    } else {
      // Chapter complete
      const reward = chap.endReward;
      player.exp += reward.exp;
      player.gold += reward.gold;
      const lvl = char.calcLevelUp(player);
      if (lvl.changed) player = lvl.player;
      const nextChapter = player.story_chapter + 1;
      await db.updatePlayer(userId, { story_chapter: nextChapter, story_scene: 0, exp: player.exp, gold: player.gold, level: player.level, exp_to_next: player.exp_to_next });
      await safeSend(jid, {
        text:
          `🎉 *BAB ${chap.num} SELESAI!*\n\n` +
          `Reward:\n✨ +${reward.exp} EXP\n🪙 +${reward.gold} Gold\n${reward.item || ''}\n\n` +
          `_"${chap.title}" telah kamu taklukkan!_\n\n` +
          `\`${prefix}play story\` — Lanjut ke Bab berikutnya\n\`${prefix}play lobby\` — Kembali`
      });
    }
    return;
  }

  // ─── EXPLORATION ──────────────────────────────────────────────────────────
  if (sub === 'explore' || sub === 'eksplorasi') {
    const zoneKey = args[1] || player.exploration_zone || 'aethoria_forest';
    if (!args[1]) {
      await safeSend(jid, modes.exploreZonesMenu(prefix));
      return;
    }
    const zone = modes.getZone(zoneKey);
    if (player.level < zone.levelMin) {
      await safeSend(jid, { text: `❌ Level terlalu rendah! Zona ini butuh Lv.${zone.levelMin}+` });
      return;
    }
    await db.updatePlayer(userId, { exploration_zone: zoneKey });
    session.setPhase(userId, PHASES.EXPLORE, { zone: zoneKey });
    const evType = modes.pickExploreEvent();
    if (evType === 'enemy') {
      const enemyKey = zone.enemies[Math.floor(Math.random() * zone.enemies.length)];
      const enemy    = combat.getEnemyByKey(enemyKey);
      await safeSend(jid, {
        text:
          `🗺️ *Eksplorasi ${zone.name}*\n\n` +
          `Kamu melangkah ke dalam ${zone.name}...\n\n` +
          `⚠️ *${enemy.name} muncul!*\n\n` +
          `\`${prefix}play attack\` — Serang\n\`${prefix}play run\` — Kabur`
      });
      session.setPhase(userId, PHASES.COMBAT, { enemy, returnPhase: PHASES.EXPLORE, zone: zoneKey });
      await startCombat(safeSend, jid, prefix, player, enemy);
      return;
    }
    const ev = modes.renderExploreEvent(evType, zone, player, null, prefix);
    if (ev.gold) {
      player.gold += ev.gold;
      await db.updatePlayer(userId, { gold: player.gold });
    }
    if (ev.hpGain) {
      player.hp = Math.min(player.max_hp, player.hp + ev.hpGain);
      player.mp = Math.min(player.max_mp, player.mp + (ev.mpGain || 0));
      await db.updatePlayer(userId, { hp: player.hp, mp: player.mp });
    }
    if (ev.item) {
      const inv = Array.isArray(player.inventory) ? player.inventory : [];
      inv.push(ev.item);
      await db.updatePlayer(userId, { inventory: inv });
    }
    await safeSend(jid, { text: ev.msg });
    return;
  }

  // ─── BUY ──────────────────────────────────────────────────────────────────
  if (sub === 'buy') {
    const item = args[1];
    if (item === 'hp') {
      if (player.gold < 30) { await safeSend(jid, { text: `❌ Gold kurang! Butuh 30 Gold.` }); return; }
      player.gold -= 30;
      player.hp = Math.min(player.max_hp, player.hp + 50);
      await db.updatePlayer(userId, { gold: player.gold, hp: player.hp });
      await safeSend(jid, { text: `✅ Health Potion dibeli! ❤️ +50 HP\n🪙 Sisa Gold: ${player.gold}` });
    } else if (item === 'mp') {
      if (player.gold < 40) { await safeSend(jid, { text: `❌ Gold kurang! Butuh 40 Gold.` }); return; }
      player.gold -= 40;
      player.mp = Math.min(player.max_mp, player.mp + 40);
      await db.updatePlayer(userId, { gold: player.gold, mp: player.mp });
      await safeSend(jid, { text: `✅ Mana Crystal dibeli! 🔷 +40 MP\n🪙 Sisa Gold: ${player.gold}` });
    } else {
      await safeSend(jid, { text: `❌ Item tidak valid. Pilih: hp, mp` });
    }
    return;
  }

  // ─── CLASSIC MODE ─────────────────────────────────────────────────────────
  if (sub === 'classic') {
    session.setPhase(userId, PHASES.CLASSIC);
    await safeSend(jid, modes.classicHuntMenu(prefix));
    return;
  }

  // ─── HUNT ─────────────────────────────────────────────────────────────────
  if (sub === 'hunt') {
    const enemyKey = args[1] || 'slime';
    const enemy    = combat.getEnemyByKey(enemyKey);
    session.setPhase(userId, PHASES.COMBAT, { enemy, returnPhase: PHASES.CLASSIC });
    await startCombat(safeSend, jid, prefix, player, enemy);
    return;
  }

  // ─── PVP ──────────────────────────────────────────────────────────────────
  if (sub === 'pvp') {
    const pvpSub = args[1];
    if (pvpSub === 'practice') {
      const lvl    = player.level;
      const aiEnemy = {
        name: `🤖 AI Fighter Lv.${lvl}`,
        level: lvl, hp: lvl * 20 + 50, maxHp: lvl * 20 + 50,
        str: lvl * 2 + 5, agi: lvl + 5, int: lvl + 3,
        reward: { exp: lvl * 10, gold: lvl * 8 },
      };
      session.setPhase(userId, PHASES.COMBAT, { enemy: aiEnemy, returnPhase: PHASES.PVP, pvp: true });
      await startCombat(safeSend, jid, prefix, player, aiEnemy);
      return;
    }
    session.setPhase(userId, PHASES.PVP);
    await safeSend(jid, modes.pvpMenu(prefix));
    return;
  }

  // ─── COMBAT ACTIONS ───────────────────────────────────────────────────────
  if (['attack', 'serang', 'skill', 'run', 'kabur'].includes(sub)) {
    const combatSess = sess?.phase === PHASES.COMBAT ? sess : session.getSession(userId);
    if (!combatSess || combatSess.phase !== PHASES.COMBAT) {
      await safeSend(jid, { text: `❌ Kamu tidak sedang dalam pertarungan.\n\`${prefix}play lobby\` — Ke Lobby` });
      return;
    }
    const enemy = combatSess.data?.enemy;
    if (!enemy) { session.setPhase(userId, PHASES.LOBBY); await safeSend(jid, ui.lobbyScreen(player, prefix)); return; }

    if (sub === 'run' || sub === 'kabur') {
      session.setPhase(userId, PHASES.LOBBY);
      await safeSend(jid, { text: `🏃 Kamu berhasil kabur dari pertarungan!\n\n\`${prefix}play lobby\` — Kembali ke Lobby` });
      return;
    }

    const skillName = sub === 'skill' ? args[1] : null;
    const round     = (combatSess.data?.round || 0) + 1;
    session.setPhase(userId, PHASES.COMBAT, { ...combatSess.data, round });

    const result = await runCombatRound(safeSend, jid, prefix, player, enemy, skillName, round, safeSend);
    session.updatePlayer(userId, result.player);
    combatSess.data.enemy = result.enemy;
    session.setPhase(userId, PHASES.COMBAT, { ...combatSess.data, enemy: result.enemy });

    await db.updatePlayer(userId, { hp: result.player.hp, mp: result.player.mp });

    if (result.ended) {
      if (result.victory) {
        const reward  = enemy.reward || { exp: 20, gold: 10 };
        player.exp   += reward.exp;
        player.gold  += reward.gold;
        const kills   = (player.monsters_killed || 0) + 1;
        const lvlRes  = char.calcLevelUp({ ...result.player, exp: player.exp, gold: player.gold });
        player        = { ...result.player, ...lvlRes.player, kills };
        if (lvlRes.changed) {
          await safeSend(jid, { text: lvlRes.updates.join('\n') });
        }
        await db.updatePlayer(userId, { exp: player.exp, gold: player.gold, level: player.level, exp_to_next: player.exp_to_next, monsters_killed: kills, hp: player.hp, mp: player.mp });
        await safeSend(jid, {
          text:
            `🏆 *KAMU MENANG!*\n\n` +
            `Reward:\n✨ +${reward.exp} EXP\n🪙 +${reward.gold} Gold\n\n` +
            `\`${prefix}play lobby\` — Kembali ke Lobby`
        });
        // Continue story if in story combat
        if (combatSess.data?.returnPhase === PHASES.STORY) {
          const chap  = modes.getChapter(player.story_chapter);
          const scene = modes.getScene(player.story_chapter, player.story_scene);
          if (chap && scene) await safeSend(jid, modes.renderStoryScene(chap, scene, prefix));
        }
      } else {
        player.hp = Math.floor(player.max_hp * 0.3);
        await db.updatePlayer(userId, { hp: player.hp });
        await safeSend(jid, {
          text:
            `💀 *KAMU KALAH...*\n\n` +
            `Kamu terbangun kembali dengan 30% HP.\n` +
            `❤️ HP: ${player.hp}/${player.max_hp}\n\n` +
            `\`${prefix}play lobby\` — Kembali ke Lobby`
        });
      }
      session.setPhase(userId, PHASES.LOBBY);
    }
    return;
  }

  // ─── DEFAULT: show lobby ──────────────────────────────────────────────────
  session.setPhase(userId, PHASES.LOBBY);
  await safeSend(jid, ui.lobbyScreen(player, prefix));
}

async function startCombat(safeSend, jid, prefix, player, enemy) {
  const { combatHeader, hpBarStr } = require('./rpgUI');
  const skills = Array.isArray(player.skills) ? player.skills : [];
  const skillOpts = skills.slice(0, 3).map((s, i) => `${i + 2}. \`${prefix}play skill ${s}\` — ${s}`).join('\n');
  await safeSend(jid, {
    text:
      `╔══════════════════════════════╗\n` +
      `║   ⚔️  PERTARUNGAN DIMULAI!  ║\n` +
      `╚══════════════════════════════╝\n\n` +
      `👤 *${player.char_name}* Lv.${player.level}\n` +
      `❤️ ${hpBarStr(player.hp, player.max_hp)} ${player.hp}/${player.max_hp}\n\n` +
      `VS\n\n` +
      `👹 *${enemy.name}* Lv.${enemy.level}\n` +
      `❤️ ${hpBarStr(enemy.hp, enemy.maxHp)} ${enemy.hp}/${enemy.maxHp}\n\n` +
      `━━ AKSIMU ━━\n` +
      `1. \`${prefix}play attack\` — Serangan biasa\n` +
      (skillOpts ? skillOpts + '\n' : '') +
      `0. \`${prefix}play run\` — Kabur`
  });
}

async function runCombatRound(safeSend, jid, prefix, player, enemy, skillName, round) {
  return combat.runCombatRound(safeSend, jid, prefix, player, enemy, skillName, round);
}

module.exports = { handle };
