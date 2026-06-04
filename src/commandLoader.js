const fs = require('fs');
const path = require('path');
const { runDeterministicRepair, formatRepairReport } = require('./selfRepair/deterministicRepair');
const { askAiFallback } = require('./selfRepair/aiFallback');

function getTextMessage(msg) {
  return msg.message?.conversation
    || msg.message?.extendedTextMessage?.text
    || msg.message?.imageMessage?.caption
    || msg.message?.videoMessage?.caption
    || msg.message?.documentMessage?.caption
    || msg.message?.buttonsResponseMessage?.selectedButtonId
    || msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId
    || '';
}

function loadCommands() {
  const commands = new Map();
  const dir = path.join(__dirname, '..', 'commands');

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const files = fs.readdirSync(dir).filter((file) => file.endsWith('.js'));
  for (const file of files) {
    const fullPath = path.join(dir, file);
    try {
      delete require.cache[require.resolve(fullPath)];
      const cmd = require(fullPath);
      if (cmd.name && typeof cmd.execute === 'function') {
        commands.set(cmd.name.toLowerCase(), cmd);
        if (Array.isArray(cmd.aliases)) {
          for (const alias of cmd.aliases) commands.set(String(alias).toLowerCase(), cmd);
        }
      }
    } catch (err) {
      console.error(`[DLAVIE][COMMAND-LOAD-ERROR] ${file}:`, err.message);
    }
  }

  return commands;
}

async function handleMessage(sock, m, commands, config) {
  const msg = m.messages?.[0];
  if (!msg || msg.key.fromMe || m.type !== 'notify') return;

  const text = getTextMessage(msg);
  if (!text) return;

  const args = text.trim().split(/ +/);
  const cmdName = args.shift().toLowerCase().replace(/^!/, '');

  if (!commands.has(cmdName)) return;

  try {
    await commands.get(cmdName).execute(sock, msg, args, config);
  } catch (err) {
    console.error(`[DLAVIE][COMMAND-ERROR] ${cmdName}:`, err);
    const report = await runDeterministicRepair({
      apply: true,
      errorText: err?.stack || err?.message || String(err),
      source: `command:${cmdName}`
    });

    let reply = '⚠️ DLavie Auto-Fix menangkap error command.\n\n' + formatRepairReport(report);

    if (config.autoFix?.aiFallback) {
      try {
        const ai = await askAiFallback({
          errorText: err?.stack || err?.message || String(err),
          context: `Command: ${cmdName}`
        });
        reply += `\n\n🤖 AI fallback (${ai.provider}) berhasil memberi analisis.\n` + ai.text.slice(0, 1600);
      } catch (aiErr) {
        reply += `\n\n🤖 AI fallback gagal: ${aiErr.message}`;
      }
    }

    await sock.sendMessage(msg.key.remoteJid, { text: reply.slice(0, 3500) });
  }
}

module.exports = { loadCommands, handleMessage };
