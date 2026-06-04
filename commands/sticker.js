module.exports = {
  name: 'sticker',
  aliases: ['s', 'stiker'],
  description: 'Sticker maker (reply to image)',
  execute: async (sock, msg, args, config) => {
    // Check if message is a reply to an image
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Reply to an image with !sticker to convert it.' });
      return;
    }

    const image = quoted.imageMessage;
    if (!image) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Reply to an image message.' });
      return;
    }

    try {
      const stream = await sock.downloadMediaMessage({
        key: {
          remoteJid: msg.key.remoteJid,
          id: msg.message.extendedTextMessage.contextInfo.stanzaId,
          participant: msg.message.extendedTextMessage.contextInfo.participant
        },
        message: quoted
      });

      await sock.sendMessage(msg.key.remoteJid, {
        sticker: stream,
        mimetype: 'image/webp'
      });
    } catch (err) {
      await sock.sendMessage(msg.key.remoteJid, { text: `Sticker error: ${err.message}` });
    }
  }
};
