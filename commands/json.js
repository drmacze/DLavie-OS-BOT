module.exports = {
  name: 'json',
  aliases: ['format', 'parse', 'beautify'],
  description: 'JSON formatter and validator',
  execute: async (sock, msg, args, config) => {
    const mode = (args.shift() || 'help').toLowerCase();
    const text = args.join(' ');

    if (mode === 'format' || mode === 'beautify') {
      if (!text) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !json format <json-string>' });
        return;
      }
      try {
        const parsed = JSON.parse(text);
        const formatted = JSON.stringify(parsed, null, 2);
        await sock.sendMessage(msg.key.remoteJid, {
          text: `*Formatted JSON*\n\n\`\`\`json\n${formatted.slice(0, 3500)}\n\`\`\`${formatted.length > 3500 ? '\n\n(truncated)' : ''}`
        });
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { text: `Invalid JSON: ${err.message}` });
      }
      return;
    }

    if (mode === 'minify') {
      if (!text) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !json minify <json-string>' });
        return;
      }
      try {
        const parsed = JSON.parse(text);
        const minified = JSON.stringify(parsed);
        await sock.sendMessage(msg.key.remoteJid, {
          text: `*Minified JSON*\n\n${minified.slice(0, 3500)}${minified.length > 3500 ? '\n\n(truncated)' : ''}`
        });
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { text: `Invalid JSON: ${err.message}` });
      }
      return;
    }

    if (mode === 'validate') {
      if (!text) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !json validate <json-string>' });
        return;
      }
      try {
        JSON.parse(text);
        await sock.sendMessage(msg.key.remoteJid, { text: '*Valid JSON*\n\nThe JSON string is valid.' });
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { text: `*Invalid JSON*\n\n${err.message}` });
      }
      return;
    }

    if (mode === 'keys') {
      if (!text) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !json keys <json-string>' });
        return;
      }
      try {
        const parsed = JSON.parse(text);
        const keys = Object.keys(parsed);
        await sock.sendMessage(msg.key.remoteJid, {
          text: `*JSON Keys*\n\n${keys.join('\n') || 'No keys'}`
        });
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { text: `Invalid JSON: ${err.message}` });
      }
      return;
    }

    if (mode === 'get') {
      const key = args.shift();
      const jsonText = args.join(' ');
      if (!key || !jsonText) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !json get <key> <json-string>' });
        return;
      }
      try {
        const parsed = JSON.parse(jsonText);
        const value = key.split('.').reduce((obj, k) => obj?.[k], parsed);
        await sock.sendMessage(msg.key.remoteJid, {
          text: `*Value for ${key}*\n\n${JSON.stringify(value, null, 2) || 'undefined'}`
        });
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { text: `Invalid JSON: ${err.message}` });
      }
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `*JSON Commands*\n\n!json format <json> - Format JSON\n!json minify <json> - Minify JSON\n!json validate <json> - Validate JSON\n!json keys <json> - List keys\n!json get <key> <json> - Get value by key`
    });
  }
};
