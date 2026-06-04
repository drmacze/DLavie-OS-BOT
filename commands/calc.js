module.exports = {
  name: 'calc',
  aliases: ['calculate', 'math'],
  description: 'Calculator',
  execute: async (sock, msg, args, config) => {
    const expression = args.join(' ');
    if (!expression) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !calc <expression>\nContoh: !calc 2 + 2 * 5' });
      return;
    }

    try {
      // Safe evaluation - only allow math operators and numbers
      const safeExpr = expression.replace(/[^0-9+\-*/.%()\s]/g, '');
      if (safeExpr !== expression.replace(/\s/g, '')) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Hanya angka dan operator matematika diperbolehkan.' });
        return;
      }
      const result = eval(safeExpr);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Calculator*\n\n${expression} = ${result}`
      });
    } catch (err) {
      await sock.sendMessage(msg.key.remoteJid, { text: `Error: ${err.message}` });
    }
  }
};
