module.exports = {
  name: 'base64',
  aliases: ['b64', 'encode', 'decode'],
  description: 'Base64 encode/decode',
  execute: async (sock, msg, args, config) => {
    const mode = (args.shift() || 'help').toLowerCase();
    const text = args.join(' ');

    if (mode === 'encode' || mode === 'en') {
      if (!text) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !base64 encode <text>' });
        return;
      }
      const encoded = Buffer.from(text).toString('base64');
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Base64 Encode*\n\nInput: ${text}\nOutput: ${encoded}`
      });
      return;
    }

    if (mode === 'decode' || mode === 'de') {
      if (!text) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !base64 decode <text>' });
        return;
      }
      try {
        const decoded = Buffer.from(text, 'base64').toString('utf8');
        await sock.sendMessage(msg.key.remoteJid, {
          text: `*Base64 Decode*\n\nInput: ${text}\nOutput: ${decoded}`
        });
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Invalid base64 string.' });
      }
      return;
    }

    if (mode === 'urlsafe') {
      if (!text) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !base64 urlsafe <text>' });
        return;
      }
      const encoded = Buffer.from(text).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Base64 URL-safe*\n\nInput: ${text}\nOutput: ${encoded}`
      });
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `*Base64 Commands*\n\n!base64 encode <text> - Encode\n!base64 decode <text> - Decode\n!base64 urlsafe <text> - URL-safe encode`
    });
  }
};
