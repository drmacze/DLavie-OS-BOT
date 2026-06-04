const fs = require('fs');
const path = require('path');

function loadCommands() {
  const commands = new Map();
  const dir = path.join(__dirname, '..', 'commands');
  fs.readdirSync(dir).filter(f => f.endsWith('.js')).forEach(file => {
    const cmd = require(path.join(dir, file));
    if (cmd.name && cmd.execute) commands.set(cmd.name, cmd);
  });
  return commands;
}

async function handleMessage(sock, m, commands, config) {
  const msg = m.messages[0];
  if (msg.key.fromMe || m.type !== 'notify') return;
  const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  if (!text) return;

  const args = text.trim().split(/ +/);
  const cmdName = args.shift().toLowerCase().replace(/^!/, '');

  if (commands.has(cmdName)) {
    await commands.get(cmdName).execute(sock, msg, args, config);
  }
}

module.exports = { loadCommands, handleMessage };