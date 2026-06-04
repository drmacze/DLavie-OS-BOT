module.exports = {
  name: 'text',
  aliases: ['string', 'txt', 'transform'],
  description: 'Text transformation tools',
  execute: async (sock, msg, args, config) => {
    const mode = (args.shift() || 'help').toLowerCase();
    const text = args.join(' ');

    if (mode === 'upper') {
      if (!text) { await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !text upper <text>' }); return; }
      await sock.sendMessage(msg.key.remoteJid, { text: text.toUpperCase() });
      return;
    }

    if (mode === 'lower') {
      if (!text) { await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !text lower <text>' }); return; }
      await sock.sendMessage(msg.key.remoteJid, { text: text.toLowerCase() });
      return;
    }

    if (mode === 'reverse') {
      if (!text) { await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !text reverse <text>' }); return; }
      await sock.sendMessage(msg.key.remoteJid, { text: text.split('').reverse().join('') });
      return;
    }

    if (mode === 'flip') {
      if (!text) { await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !text flip <text>' }); return; }
      const flipMap = { 'a': 'ɐ', 'b': 'q', 'c': 'ɔ', 'd': 'p', 'e': 'ǝ', 'f': 'ɟ', 'g': 'ƃ', 'h': 'ɥ', 'i': 'ᴉ', 'j': 'ɾ', 'k': 'ʞ', 'l': 'l', 'm': 'ɯ', 'n': 'u', 'o': 'o', 'p': 'd', 'q': 'b', 'r': 'ɹ', 's': 's', 't': 'ʇ', 'u': 'n', 'v': 'ʌ', 'w': 'ʍ', 'x': 'x', 'y': 'ʎ', 'z': 'z', 'A': '∀', 'B': 'q', 'C': 'Ɔ', 'D': 'p', 'E': 'Ǝ', 'F': 'Ⅎ', 'G': 'פ', 'H': 'H', 'I': 'I', 'J': 'ſ', 'K': 'ʞ', 'L': '˥', 'M': 'W', 'N': 'N', 'O': 'O', 'P': 'd', 'Q': 'b', 'R': 'ɹ', 'S': 'S', 'T': '┴', 'U': '∩', 'V': 'Λ', 'W': 'M', 'X': 'X', 'Y': '⅄', 'Z': 'Z', '1': 'Ɩ', '2': 'ᄅ', '3': 'Ɛ', '4': 'h', '5': 'S', '6': '9', '7': 'L', '8': '8', '9': '6', '0': '0', ' ': ' ' };
      const flipped = text.split('').reverse().map(c => flipMap[c] || c).join('');
      await sock.sendMessage(msg.key.remoteJid, { text: flipped });
      return;
    }

    if (mode === 'count') {
      if (!text) { await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !text count <text>' }); return; }
      const chars = text.length;
      const words = text.trim().split(/\s+/).length;
      const lines = text.split('\n').length;
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Text Stats*\n\nCharacters: ${chars}\nWords: ${words}\nLines: ${lines}`
      });
      return;
    }

    if (mode === 'replace') {
      const search = args.shift();
      const replace = args.shift();
      const targetText = args.join(' ');
      if (!search || !targetText) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !text replace <search> <replace> <text>' });
        return;
      }
      const result = targetText.split(search).join(replace || '');
      await sock.sendMessage(msg.key.remoteJid, { text: result.slice(0, 3500) });
      return;
    }

    if (mode === 'lines') {
      if (!text) { await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !text lines <text>' }); return; }
      const lines = text.split('\n').map((l, i) => `${i + 1}. ${l}`);
      await sock.sendMessage(msg.key.remoteJid, { text: lines.join('\n').slice(0, 3500) });
      return;
    }

    if (mode === 'words') {
      if (!text) { await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !text words <text>' }); return; }
      const words = text.trim().split(/\s+/).map((w, i) => `${i + 1}. ${w}`);
      await sock.sendMessage(msg.key.remoteJid, { text: words.join('\n').slice(0, 3500) });
      return;
    }

    if (mode === 'slug') {
      if (!text) { await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !text slug <text>' }); return; }
      const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      await sock.sendMessage(msg.key.remoteJid, { text: slug });
      return;
    }

    if (mode === 'camel') {
      if (!text) { await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !text camel <text>' }); return; }
      const camel = text.toLowerCase().replace(/[^a-z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
      await sock.sendMessage(msg.key.remoteJid, { text: camel });
      return;
    }

    if (mode === 'snake') {
      if (!text) { await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !text snake <text>' }); return; }
      const snake = text.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
      await sock.sendMessage(msg.key.remoteJid, { text: snake });
      return;
    }

    if (mode === 'kebab') {
      if (!text) { await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !text kebab <text>' }); return; }
      const kebab = text.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
      await sock.sendMessage(msg.key.remoteJid, { text: kebab });
      return;
    }

    if (mode === 'repeat') {
      const count = parseInt(args.shift());
      const repeatText = args.join(' ');
      if (!count || !repeatText) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !text repeat <count> <text>' });
        return;
      }
      const result = repeatText.repeat(Math.min(count, 100));
      await sock.sendMessage(msg.key.remoteJid, { text: result.slice(0, 3500) });
      return;
    }

    if (mode === 'trim') {
      if (!text) { await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !text trim <text>' }); return; }
      await sock.sendMessage(msg.key.remoteJid, { text: text.trim() });
      return;
    }

    if (mode === 'remove-spaces') {
      if (!text) { await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !text remove-spaces <text>' }); return; }
      await sock.sendMessage(msg.key.remoteJid, { text: text.replace(/\s+/g, '') });
      return;
    }

    if (mode === 'unique') {
      if (!text) { await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !text unique <text>' }); return; }
      const unique = [...new Set(text.split(''))].join('');
      await sock.sendMessage(msg.key.remoteJid, { text: unique });
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `*Text Commands*\n\n!text upper <text> - Uppercase\n!text lower <text> - Lowercase\n!text reverse <text> - Reverse\n!text flip <text> - Flip text\n!text count <text> - Count chars/words/lines\n!text replace <s> <r> <t> - Replace\n!text lines <text> - Number lines\n!text words <text> - Number words\n!text slug <text> - URL slug\n!text camel <text> - camelCase\n!text snake <text> - snake_case\n!text kebab <text> - kebab-case\n!text repeat <n> <text> - Repeat text\n!text trim <text> - Trim whitespace\n!text remove-spaces <text> - Remove spaces\n!text unique <text> - Unique chars`
    });
  }
};
