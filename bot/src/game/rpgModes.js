'use strict';

const { sleep } = require('./rpgUI');

// ─── STORY MODE ──────────────────────────────────────────────────────────────
const CHAPTERS = [
  {
    num: 1, title: '🌅 Kebangkitan Digital',
    scenes: [
      {
        id: 0,
        text:
          `*BAB 1: Kebangkitan Digital*\n\n` +
          `Kamu terbangun di sebuah hutan digital yang dipenuhi cahaya biru. Pohon-pohon terbuat dari data, dan sungai mengalirkan informasi.\n\n` +
          `Tiba-tiba, seorang peri kecil bernama *ARIA* muncul:\n\n` +
          `> _"Petualang! Kamu akhirnya datang. Dunia Aethoria dalam bahaya. Core Data kami sedang dikorupsi oleh entitas gelap bernama *VOID*. Kamu satu-satunya yang bisa menghentikannya!"_\n\n` +
          `Apa yang ingin kamu lakukan?`,
        choices: [
          { text: '1. "Tentu, aku akan bantu!"', next: 1 },
          { text: '2. "Apa itu Core Data?"', next: 2 },
          { text: '3. "Kenapa harus aku?"', next: 3 },
        ],
      },
      {
        id: 1,
        text:
          `*ARIA* tersenyum lega:\n\n` +
          `> _"Terima kasih, Pahlawan! Pertama, kita harus melewati *Hutan Aethoria* dan menemukan *Penjaga Gerbang*. Dia memiliki peta menuju Core Data."_\n\n` +
          `Kalian berdua melangkah ke dalam hutan yang gelap. Tiba-tiba... 👾\n\n` +
          `*Seekor GOBLIN muncul!*\n` +
          `Kamu harus bertarung!`,
        choices: [
          { text: '1. Serang sekarang!', combat: 'goblin' },
          { text: '2. Coba negosiasi dulu', next: 4 },
        ],
      },
      {
        id: 2,
        text:
          `> _"Core Data adalah inti dari dunia Aethoria. Semua kehidupan digital bersumber dari sana. Jika VOID berhasil menghancurkannya, seluruh dunia ini akan lenyap."_\n\n` +
          `ARIA menunjuk ke langit — terlihat celah hitam yang semakin besar di atas.\n\n` +
          `> _"Tidak ada banyak waktu. Setiap detik VOID semakin kuat!"_`,
        choices: [
          { text: '1. "Ayo kita pergi!"', next: 1 },
          { text: '2. "Bagaimana cara menghentikan VOID?"', next: 5 },
        ],
      },
      {
        id: 3,
        text:
          `> _"Karena kamu dipilih oleh *Cahaya Digital*. Kekuatanmu berasal dari dunia nyata — sesuatu yang tidak dimiliki entitas digital manapun."_\n\n` +
          `ARIA menyentuh tanganmu dan kamu merasakan energi mengalir.\n\n` +
          `> _"Kamu memiliki kekuatan untuk menembus batas antara dunia digital dan fisik. Itulah senjata terkuatmu."_`,
        choices: [
          { text: '1. "Aku mengerti. Mari kita mulai."', next: 1 },
          { text: '2. "Aku masih ragu..."', next: 6 },
        ],
      },
      {
        id: 4,
        text:
          `Kamu mencoba berbicara dengan Goblin, tapi dia hanya mendengus dan menyerang!\n\n` +
          `Tidak ada pilihan lain — kamu harus bertarung!`,
        choices: [
          { text: '1. Hadapi pertarungan!', combat: 'goblin' },
        ],
      },
      {
        id: 5,
        text:
          `> _"Ada tiga kunci yang tersebar di seluruh Aethoria. Kunci-kunci itu yang dapat menutup celah VOID. Namun mereka dijaga oleh makhluk-makhluk kuat."_\n\n` +
          `ARIA mengeluarkan peta holografik.\n\n` +
          `Lokasi Kunci:\n` +
          `🗝️ Kunci 1 — Hutan Aethoria (dekat sini)\n` +
          `🗝️ Kunci 2 — Kota Neon di utara\n` +
          `🗝️ Kunci 3 — Labirin Data di bawah tanah`,
        choices: [
          { text: '1. "Ayo kita cari kunci pertama!"', next: 1 },
        ],
      },
      {
        id: 6,
        text:
          `> _"Aku mengerti keraguan itu, Petualang. Tapi lihat sekeliling — dunia ini butuh kamu. Bukan karena kamu sempurna, tapi karena hanya kamu yang bisa."_\n\n` +
          `Kamu menatap hutan yang penuh cahaya digital. Di balik keindahannya, kamu merasakan bahaya yang mengintai.\n\n` +
          `Kamu memutuskan untuk menerima takdirmu.`,
        choices: [
          { text: '1. "Baiklah. Aku akan melakukannya."', next: 1 },
        ],
      },
    ],
    endReward: { exp: 80, gold: 50, item: '🗝️ Kunci Aethoria I' },
  },
  {
    num: 2, title: '🏙️ Kota Neon',
    scenes: [
      {
        id: 0,
        text:
          `*BAB 2: Kota Neon*\n\n` +
          `Setelah melewati Hutan Aethoria, kalian tiba di *Kota Neon* — metropolis digital yang bercahaya dengan warna-warni neon.\n\n` +
          `ARIA berkata:\n` +
          `> _"Kunci kedua ada di *Menara Sinyal* di pusat kota. Tapi Menara itu dijaga oleh *Dark Elf Assassin* — pembunuh bayaran yang disewa VOID."_\n\n` +
          `Di depanmu ada pasar kota yang ramai. Apa yang kamu lakukan dulu?`,
        choices: [
          { text: '1. Langsung ke Menara Sinyal', next: 1 },
          { text: '2. Jelajahi pasar dulu (beli item)', next: 2 },
          { text: '3. Cari informasi tentang Dark Elf', next: 3 },
        ],
      },
      {
        id: 1,
        text:
          `Kamu bergerak langsung ke Menara Sinyal.\n\n` +
          `Di pintu masuk, *Dark Elf Assassin* sudah menunggumu dengan belati di tangan:\n\n` +
          `> _"Kamu datang sendiri? Sungguh berani — atau sungguh bodoh."_\n\n` +
          `*Pertarungan dimulai!*`,
        choices: [
          { text: '1. Hadapi dia!', combat: 'dark_elf' },
        ],
      },
      {
        id: 2,
        text:
          `Di pasar, seorang pedagang tua menyapamu:\n\n` +
          `> _"Psst! Kamu pasti yang dicari VOID itu. Aku punya info tentang Dark Elf. Tapi tidak gratis..."_\n\n` +
          `Dia meminta *50 Gold*. Kamu punya cukup?`,
        choices: [
          { text: '1. Bayar 50 Gold untuk info', next: 3, cost: { gold: 50 } },
          { text: '2. Tolak, langsung ke Menara', next: 1 },
        ],
      },
      {
        id: 3,
        text:
          `Dari informasi yang kamu dapat:\n\n` +
          `> _"Dark Elf itu lemah terhadap serangan sihir cahaya. Dia juga lambat kalau kena slow debuff."_\n\n` +
          `Dengan info ini, kamu siap menghadapinya!\n` +
          `Bonus: *STR +3* untuk pertarungan berikutnya!`,
        choices: [
          { text: '1. Ke Menara Sinyal sekarang!', next: 1, tempBuff: { str: 3 } },
        ],
      },
    ],
    endReward: { exp: 150, gold: 100, item: '🗝️ Kunci Aethoria II' },
  },
  {
    num: 3, title: '🌀 Labirin Data',
    scenes: [
      {
        id: 0,
        text:
          `*BAB 3: Labirin Data*\n\n` +
          `Pintu masuk Labirin Data membuka dirinya ketika kamu mendekat — seolah sudah menunggumu.\n\n` +
          `Di dalam, lorong-lorong terbuat dari kode biner yang berputar. ARIA tampak gelisah:\n\n` +
          `> _"Tempat ini... berubah terus. Kita bisa tersesat. Hati-hati setiap langkah."_\n\n` +
          `Kamu masuk ke persimpangan pertama:`,
        choices: [
          { text: '1. Belok kiri (terdengar cahaya)', next: 1 },
          { text: '2. Lurus (rute terpendek)', next: 2 },
          { text: '3. Belok kanan (ada suara aneh)', next: 3 },
        ],
      },
      {
        id: 1,
        text:
          `Kamu menemukan *Ruangan Cahaya* — sebuah oasis kecil di dalam labirin.\n\n` +
          `Ada kristal berkilau di tengah ruangan:\n` +
          `💎 *Crystal of Mana* — Pulihkan 40 MP!\n\n` +
          `ARIA: _"Ambil! Itu akan berguna."_`,
        choices: [
          { text: '1. Ambil kristal (+40 MP) dan lanjut', next: 4, mpHeal: 40 },
          { text: '2. Tinggalkan dan lanjut ke tujuan', next: 4 },
        ],
      },
      {
        id: 2,
        text:
          `Kamu memilih rute lurus — tapi labirin berputar!\n\n` +
          `Tiba-tiba kamu berhadapan dengan *Iron Golem* yang menjaga persimpangan:\n\n` +
          `*Pertarungan tidak bisa dihindari!*`,
        choices: [
          { text: '1. Bertarung!', combat: 'golem' },
        ],
      },
      {
        id: 3,
        text:
          `Di balik suara aneh itu, kamu menemukan *Penjelajah Terdampar* yang sudah tersesat berhari-hari.\n\n` +
          `> _"Tolong! Aku sudah seminggu di sini. Kamu bisa bantu aku keluar?"_\n\n` +
          `Jika kamu membantunya, dia mungkin punya informasi berguna.`,
        choices: [
          { text: '1. Bantu dia (EXP bonus)', next: 5, bonusExp: 50 },
          { text: '2. Maaf, tidak bisa. Lanjut.', next: 4 },
        ],
      },
      {
        id: 4,
        text:
          `Kamu akhirnya sampai di *Pusat Labirin*.\n\n` +
          `Di sana tersimpan kunci ketiga, tapi dijaga oleh boss terkuat:\n\n` +
          `👾 *DATA GUARDIAN* — Penjaga Core VOID!\n\n` +
          `ARIA: _"Ini dia! Kalahkan dia dan kita dapat kunci terakhir!"_`,
        choices: [
          { text: '1. Hadapi Data Guardian!', combat: 'boss_guardian' },
        ],
      },
      {
        id: 5,
        text:
          `Penjelajah itu sangat berterima kasih:\n\n` +
          `> _"Ini peta rahasia Labirin! Ambil — itu yang kumiliki satu-satunya."_\n\n` +
          `Kamu mendapat *+50 EXP* dan *Peta Labirin* yang menunjukkan jalan pintas ke pusat!`,
        choices: [
          { text: '1. Gunakan peta, langsung ke pusat!', next: 4 },
        ],
      },
    ],
    endReward: { exp: 250, gold: 200, item: '🗝️ Kunci Aethoria III' },
  },
];

function getChapter(num) { return CHAPTERS[num] || null; }
function getScene(chapterNum, sceneId) {
  const ch = getChapter(chapterNum);
  if (!ch) return null;
  return ch.scenes.find(s => s.id === sceneId) || null;
}

function renderStoryScene(chapter, scene, prefix) {
  const choiceLines = (scene.choices || []).map(c => c.text).join('\n');
  return {
    text:
      `╔══════════════════════════════╗\n` +
      `║   📖  STORY MODE             ║\n` +
      `╚══════════════════════════════╝\n\n` +
      `_Bab ${chapter.num}: ${chapter.title}_\n\n` +
      `${scene.text}\n\n` +
      `━━ PILIHANMU ━━\n${choiceLines}\n\n` +
      `\`${prefix}play story <angka>\` — Pilih opsi\n` +
      `\`${prefix}play lobby\` — Kembali ke Lobby`
  };
}

// ─── EXPLORATION MODE ─────────────────────────────────────────────────────────
const EXPLORE_ZONES = {
  aethoria_forest: { name: '🌲 Hutan Aethoria', levelMin: 1, enemies: ['slime', 'goblin'] },
  neon_city:       { name: '🏙️ Kota Neon',       levelMin: 5, enemies: ['goblin', 'dark_elf'] },
  data_labyrinth:  { name: '🌀 Labirin Data',     levelMin: 10, enemies: ['orc', 'golem'] },
  void_border:     { name: '🌑 Perbatasan VOID',  levelMin: 15, enemies: ['dragon', 'boss_guardian'] },
};

const EXPLORE_EVENTS = [
  { type: 'enemy', weight: 40 },
  { type: 'treasure', weight: 20 },
  { type: 'merchant', weight: 15 },
  { type: 'rare_item', weight: 10 },
  { type: 'rest', weight: 10 },
  { type: 'nothing', weight: 5 },
];

function pickExploreEvent() {
  const total = EXPLORE_EVENTS.reduce((s, e) => s + e.weight, 0);
  let rnd = Math.random() * total;
  for (const ev of EXPLORE_EVENTS) {
    rnd -= ev.weight;
    if (rnd <= 0) return ev.type;
  }
  return 'nothing';
}

function getZone(key) { return EXPLORE_ZONES[key] || EXPLORE_ZONES.aethoria_forest; }

function exploreZonesMenu(prefix) {
  const lines = Object.entries(EXPLORE_ZONES).map(([k, z], i) =>
    `${i + 1}. \`${prefix}play explore ${k}\` — ${z.name} (Lv.${z.levelMin}+)`
  ).join('\n');
  return {
    text:
      `╔══════════════════════════════╗\n` +
      `║   🗺️  EKSPLORASI AETHORIA   ║\n` +
      `╚══════════════════════════════╝\n\n` +
      `Pilih zona yang ingin dijelajahi:\n\n` +
      `${lines}\n\n` +
      `\`${prefix}play lobby\` — Kembali ke Lobby`
  };
}

function renderExploreEvent(evType, zone, player, enemy, prefix) {
  switch (evType) {
    case 'treasure': {
      const gold = Math.floor(20 + Math.random() * 50 + player.level * 3);
      return { type: 'treasure', gold, msg:
        `╔══════════════════════════════╗\n` +
        `║   💰  HARTA KARUN!           ║\n` +
        `╚══════════════════════════════╝\n\n` +
        `Saat menjelajahi ${zone.name}, kamu menemukan *peti harta karun* tersembunyi!\n\n` +
        `💰 *+${gold} Gold* kamu dapatkan!\n\n` +
        `\`${prefix}play explore\` — Jelajah lagi\n\`${prefix}play lobby\` — Kembali`
      };
    }
    case 'merchant': {
      return { type: 'merchant', msg:
        `╔══════════════════════════════╗\n` +
        `║   🧙 PEDAGANG MISTERIUS     ║\n` +
        `╚══════════════════════════════╝\n\n` +
        `Seorang pedagang misterius muncul dari balik pohon:\n\n` +
        `> _"Eh, ada petualang! Mau beli sesuatu?"_\n\n` +
        `🧪 *Health Potion* — 30 Gold (+50 HP)\n` +
        `🔵 *Mana Crystal* — 40 Gold (+40 MP)\n\n` +
        `\`${prefix}play buy hp\` — Beli HP Potion\n` +
        `\`${prefix}play buy mp\` — Beli Mana Crystal\n` +
        `\`${prefix}play explore\` — Lewati pedagang`
      };
    }
    case 'rare_item': {
      const items = ['🗡️ Iron Blade', '🛡️ Leather Shield', '💍 Lucky Ring', '🪄 Magic Wand'];
      const item = items[Math.floor(Math.random() * items.length)];
      return { type: 'rare_item', item, msg:
        `╔══════════════════════════════╗\n` +
        `║   ✨  ITEM LANGKA DITEMUKAN! ║\n` +
        `╚══════════════════════════════╝\n\n` +
        `Cahaya keemasan muncul di hadapanmu...\n\n` +
        `🌟 *${item}* berhasil kamu temukan!\n\n` +
        `Item disimpan ke inventori.\n\n` +
        `\`${prefix}play explore\` — Jelajah lagi\n\`${prefix}play lobby\` — Kembali`
      };
    }
    case 'rest': {
      const hpGain = Math.floor(player.max_hp * 0.3);
      const mpGain = Math.floor(player.max_mp * 0.3);
      return { type: 'rest', hpGain, mpGain, msg:
        `╔══════════════════════════════╗\n` +
        `║   😌  ISTIRAHAT              ║\n` +
        `╚══════════════════════════════╝\n\n` +
        `Kamu menemukan tempat teduh yang nyaman dan beristirahat sejenak.\n\n` +
        `❤️ *+${hpGain} HP* pulih\n` +
        `🔷 *+${mpGain} MP* pulih\n\n` +
        `\`${prefix}play explore\` — Lanjut jelajah\n\`${prefix}play lobby\` — Kembali`
      };
    }
    case 'nothing':
      return { type: 'nothing', msg:
        `Kamu menjelajahi ${zone.name}...\n\nTidak ada yang ditemukan kali ini. Coba lagi!\n\n` +
        `\`${prefix}play explore\` — Jelajah lagi\n\`${prefix}play lobby\` — Kembali`
      };
    default:
      return { type: 'enemy', enemy };
  }
}

// ─── CLASSIC MODE ─────────────────────────────────────────────────────────────
function classicHuntMenu(prefix) {
  return {
    text:
      `╔══════════════════════════════╗\n` +
      `║   ⚔️  CLASSIC HUNT MODE      ║\n` +
      `╚══════════════════════════════╝\n\n` +
      `Pilih target hunt:\n\n` +
      `1️⃣  \`${prefix}play hunt slime\`     — 🟢 Slime (Easy)\n` +
      `2️⃣  \`${prefix}play hunt goblin\`    — 👺 Goblin (Normal)\n` +
      `3️⃣  \`${prefix}play hunt wolf\`      — 🐺 Shadow Wolf (Normal)\n` +
      `4️⃣  \`${prefix}play hunt orc\`       — 👹 Orc Warrior (Hard)\n` +
      `5️⃣  \`${prefix}play hunt dark_elf\`  — 🧝 Dark Elf (Hard)\n` +
      `6️⃣  \`${prefix}play hunt golem\`     — 🪨 Iron Golem (Very Hard)\n` +
      `7️⃣  \`${prefix}play hunt dragon\`    — 🐉 Young Dragon (Extreme)\n\n` +
      `\`${prefix}play lobby\` — Kembali ke Lobby`
  };
}

// ─── PVP MODE ─────────────────────────────────────────────────────────────────
function pvpMenu(prefix) {
  return {
    text:
      `╔══════════════════════════════╗\n` +
      `║   🏆  PVP BATTLE ARENA       ║\n` +
      `╚══════════════════════════════╝\n\n` +
      `⚔️ Tantang pemain lain dalam arena!\n\n` +
      `1️⃣  \`${prefix}play pvp random\` — Lawan random (berdasarkan rating)\n` +
      `2️⃣  \`${prefix}play pvp practice\` — Latihan vs AI\n\n` +
      `📡 *Rating-mu saat ini tersedia di profil.*\n\n` +
      `_Catatan: PVP membutuhkan nomor target. Fitur invite teman segera hadir!_\n\n` +
      `\`${prefix}play lobby\` — Kembali ke Lobby`
  };
}

module.exports = {
  CHAPTERS, getChapter, getScene, renderStoryScene,
  EXPLORE_ZONES, getZone, pickExploreEvent, exploreZonesMenu, renderExploreEvent,
  classicHuntMenu, pvpMenu,
};
