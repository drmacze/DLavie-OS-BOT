const fs   = require('fs');
const path = require('path');
const log  = require('./logger');

function loadCommands() {
  const commands = new Map();
  const dir = path.join(__dirname, '..', 'commands');

  if (!fs.existsSync(dir)) {
    log.warn('Folder commands/ tidak ditemukan.');
    return commands;
  }

  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
    try {
      delete require.cache[require.resolve(path.join(dir, file))];
      const cmd = require(path.join(dir, file));
      if (cmd.name && typeof cmd.execute === 'function') {
        commands.set(cmd.name.toLowerCase(), cmd);
        if (Array.isArray(cmd.aliases)) {
          for (const alias of cmd.aliases) {
            commands.set(alias.toLowerCase(), cmd);
          }
        }
      } else {
        log.warn(`Command ${file} tidak memiliki 'name' atau 'execute'.`);
      }
    } catch (err) {
      log.error(`Gagal memuat command ${file}:`, err.message);
    }
  }

  return commands;
}

function extractMessageText(msg) {
  const m = msg.message;
  if (!m) return '';

  return (
    m.conversation                                    ||
    m.extendedTextMessage?.text                       ||
    m.imageMessage?.caption                           ||
    m.videoMessage?.caption                           ||
    m.documentMessage?.caption                        ||
    m.buttonsResponseMessage?.selectedButtonId        ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m.templateButtonReplyMessage?.selectedId          ||
    m.ephemeralMessage?.message?.conversation         ||
    m.ephemeralMessage?.message?.extendedTextMessage?.text ||
    m.viewOnceMessage?.message?.imageMessage?.caption ||
    m.viewOnceMessage?.message?.videoMessage?.caption ||
    ''
  );
}

function getSender(msg) {
  const jid = msg.key.remoteJid ?? '';
  const isGroup = jid.endsWith('@g.us');
  const participant = msg.key.participant ?? msg.participant ?? '';
  const sender = isGroup ? participant : jid;
  return { jid, isGroup, sender: sender.replace(/@.+/, '') };
}

async function handleMessage(sock, m, commands, config) {
  const msg = m.messages?.[0];
  if (!msg || msg.key.fromMe || m.type !== 'notify') return;
  if (msg.key.remoteJid === 'status@broadcast') return;

  const text = extractMessageText(msg).trim();
  if (!text) return;

  const prefix = config.prefix ?? '!';
  if (!text.startsWith(prefix)) return;

  const body    = text.slice(prefix.length).trim();
  const args    = body.split(/\s+/);
  const cmdName = args.shift().toLowerCase();

  if (!commands.has(cmdName)) return;

  const { jid, isGroup, sender } = getSender(msg);

  log.info(`[CMD] ${sender}${isGroup ? ` di grup ${jid}` : ''} → ${prefix}${cmdName} ${args.join(' ')}`);

  try {
    await commands.get(cmdName).execute(sock, msg, args, config, { jid, isGroup, sender });
  } catch (err) {
    log.error(`Error eksekusi command '${cmdName}':`, err.message);
    try {
      await sock.sendMessage(jid, { text: `⚠️ Error saat menjalankan command _${cmdName}_.\n${err.message}` });
    } catch (_) {}
  }
}

module.exports = { loadCommands, handleMessage };
