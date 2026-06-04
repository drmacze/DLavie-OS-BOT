require('dotenv').config();

const config = {
  botNumber: process.env.BOT_NUMBER || '6285725483343',
  ownerNumber: process.env.OWNER_NUMBER || '62882007437216',
  botName: process.env.BOT_NAME || 'DLV BOT',
};

module.exports = config;