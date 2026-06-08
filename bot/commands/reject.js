/**
 * DLavie OS — !reject command (OWNER ONLY)
 * Owner reject pembayaran dengan alasan
 * Format: !reject <struk_id> <alasan>
 */

const { getPaymentByStrukId, rejectPaymentTx } = require('../src/core/paymentEngine');

module.exports = {
  name: 'reject',
  aliases: ['tolak'],
  description: 'Owner: reject pembayaran dengan alasan',
  ownerOnly: true,

  execute: async (sock, msg, args, config, ctx = {}) => {
    const safeSend = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));
    const senderJid = msg.key.remoteJid;

    if (args.length < 2) {
      await safeSend(senderJid, {
        text: `❌ *Format salah!*\n\n` +
              `!reject <struk_id> <alasan>\n` +
              `*Contoh:* \n!reject DLV-20260605-1234 bukti tidak valid`
      });
      return;
    }

    const strukId = args[0];
    const reason = args.slice(1).join(' ');

    const tx = await getPaymentByStrukId(strukId);
    if (!tx) {
      await safeSend(senderJid, { text: `❌ Struk *${strukId}* tidak ditemukan.` });
      return;
    }
    if (tx.status === 'approved') {
      await safeSend(senderJid, { text: `❌ Struk *${strukId}* sudah di-approve. Tidak bisa di-reject.` });
      return;
    }
    if (tx.status === 'rejected') {
      await safeSend(senderJid, { text: `❌ Struk *${strukId}* sudah di-reject.` });
      return;
    }

    const owner = ctx.user?.email || 'owner';
    const result = await rejectPaymentTx(strukId, owner, reason);

    if (result.error) {
      await safeSend(senderJid, { text: `❌ ${result.error}` });
      return;
    }

    await safeSend(senderJid, {
      text: `❌ *Pembayaran REJECTED!*\n\n` +
            `📱 Struk: ${strukId}\n` +
            `👁 Alasan: ${reason}\n` +
            `👤 User: ${tx.user_email}\n\n` +
            `User telah diberitahu via WhatsApp.`,
    });
  }
};
