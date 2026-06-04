const axios = require('axios');

module.exports = {
  name: 'crypto',
  aliases: ['bitcoin', 'btc', 'eth'],
  description: 'Crypto price checker',
  execute: async (sock, msg, args, config) => {
    const coin = (args.shift() || 'bitcoin').toLowerCase();
    const currency = (args.shift() || 'usd').toLowerCase();

    try {
      const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=${currency}&include_24hr_change=true`, { timeout: 10000 });
      const data = response.data[coin];
      if (!data) {
        await sock.sendMessage(msg.key.remoteJid, { text: `Crypto ${coin} not found. Try: bitcoin, ethereum, cardano, solana` });
        return;
      }
      const price = data[currency];
      const change = data[`${currency}_24h_change`];
      const changeText = change ? ` (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)` : '';
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*${coin.toUpperCase()}*\n\n${currency.toUpperCase()}: ${price.toLocaleString()}${changeText}`
      });
    } catch (err) {
      await sock.sendMessage(msg.key.remoteJid, { text: `Crypto error: ${err.message}` });
    }
  }
};
