const axios = require('axios');

module.exports = {
  name: 'weather',
  aliases: ['cuaca', 'wttr'],
  description: 'Weather information',
  execute: async (sock, msg, args, config) => {
    const city = args.join(' ');
    if (!city) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !weather <city>\nContoh: !weather Jakarta' });
      return;
    }

    try {
      const response = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=4`, { timeout: 10000 });
      const weather = response.data;
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Weather in ${city}*\n\n${weather}`
      });
    } catch (err) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `Weather unavailable. Try: !weather Jakarta`
      });
    }
  }
};
