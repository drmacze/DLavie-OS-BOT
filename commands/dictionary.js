const axios = require('axios');

module.exports = {
  name: 'dictionary',
  aliases: ['dict', 'define', 'meaning'],
  description: 'Dictionary lookup',
  execute: async (sock, msg, args, config) => {
    const word = args.join(' ');
    if (!word) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !dictionary <word>\nContoh: !dictionary computer' });
      return;
    }

    try {
      const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { timeout: 10000 });
      const data = response.data[0];
      const meanings = data.meanings.slice(0, 3).map(m => {
        const defs = m.definitions.slice(0, 2).map((d, i) => `${i + 1}. ${d.definition}`).join('\n');
        return `*${m.partOfSpeech}*\n${defs}`;
      }).join('\n\n');

      const text = `
*Dictionary: ${data.word}*
${data.phonetic ? `Phonetic: ${data.phonetic}` : ''}

${meanings}
`.trim();
      await sock.sendMessage(msg.key.remoteJid, { text });
    } catch (err) {
      await sock.sendMessage(msg.key.remoteJid, { text: `Dictionary error: ${err.message}` });
    }
  }
};
