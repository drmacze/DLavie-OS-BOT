/**
 * DLavie OS — !cekstruk command (OWNER ONLY)
 * Cek detail struk pembayaran
 * Format: !cekstruk <struk_id>
 */

const { cekStruk } = require('../src/core/paymentEngine');

module.exports = {
  name: 'cekstruk',
  aliases: ['cek', 'struk'],
  description: 'Owner: cek detail struk pembayaran',
  ownerOnly: true,

  execute: async (sock, msg, args, config, ctx = {}) => {
    const safeSend = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));
    const senderJid = msg.key.remoteJid;

    if (!args[0]) {
      await safeSend(senderJid, {
        text: `❌ *Format salah!*\n\n` +
              `!cekstruk <struk_id>\n` +
              `*Contoh:* \n!cekstruk DLV-20260605-1234`
      });
      return;
    }

    const strukId = args[0];
    const result = await cekStruk(strukId);

    if (result.error) {
      await safeSend(senderJid, { text: `❌ ${result.error}` });
      return;
    }

    const t = result.info;
    const lines = [
      `📄 *Detail Struk*`,
      '',
      `📱 *Struk ID:* ${t.strukId}`,
      `💳 *Tipe:* ${t.type}`,
      `👤 *Nama:* ${t.nama}`,
      `📧 *Email:* ${t.email}`,
      `💵 *Nominal:* Rp ${Number(t.amount).toLocaleString('id-ID')}`,
      `📁 *Status:* ${t.statusEmoji} ${t.status.toUpperCase()}`,
      '',
      `⏰ *Dibuat:* ${new Date(t.createdAt).toLocaleString('id-ID')}`,
      `⏱ *Expired:* ${new Date(t.expiredAt).toLocaleString('id-ID')}`,
    ];

    if (t.paidAt) {
      lines.push(`💳 *Dibayar:* ${new Date(t.paidAt).toLocaleString('id-ID')}`);
    }
    if (t.approvedAt) {
      lines.push(`✅ *Approved:* ${new Date(t.approvedAt).toLocaleString('id-ID')}`);
      lines.push(`👤 *Approved By:* ${t.approvedBy}`);
      if (t.amountTokens) lines.push(`🪙 *Token Masuk:* ${t.amountTokens}`);
      if (t.plan) lines.push(`📤 *Plan:* ${t.plan.toUpperCase()}`);
    }
    if (t.rejectedAt) {
      lines.push(`❌ *Rejected:* ${new Date(t.rejectedAt).toLocaleString('id-ID')}`);
      lines.push(`👁 *Alasan:* ${t.rejectReason}`);
    }
    if (t.proofUrl) {
      lines.push(`📷 *Bukti:* ${t.proofUrl}`);
    }

    lines.push(`
*Perintah:*
!approve ${strukId} <token/plan>
!reject ${strukId} <alasan>`);

    await safeSend(senderJid, { text: lines.join('\n') });
  }
};
