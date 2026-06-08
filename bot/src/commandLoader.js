/**
 * DLavie OS — Command Loader v2.1
 * Login gate, anti-ban, audit log, auto-fix on error
 */

const fs   = require('fs');
const path = require('path');

// Commands yang tidak butuh login
const PUBLIC_COMMANDS = new Set(['login', 'halo', 'ping', 'start', 'help']);
const CMD_DIR = path.join(__dirname, '..', 'commands');

// ─── Extract body pesan ───
function getTextMessage(msg) {
  return (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    msg.message?.documentMessage?.caption ||
    msg.message?.buttonsResponseMessage?.selectedButtonId ||
    msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ''
  );
}

// ─── Extract user ID (digits only) ───
function extractUserId(msg) {
  const { extractSenderNumber } = require('./utils/ownerUtils');
  return extractSenderNumber(msg);
}

// ─── Load semua command ───
function loadCommands() {
  const commands = new Map();
  if (!fs.existsSync(CMD_DIR)) fs.mkdirSync(CMD_DIR, { recursive: true });

  const files = fs.readdirSync(CMD_DIR).filter(f => f.endsWith('.js'));
  let loaded = 0;
  for (const file of files) {
    const fullPath = path.join(CMD_DIR, file);
    try {
      delete require.cache[require.resolve(fullPath)];
      const cmd = require(fullPath);
      if (cmd.name && typeof cmd.execute === 'function') {
        commands.set(cmd.name.toLowerCase(), cmd);
        if (Array.isArray(cmd.aliases)) {
          for (const alias of cmd.aliases) commands.set(String(alias).toLowerCase(), cmd);
        }
        loaded++;
      }
    } catch (err) {
      console.error(`[DLAVIE][CMD-LOAD] Error in ${file}: ${err.message}`);
    }
  }
  console.log(`[DLAVIE][CMD] ${loaded} commands loaded from ${files.length} files`);
  return commands;
}

// ─── Handle message utama ───
async function handleMessage(sock, m, commands, config, antiBan = null) {
  const msg = m.messages?.[0];
  if (!msg || msg.key.fromMe) return;

  const text = getTextMessage(msg);
  if (!text) return;

  const prefix  = config.botPrefix || config.bot?.prefix || '!';
  if (!text.startsWith(prefix)) return;

  const jid    = msg.key.remoteJid;
  const userId = extractUserId(msg);

  // Parse command
  const parts   = text.slice(prefix.length).trim().split(/\s+/);
  const cmdName = parts.shift()?.toLowerCase();
  const args    = parts;

  if (!cmdName || !commands.has(cmdName)) return;
  const cmd = commands.get(cmdName);

  // Helper: send dengan atau tanpa anti-ban
  const safeSend = async (jid, payload) => {
    try {
      if (antiBan) return await antiBan.safeSend(sock, jid, payload);
      return await sock.sendMessage(jid, payload);
    } catch (err) {
      // Fallback langsung jika anti-ban gagal
      try { return await sock.sendMessage(jid, payload); } catch (_) {}
    }
  };

  // ─── Cek emergency lockdown ───
  const secCfg = config.security || {};
  if (secCfg.emergencyLockdown) {
    const { getWebAuth } = require('./auth/webAuth');
    if (!getWebAuth().isOwner(userId, config.ownerNumber || config.bot?.ownerNumber)) {
      await safeSend(jid, { text: '🔒 Bot sedang dalam mode *Emergency Lockdown*. Semua akses ditangguhkan.' });
      return;
    }
  }

  // ─── Stealth mode ───
  if (secCfg.stealthMode) {
    const { getWebAuth } = require('./auth/webAuth');
    if (!getWebAuth().isOwner(userId, config.ownerNumber || config.bot?.ownerNumber)) return;
  }

  // ─── Login gate ───
  if (!PUBLIC_COMMANDS.has(cmdName)) {
    const { getWebAuth } = require('./auth/webAuth');
    const webAuth = getWebAuth();
    const isOwner = webAuth.isOwner(userId, config.ownerNumber || config.bot?.ownerNumber);

    if (!isOwner && !webAuth.isLoggedIn(userId)) {
      const dashUrl = config.web?.dashboardUrl || config.website?.dashboardUrl || config.dashboardUrl || '';
      await safeSend(jid, {
        text: `🔒 *Login Diperlukan*\n\nKamu belum login ke *DLavie OS*.\n\n*Cara login:*\n1️⃣ Buka web DLavie OS${dashUrl ? '\n   ' + dashUrl : ''}\n2️⃣ Register atau Login akun\n3️⃣ Dashboard → klik *"Get Bot Code"*\n4️⃣ Kirim ke sini: \`${prefix}login KODEMU\`\n\n✨ Kode berlaku *10 menit* saja.`
      });
      return;
    }
  }

  // ─── Blocked user check ───
  const blockedList = config.security?.blockedUsers || [];
  if (blockedList.includes(userId)) return;

  // ─── Execute command dengan auto-fix on error ───
  try {
    await cmd.execute(sock, msg, args, config, { antiBan, safeSend });
  } catch (err) {
    console.error(`[DLAVIE][CMD-ERR] ${cmdName}:`, err.message);

    // Auto-fix attempt
    let reply = `⚠️ *Error pada command* \`${prefix}${cmdName}\`\n\n\`${err.message}\``;

    try {
      const { runDeterministicRepair, formatRepairReport } = require('./selfRepair/deterministicRepair');
      const report = await runDeterministicRepair({
        apply: true,
        errorText: err?.stack || err?.message || String(err),
        source: `command:${cmdName}`
      });
      const repStr = formatRepairReport(report);
      if (repStr && repStr.trim()) reply += `\n\n🔧 *Auto-Fix:*\n${repStr.slice(0, 800)}`;
    } catch (_) {}

    // AI fallback
    const aiEnabled = config.autoFix?.aiFallback || config.autoFix?.ai;
    if (aiEnabled) {
      try {
        const { askAiFallback } = require('./selfRepair/aiFallback');
        const ai = await askAiFallback({
          errorText: err?.stack || err?.message || String(err),
          context: `Command: ${cmdName}`
        });
        if (ai?.text) reply += `\n\n🤖 *AI Analysis (${ai.provider}):*\n${ai.text.slice(0, 600)}`;
      } catch (_) {}
    }

    reply += `\n\nJika berulang, gunakan \`${prefix}fix report\` atau hubungi owner.`;
    await safeSend(jid, { text: reply.slice(0, 3800) });
  }

  // ─── Audit log ───
  try {
    const { getEngine } = require('./core/engine');
    const audit = getEngine().getSystem('audit');
    if (audit) audit.log('command', userId, { cmd: cmdName, jid });
  } catch (_) {}
}

module.exports = { loadCommands, handleMessage, getTextMessage, extractUserId };
