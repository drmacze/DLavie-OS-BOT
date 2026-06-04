const fs   = require('fs');
const path = require('path');
const log  = require('./logger');

const COMMANDS_DIR = path.join(__dirname, '..', 'commands');

function loadCommands() {
  const map = new Map();

  if (!fs.existsSync(COMMANDS_DIR)) {
    log.warn('Folder commands/ tidak ditemukan.');
    return map;
  }

  for (const file of fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.js'))) {
    const fullPath = path.join(COMMANDS_DIR, file);
    try {
      delete require.cache[require.resolve(fullPath)];
      const cmd = require(fullPath);
      if (cmd.name && typeof cmd.execute === 'function') {
        map.set(cmd.name.toLowerCase(), cmd);
        if (Array.isArray(cmd.aliases)) {
          for (const alias of cmd.aliases) map.set(alias.toLowerCase(), cmd);
        }
      } else {
        log.warn(`Command ${file}: tidak punya 'name' atau 'execute'.`);
      }
    } catch (err) {
      log.error(`Gagal load command ${file}:`, err.message);
    }
  }

  log.info(`${map.size} command(s) dimuat dari ${COMMANDS_DIR}`);
  return map;
}

function extractMessageText(msg) {
  const m = msg.message;
  if (!m) return '';
  return (
    m.conversation                                          ||
    m.extendedTextMessage?.text                             ||
    m.imageMessage?.caption                                 ||
    m.videoMessage?.caption                                 ||
    m.documentMessage?.caption                              ||
    m.buttonsResponseMessage?.selectedButtonId              ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m.templateButtonReplyMessage?.selectedId                ||
    m.ephemeralMessage?.message?.conversation               ||
    m.ephemeralMessage?.message?.extendedTextMessage?.text  ||
    m.viewOnceMessage?.message?.imageMessage?.caption       ||
    m.viewOnceMessage?.message?.videoMessage?.caption       ||
    ''
  );
}

function getSender(msg, contactPhoneMap = new Map()) {
  const jid     = msg.key.remoteJid ?? '';
  const isGroup = jid.endsWith('@g.us');
  const rawPart = isGroup
    ? (msg.key.participant ?? msg.participant ?? '')
    : jid;

  const rawId   = rawPart.split('@')[0].split(':')[0];
  const sender  = contactPhoneMap.get(rawId) ?? rawId;

  log.debug(`getSender: raw="${rawId}" resolved="${sender}" isGroup=${isGroup}`);
  return { jid, isGroup, sender, rawId };
}

async function handleMessage(sock, m, commandsRef, config, contactPhoneMap = new Map()) {
  const msg = m.messages?.[0];
  if (!msg || msg.key.fromMe || m.type !== 'notify') return;
  if (msg.key.remoteJid === 'status@broadcast') return;

  const text = extractMessageText(msg).trim();
  if (!text) return;

  const prefix = config.prefix ?? '!';
  if (!text.startsWith(prefix)) return;

  // body = everything after the prefix (preserves newlines for !addcmd)
  const body    = text.slice(prefix.length);
  const firstNL = body.indexOf('\n');
  const firstLine = (firstNL === -1 ? body : body.slice(0, firstNL)).trim();
  const restBody  = firstNL === -1 ? '' : body.slice(firstNL + 1);

  const parts   = firstLine.split(/\s+/);
  const cmdName = parts[0].toLowerCase();
  const args    = parts.slice(1);

  const commands = commandsRef.map;
  if (!commands.has(cmdName)) return;

  const { jid, isGroup, sender, rawId } = getSender(msg, contactPhoneMap);
  const isOwner = sender === config.ownerNumber;

  log.info(`[CMD] sender=${sender} owner=${isOwner} → ${prefix}${cmdName}${args.length ? ' ' + args.join(' ') : ''}`);

  const ctx = {
    jid, isGroup, sender, rawId, isOwner,
    body: restBody,       // raw multi-line body after command name line
    args,                 // words on same line as command
    commandsRef,          // mutable reference → allows hot-reload from commands
  };

  try {
    await commands.get(cmdName).execute(sock, msg, args, config, ctx);
  } catch (err) {
    log.error(`Error eksekusi '${cmdName}':`, err.message);
    try {
      await sock.sendMessage(jid, {
        text: `⚠️ Error menjalankan _${cmdName}_:\n${err.message}`,
      });
    } catch (_) {}
  }
}

module.exports = { loadCommands, handleMessage };
