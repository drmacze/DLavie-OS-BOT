const QRCode = require('qrcode');

module.exports = {
  name: 'qr',
  aliases: ['qrcode', 'generate'],
  description: 'Generate QR code',
  execute: async (sock, msg, args, config) => {
    const text = args.join(' ');
    if (!text) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !qr <text or URL>' });
      return;
    }

    try {
      const qr = await QRCode.toDataURL(text, { width: 300, margin: 2 });
      const base64 = qr.split(',')[1];
      const buffer = Buffer.from(base64, 'base64');
      await sock.sendMessage(msg.key.remoteJid, {
        image: buffer,
        caption: `QR Code for: ${text}`
      });
    } catch (err) {
      await sock.sendMessage(msg.key.remoteJid, { text: `Error: ${err.message}` });
    }
  }
};
