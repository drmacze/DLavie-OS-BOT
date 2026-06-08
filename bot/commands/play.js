'use strict';

const { isGameMode } = require('../src/core/botMode');
const rpgEngine      = require('../src/game/rpgEngine');

module.exports = {
  name: 'play',
  aliases: ['rpg', 'game', 'dlavierpg'],
  description: 'DLavie RPG — Game RPG WhatsApp setara console (Game Mode only)',

  execute: async (sock, msg, args, config, ctx = {}) => {
    const jid      = msg.key.remoteJid;
    const safeSend = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));
    const prefix   = config.botPrefix || config.bot?.prefix || '!';

    if (!isGameMode()) {
      await safeSend(jid, {
        text:
          `🎮 *DLavie RPG*\n\n` +
          `Game Mode belum aktif.\n\n` +
          `_Bot sedang berjalan dalam mode Multi-Bot Control._\n` +
          `Hubungi admin untuk mengaktifkan Game Mode.`
      });
      return;
    }

    await rpgEngine.handle(sock, msg, args, config, ctx);
  },
};
