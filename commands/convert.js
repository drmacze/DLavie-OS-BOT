const axios = require('axios');

module.exports = {
  name: 'convert',
  aliases: ['currency', 'exchange', 'rate'],
  description: 'Currency converter',
  execute: async (sock, msg, args, config) => {
    const mode = (args.shift() || 'help').toLowerCase();
    const amount = parseFloat(args.shift());
    const from = (args.shift() || '').toUpperCase();
    const to = (args.shift() || '').toUpperCase();

    if (mode === 'help' || !amount || !from || !to) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Currency Converter*\n\nFormat: !convert <amount> <FROM> <TO>\nContoh: !convert 100 USD IDR\n\nPopular: USD, EUR, GBP, JPY, IDR, SGD, MYR, AUD, CAD, CNY`
      });
      return;
    }

    try {
      const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${from}`, { timeout: 10000 });
      const rate = response.data.rates[to];
      if (!rate) {
        await sock.sendMessage(msg.key.remoteJid, { text: `Currency ${to} not found.` });
        return;
      }
      const result = (amount * rate).toFixed(2);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Currency Conversion*\n\n${amount} ${from} = ${result} ${to}\nRate: 1 ${from} = ${rate.toFixed(4)} ${to}\nDate: ${response.data.date}`
      });
    } catch (err) {
      await sock.sendMessage(msg.key.remoteJid, { text: `Conversion error: ${err.message}` });
    }
  }
};
