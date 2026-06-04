const axios = require('axios');

module.exports = {
  name: 'npm',
  aliases: ['package', 'pkg'],
  description: 'NPM package info',
  execute: async (sock, msg, args, config) => {
    const pkg = args.shift();
    if (!pkg) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !npm <package-name>\nContoh: !npm express' });
      return;
    }

    try {
      const response = await axios.get(`https://registry.npmjs.org/${pkg}`, { timeout: 10000 });
      const data = response.data;
      const latest = data['dist-tags']?.latest;
      const version = data.versions?.[latest];
      const text = `
*NPM Package*

Name: ${data.name}
Description: ${data.description || 'No description'}
Latest: ${latest || 'N/A'}

License: ${version?.license || data.license || 'N/A'}
Author: ${version?.author?.name || 'N/A'}
Homepage: ${data.homepage || 'N/A'}

Versions: ${Object.keys(data.versions || {}).length}

URL: https://npmjs.com/package/${pkg}
`.trim();
      await sock.sendMessage(msg.key.remoteJid, { text });
    } catch (err) {
      await sock.sendMessage(msg.key.remoteJid, { text: `NPM error: ${err.message}` });
    }
  }
};
