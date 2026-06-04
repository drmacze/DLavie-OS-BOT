require('dotenv').config();

module.exports = {
  botNumber:   (process.env.BOT_NUMBER   || '6285725483343').replace(/[^0-9]/g, ''),
  ownerNumber: (process.env.OWNER_NUMBER || '62882007437216').replace(/[^0-9]/g, ''),
  botName:      process.env.BOT_NAME     || 'DLavie OS',

  prefix: process.env.PREFIX || '!',

  reconnect: {
    initialDelay: 3000,
    maxDelay:     60000,
    multiplier:   2,
  },

  session: {
    dir: 'auth_info_baileys',
  },
};
