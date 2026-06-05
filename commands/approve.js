/**
 * DLavie OS — !approve / !reject command
 * Owner-only: approve or reject payment/topup requests
 * Usage: !approve PAYID [amount]  |  !approve plan PAYID PLAN_NAME
 *        !reject PAYID [reason]
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const PAYMENTS_FILE = path.join(__dirname, '../tmp/payments.json');
const USERS_FILE    = path.join(__dirname, '../tmp/web_users.json');

function loadPayments() {
  try { if (fs.existsSync(PAYMENTS_FILE)) return JSON.parse(fs.readFileSync(PAYMENTS_FILE, 'utf8')); } catch(_){}
  return [];
}
function savePayments(data) {
  try { fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(data, null, 2)); } catch(_){}
}
function loadUsers() {
  try { if (fs.existsSync(USERS_FILE)) return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch(_){}
  return {};
}
function saveUsers(u) {
  try { fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2)); } catch(_){}
}
function fmtNum(n) { return Number(n||0).toLocaleString('id-ID'); }
function digitsOnly(v) { return String(v||'').replace(/\D/g,''); }

let cfg = {};
try { cfg = require('../DLavieConfig'); } catch(_){}

const OWNER_NUMBER = process.env.OWNER_NUMBER || cfg.bot?.ownerNumber || '62882007437216';

module.exports = {
  name: 'approve',
  aliases: ['reject', 'tolak', 'setujui'],
  description: 'Owner: approve/reject pembayaran topup',

  execute: async (sock, msg, args, config, ctx = {}) => {
    const jid      = msg.key.remoteJid;
    const userId   = digitsOnly(msg.key.participant || msg.key.remoteJid || '');
    const safeSend = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));
    const cmdName  = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim().split(/\s+/)[0]?.replace(/^!/, '').toLowerCase();

    // Only owner can use this
    if (userId !== OWNER_NUMBER && userId !== digitsOnly(OWNER_NUMBER)) {
      await safeSend(jid, { text: '❌ Hanya owner yang bisa menggunakan command ini.' });
      return;
    }

    // ─── !reject PAYID [reason] ───
    if (cmdName === 'reject' || cmdName === 'tolak') {
      const payId  = args[0];
      const reason = args.slice(1).join(' ') || 'Ditolak oleh admin';
      if (!payId) { await safeSend(jid, { text: 'Format: `!reject PAYID [alasan]`' }); return; }

      const payments = loadPayments();
      const idx = payments.findIndex(p => p.payId === payId);
      if (idx === -1) { await safeSend(jid, { text: `❌ Payment ID \`${payId}\` tidak ditemukan.` }); return; }

      const pay = payments[idx];
      if (pay.status !== 'pending_proof' && pay.status !== 'proof_submitted') {
        await safeSend(jid, { text: `⚠️ Payment \`${payId}\` status: *${pay.status}*. Tidak bisa ditolak.` });
        return;
      }

      payments[idx].status       = 'rejected';
      payments[idx].rejectedAt   = Date.now();
      payments[idx].rejectReason = reason;
      payments[idx].rejectedBy   = userId;
      savePayments(payments);

      await safeSend(jid, {
        text: `❌ *Payment Ditolak*\n\nID: \`${payId}\`\nBuyer: ${pay.email}\nAlasan: ${reason}\n\nBuyer telah dinotifikasi.`
      });

      // Notify buyer if they have WA number in session
      try {
        if (pay.buyerWaNumber) {
          const buyerJid = `${pay.buyerWaNumber}@s.whatsapp.net`;
          await sock.sendMessage(buyerJid, {
            text: `❌ *Pembayaran Ditolak*\n\nID: \`${payId}\`\nAlasan: ${reason}\n\nHubungi admin jika ada pertanyaan.`
          });
        }
      } catch(_){}
      return;
    }

    // ─── !approve [plan] PAYID [amount/planName] ───
    const isApprove = cmdName === 'approve' || cmdName === 'setujui';
    if (!isApprove) return;

    // !approve plan PAYID PLAN_NAME
    if ((args[0] || '').toLowerCase() === 'plan') {
      const payId    = args[1];
      const planName = (args[2] || '').toLowerCase();
      if (!payId || !planName) { await safeSend(jid, { text: 'Format: `!approve plan PAYID free|starter|pro|enterprise`' }); return; }

      const validPlans = ['free', 'starter', 'pro', 'enterprise'];
      if (!validPlans.includes(planName)) { await safeSend(jid, { text: `❌ Plan tidak valid. Pilih: ${validPlans.join(', ')}` }); return; }

      const payments = loadPayments();
      const idx      = payments.findIndex(p => p.payId === payId);
      if (idx === -1) { await safeSend(jid, { text: `❌ Payment ID \`${payId}\` tidak ditemukan.` }); return; }

      const pay = payments[idx];
      const users = loadUsers();
      const userEntry = Object.values(users).find(u => u.userId === pay.userId);

      if (!userEntry) { await safeSend(jid, { text: `❌ User \`${pay.userId}\` tidak ditemukan di database.` }); return; }

      const oldPlan = userEntry.plan;
      userEntry.plan = planName;
      const planTokens = { free: 5000, starter: 25000, pro: 100000, enterprise: 500000 }[planName] || 5000;
      userEntry.tokens = (userEntry.tokens || 0) + planTokens;
      if (!userEntry.tokenHistory) userEntry.tokenHistory = [];
      userEntry.tokenHistory.unshift({ type: 'plan_upgrade', amount: planTokens, plan: planName, ts: Date.now(), ref: payId });
      saveUsers(users);

      payments[idx].status     = 'approved';
      payments[idx].approvedAt = Date.now();
      payments[idx].approvedBy = userId;
      payments[idx].result     = { plan: planName, tokensAdded: planTokens };
      savePayments(payments);

      await safeSend(jid, {
        text: `✅ *Plan Upgrade Approved!*\n\nID: \`${payId}\`\nUser: ${pay.email}\n${oldPlan.toUpperCase()} → *${planName.toUpperCase()}*\nToken ditambahkan: ${fmtNum(planTokens)}`
      });

      try {
        if (pay.buyerWaNumber) {
          await sock.sendMessage(`${pay.buyerWaNumber}@s.whatsapp.net`, {
            text: `🎉 *Plan Upgrade Berhasil!*\n\nPlan kamu sekarang: *${planName.toUpperCase()}*\nToken ditambahkan: ${fmtNum(planTokens)}\n\nTerima kasih telah mempercayai DLavie OS! 🚀`
          });
        }
      } catch(_){}
      return;
    }

    // !approve PAYID [manual_token_amount]
    const payId       = args[0];
    const manualToken = parseInt(args[1]) || null;
    if (!payId) { await safeSend(jid, { text: 'Format: `!approve PAYID [jumlah_token]\nContoh: `!approve PAY_20240101_abc123 50000`' }); return; }

    const payments = loadPayments();
    const idx      = payments.findIndex(p => p.payId === payId);
    if (idx === -1) { await safeSend(jid, { text: `❌ Payment ID \`${payId}\` tidak ditemukan.\n\nCek daftar pending: \`!approve list\`` }); return; }

    const pay = payments[idx];
    if (pay.status === 'approved') { await safeSend(jid, { text: `⚠️ Payment \`${payId}\` sudah di-approve sebelumnya.` }); return; }

    const tokensToAdd = manualToken || pay.tokens || 0;
    if (tokensToAdd <= 0) { await safeSend(jid, { text: `❌ Jumlah token tidak valid. Gunakan: \`!approve ${payId} 50000\`` }); return; }

    // Update user tokens
    const users = loadUsers();
    const userEntry = Object.values(users).find(u => u.userId === pay.userId);
    if (!userEntry) { await safeSend(jid, { text: `❌ User \`${pay.userId}\` tidak ditemukan.` }); return; }

    userEntry.tokens = (userEntry.tokens || 0) + tokensToAdd;
    if (!userEntry.tokenHistory) userEntry.tokenHistory = [];
    userEntry.tokenHistory.unshift({
      type: 'topup', amount: tokensToAdd, priceIdr: pay.amount, ts: Date.now(),
      ref: payId, approvedBy: userId
    });
    saveUsers(users);

    payments[idx].status      = 'approved';
    payments[idx].approvedAt  = Date.now();
    payments[idx].approvedBy  = userId;
    payments[idx].tokensAdded = tokensToAdd;
    savePayments(payments);

    await safeSend(jid, {
      text: `✅ *Topup Approved!*\n\nID: \`${payId}\`\nBuyer: ${pay.email}\nAmount: Rp ${fmtNum(pay.amount)}\nToken ditambahkan: ${fmtNum(tokensToAdd)}\nSaldo baru: ${fmtNum(userEntry.tokens)} token`
    });

    try {
      if (pay.buyerWaNumber) {
        await sock.sendMessage(`${pay.buyerWaNumber}@s.whatsapp.net`, {
          text: `🎉 *Topup Berhasil!*\n\nID: \`${payId}\`\nToken ditambahkan: +${fmtNum(tokensToAdd)}\nSaldo sekarang: ${fmtNum(userEntry.tokens)} token\n\nTerima kasih! 🚀`
        });
      }
    } catch(_){}
  }
};
