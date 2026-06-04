const crypto = require('crypto');

module.exports = {
  name: 'hash',
  aliases: ['md5', 'sha', 'sha256'],
  description: 'Hash generator',
  execute: async (sock, msg, args, config) => {
    const mode = (args.shift() || 'sha256').toLowerCase();
    const text = args.join(' ');

    if (!text) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !hash <algorithm> <text>' });
      return;
    }

    const algorithms = ['md5', 'sha1', 'sha256', 'sha512', 'sha3-256', 'sha3-512', 'ripemd160', 'blake2b512', 'blake2s256'];
    if (!algorithms.includes(mode)) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `Algorithm tidak valid. Pilihan: ${algorithms.join(', ')}`
      });
      return;
    }

    try {
      const hash = crypto.createHash(mode).update(text).digest('hex');
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Hash (${mode.toUpperCase()})*\n\nInput: ${text}\nHash: ${hash}\nLength: ${hash.length} chars`
      });
    } catch (err) {
      await sock.sendMessage(msg.key.remoteJid, { text: `Error: ${err.message}` });
    }
  }
};
