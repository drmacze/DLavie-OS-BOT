const { v4: uuidv4 } = require('uuid');

module.exports = {
  name: 'uuid',
  aliases: ['guid', 'id'],
  description: 'Generate UUID',
  execute: async (sock, msg, args, config) => {
    const count = parseInt(args.shift() || '1');
    const uuids = [];
    for (let i = 0; i < Math.min(count, 10); i++) {
      uuids.push(uuidv4());
    }
    await sock.sendMessage(msg.key.remoteJid, {
      text: `*UUID Generator*\n\n${uuids.join('\n')}`
    });
  }
};
