/**
 * DLavie OS — !approve command (OWNER ONLY)
 * Owner approve top-up atau plan upgrade
 * Format: !approve <struk_id> <token_amount> — untuk top-up
 *         !approve <struk_id> <plan_name>   — untuk plan upgrade
 */

const { getPaymentByStrukId, approveTopUp, approvePlanUpgrade } = require('../src/core/paymentEngine');

const PLAN_NAMES = ['free', 'starter', 'pro', 'enterprise'];

module.exports = {
  name: 'approve',
  aliases: ['acc'],
  description: 'Owner: approve pembayaran top-up atau plan upgrade',
  ownerOnly: true,

  execute: async (sock, msg, args, config, ctx = {}) => {
    const safeSend = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));
    const senderJid = msg.key.remoteJid;

    if (args.length < 2) {
      await safeSend(senderJid, {
        text: `❌ *Format salah!*\n\n` +
              `*Top-up token:* \n!approve <struk_id> <jumlah_token>\n` +
              `*Contoh:* \n!approve DLV-20260605-1234 5000\n\n` +
              `*Plan upgrade:* \n!approve <struk_id> <plan_name>\n` +
              `*Contoh:* \n!approve DLV-20260605-1234 pro\n\n` +
              `Plan valid: free, starter, pro, enterprise`
      });
      return;
    }

    const strukId = args[0];
    const value = args[1];

    const tx = await getPaymentByStrukId(strukId);
    if (!tx) {
      await safeSend(senderJid, { text: `❌ Struk *${strukId}* tidak ditemukan.` });
      return;
    }
    if (tx.status === 'approved') {
      await safeSend(senderJid, { text: `✅ Struk *${strukId}* sudah di-approve.` });
      return;
    }
    if (tx.status === 'rejected') {
      await safeSend(senderJid, { text: `❌ Struk *${strukId}* sudah di-reject. Tidak bisa di-approve.` });
      return;
    }

    const owner = ctx.user?.email || 'owner';

    // Cek apakah value adalah plan atau token amount
    if (PLAN_NAMES.includes(value.toLowerCase())) {
      // Plan upgrade
      const result = await approvePlanUpgrade(strukId, owner, value.toLowerCase());
      if (result.error) {
        await safeSend(senderJid, { text: `❌ ${result.error}` });
        return;
      }
      await safeSend(senderJid, {
        text: `✅ *Plan upgrade APPROVED!*\n\n` +
              `📱 Struk: ${strukId}\n` +
              `📤 Plan: ${value.toUpperCase()}\n` +
              `👤 User: ${tx.user_email}\n\n` +
              `User telah diberitahu via WhatsApp.`,
      });
    } else {
      // Top-up token
      const tokens = parseInt(value);
      if (isNaN(tokens) || tokens <= 0) {
        await safeSend(senderJid, { text: `❌ Jumlah token tidak valid: ${value}` });
        return;
      }
      const result = await approveTopUp(strukId, owner, tokens);
      if (result.error) {
        await safeSend(senderJid, { text: `❌ ${result.error}` });
        return;
      }
      await safeSend(senderJid, {
        text: `✅ *Top-up APPROVED!*\n\n` +
              `📱 Struk: ${strukId}\n` +
              `🪙 Token: +${tokens.toLocaleString('id-ID')}\n` +
              `👤 User: ${tx.user_email}\n\n` +
              `User telah diberitahu via WhatsApp.`,
      });
    }
  }
};
