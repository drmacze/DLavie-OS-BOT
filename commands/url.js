const axios = require('axios');

module.exports = {
  name: 'url',
  aliases: ['shorten', 'link', 'expand'],
  description: 'URL shortener and info',
  execute: async (sock, msg, args, config) => {
    const mode = (args.shift() || 'help').toLowerCase();
    const url = args.shift();

    if (mode === 'shorten') {
      if (!url) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !url shorten <long-url>' });
        return;
      }
      try {
        const response = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, { timeout: 10000 });
        await sock.sendMessage(msg.key.remoteJid, {
          text: `*URL Shortened*\n\nOriginal: ${url}\nShort: ${response.data}`
        });
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { text: `Shorten error: ${err.message}` });
      }
      return;
    }

    if (mode === 'info') {
      if (!url) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !url info <url>' });
        return;
      }
      try {
        const response = await axios.head(url, { timeout: 10000, maxRedirects: 5 });
        const text = `
*URL Info*

URL: ${url}
Status: ${response.status}
Content-Type: ${response.headers['content-type'] || 'N/A'}
Content-Length: ${response.headers['content-length'] ? (response.headers['content-length'] / 1024).toFixed(2) + ' KB' : 'N/A'}
Server: ${response.headers['server'] || 'N/A'}
Last-Modified: ${response.headers['last-modified'] || 'N/A'}
`.trim();
        await sock.sendMessage(msg.key.remoteJid, { text });
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { text: `URL info error: ${err.message}` });
      }
      return;
    }

    if (mode === 'fetch') {
      if (!url) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !url fetch <url>' });
        return;
      }
      try {
        const response = await axios.get(url, { timeout: 10000, maxContentLength: 50000 });
        const text = response.data;
        const preview = String(text).slice(0, 3000);
        await sock.sendMessage(msg.key.remoteJid, {
          text: `*URL Content Preview*\n\n${url}\n\n${preview}${text.length > 3000 ? '\n\n... (truncated)' : ''}`
        });
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { text: `Fetch error: ${err.message}` });
      }
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `*URL Commands*\n\n!url shorten <url> - Shorten URL\n!url info <url> - URL info\n!url fetch <url> - Fetch content`
    });
  }
};
