/**
 * DLavie OS — Payment Engine v2.1
 * ID: DLAVIE-PAY-ENGINE-001
 * Sistem pembayaran QRIS manual: top-up token & plan upgrade
 * Fixed: update dlavie_web_users (not dlavie_users), sync web session + token engine
 */

'use strict';

const { getSock } = require('../bot');
const {
  isConnected: isPgConnected,
  createPayment,
  getPaymentByStrukId,
  updatePaymentProof,
  approvePayment,
  rejectPayment,
  getPendingPayments,
  getPaymentsByUser,
  query,
  getPool,
} = require('../database/replitPg');

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROOFS_DIR = path.join(__dirname, '../../uploads/proofs');
if (!fs.existsSync(PROOFS_DIR)) fs.mkdirSync(PROOFS_DIR, { recursive: true });

const pendingNotifications = [];
setInterval(() => flushNotifications(), 2000);

function generateStrukId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `DLV-${date}-${random}`;
}

async function createPaymentTx({ userEmail, waUserId, type, plan, amount, amountTokens, nama }) {
  const strukId = generateStrukId();
  const tx = await createPayment({
    strukId, userEmail, waUserId, type, plan, amount, amountTokens, nama,
    metadata: { paymentMethod: 'qris', requestedAt: Date.now() },
  });
  return tx;
}

async function uploadProof(strukId, fileBuffer, originalName, mimeType) {
  const tx = await getPaymentByStrukId(strukId);
  if (!tx) return { error: 'Struk tidak ditemukan' };
  if (tx.status !== 'pending') return { error: 'Struk sudah tidak aktif' };
  if (new Date(tx.expired_at) < new Date()) return { error: 'Waktu pembayaran sudah habis' };

  const ext = path.extname(originalName) || '.jpg';
  const filename = `${strukId}${ext}`;
  const filepath = path.join(PROOFS_DIR, filename);
  fs.writeFileSync(filepath, fileBuffer);

  const updated = await updatePaymentProof(strukId, `/uploads/proofs/${filename}`);
  if (!updated) return { error: 'Gagal update bukti' };
  return { success: true, proofUrl: `/uploads/proofs/${filename}`, tx: updated };
}

function notifyOwner(strukId, type, amount, nama, email, plan) {
  pendingNotifications.push({ strukId, type, amount, nama, email, plan, ts: Date.now() });
}

async function flushNotifications() {
  while (pendingNotifications.length > 0) {
    const n = pendingNotifications.shift();
    const sock = getSock();
    if (!sock) continue;
    try {
      const ownerNum = process.env.OWNER_NUMBER;
      if (!ownerNum) continue;
      const ownerJid = `${ownerNum}@s.whatsapp.net`;
      const typeText = n.type === 'topup' ? 'Top Up Token' : `Upgrade Plan ${n.plan || ''}`;
      await sock.sendMessage(ownerJid, {
        text: `📢 *Pembayaran Masuk!*\n\n` +
              `📱 *Struk ID:* ${n.strukId}\n` +
              `👤 *Nama:* ${n.nama || '-'}\n` +
              `📧 *Email:* ${n.email}\n` +
              `💵 *Nominal:* Rp ${Number(n.amount).toLocaleString('id-ID')}\n` +
              `💳 *Tipe:* ${typeText}\n\n` +
              `*Perintah Owner:*\n` +
              `!approve ${n.strukId} <token/plan>\n` +
              `!reject ${n.strukId} <alasan>\n` +
              `!cekstruk ${n.strukId}`,
      });
    } catch (err) {
      console.error('[DLAVIE][PAY] Notify owner failed:', err.message);
    }
  }
}

/**
 * Owner approve top-up — update dlavie_web_users.tokens (authoritative)
 */
async function approveTopUp(strukId, approvedBy, tokenAmount) {
  const tx = await getPaymentByStrukId(strukId);
  if (!tx) return { error: 'Struk tidak ditemukan' };
  if (tx.status === 'approved') return { error: 'Sudah di-approve' };
  if (tx.status === 'rejected') return { error: 'Sudah di-reject' };

  const updated = await approvePayment(strukId, approvedBy, tokenAmount, null);
  if (!updated) return { error: 'Gagal approve di database' };

  const pool = getPool();
  if (pool && tx.user_email) {
    try {
      // Update dlavie_web_users (primary web user table)
      const res = await pool.query(
        `UPDATE dlavie_web_users SET tokens = COALESCE(tokens,0) + $1, updated_at = NOW()
         WHERE email = $2 RETURNING tokens`,
        [parseInt(tokenAmount), tx.user_email]
      );
      const newTokens = res.rows[0]?.tokens || 0;

      // Also add to token_history
      await pool.query(
        `UPDATE dlavie_web_users SET token_history = COALESCE(token_history,'[]'::jsonb) || $1::jsonb
         WHERE email = $2`,
        [JSON.stringify([{ type: 'topup', amount: tokenAmount, strukId, approvedAt: new Date().toISOString() }]),
         tx.user_email]
      );

      console.log(`[DLAVIE][PAY] Top-up approved: +${tokenAmount} tokens → ${tx.user_email} (total: ${newTokens})`);
    } catch (err) {
      console.error('[DLAVIE][PAY] Token update error:', err.message);
    }
  }

  // Sync active bot session token balance
  _syncBotSession(tx.user_email, tx.wa_user_id, null, null, tokenAmount);

  const sock = getSock();
  if (sock && tx.wa_user_id) {
    try {
      await sock.sendMessage(`${tx.wa_user_id}@s.whatsapp.net`, {
        text: `✅ *Pembayaran Diterima!*\n\n` +
              `📱 Struk: ${strukId}\n` +
              `🪙 Token masuk: *+${parseInt(tokenAmount).toLocaleString('id-ID')} token*\n` +
              `📁 Status: APPROVED\n\n` +
              `Cek saldo: ketik *!token*`,
      });
    } catch (_) {}
  }

  return { success: true, tx: updated };
}

/**
 * Owner approve plan upgrade — update dlavie_web_users.plan (authoritative)
 */
async function approvePlanUpgrade(strukId, approvedBy, newPlan) {
  const tx = await getPaymentByStrukId(strukId);
  if (!tx) return { error: 'Struk tidak ditemukan' };
  if (tx.status === 'approved') return { error: 'Sudah di-approve' };
  if (tx.status === 'rejected') return { error: 'Sudah di-reject' };

  const updated = await approvePayment(strukId, approvedBy, null, newPlan);
  if (!updated) return { error: 'Gagal approve di database' };

  const pool = getPool();
  if (pool && tx.user_email) {
    try {
      // Update dlavie_web_users.plan (authoritative)
      await pool.query(
        `UPDATE dlavie_web_users SET plan = $1, role = $1, updated_at = NOW() WHERE email = $2`,
        [newPlan, tx.user_email]
      );
      console.log(`[DLAVIE][PAY] Plan upgraded: ${tx.user_email} → ${newPlan}`);
    } catch (err) {
      console.error('[DLAVIE][PAY] Plan update error:', err.message);
    }
  }

  // Sync active bot session
  _syncBotSession(tx.user_email, tx.wa_user_id, newPlan, null, null);

  const sock = getSock();
  if (sock && tx.wa_user_id) {
    try {
      await sock.sendMessage(`${tx.wa_user_id}@s.whatsapp.net`, {
        text: `✅ *Plan Upgrade Diterima!*\n\n` +
              `📱 Struk: ${strukId}\n` +
              `📤 Plan baru: *${newPlan.toUpperCase()}*\n` +
              `📁 Status: APPROVED\n\n` +
              `Logout & login ulang untuk refresh akses.\nKetik *!logout* lalu *!login KODE_BARU*`,
      });
    } catch (_) {}
  }

  return { success: true, tx: updated };
}

/**
 * Sync bot session & token engine after approve
 */
function _syncBotSession(email, waUserId, newPlan, newRole, additionalTokens) {
  try {
    const { getWebAuth } = require('../auth/webAuth');
    const webAuth = getWebAuth();

    // Find session by email or waUserId
    const sessions = webAuth.getActiveSessions();
    for (const s of sessions) {
      if (s.email === email || s.waUserId === waUserId) {
        const session = webAuth.getSession(s.waUserId);
        if (session) {
          if (newPlan) { session.plan = newPlan; session.role = newRole || newPlan; }
          if (additionalTokens) { session.tokenBalance = (session.tokenBalance || 0) + parseInt(additionalTokens); }
          webAuth._saveSessions();

          // Sync token engine
          const { getEngine } = require('./engine');
          const tokenEngine = getEngine().getSystem('token');
          if (tokenEngine) {
            if (!tokenEngine.getAccount(s.waUserId)) tokenEngine.registerAccount(s.waUserId);
            if (additionalTokens && typeof tokenEngine.earn === 'function') {
              tokenEngine.earn(s.waUserId, parseInt(additionalTokens), 'topup_approved');
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[DLAVIE][PAY] Session sync error:', err.message);
  }
}

async function rejectPaymentTx(strukId, approvedBy, reason) {
  const tx = await getPaymentByStrukId(strukId);
  if (!tx) return { error: 'Struk tidak ditemukan' };

  const updated = await rejectPayment(strukId, approvedBy, reason);
  if (!updated) return { error: 'Gagal reject' };

  const sock = getSock();
  if (sock && tx.wa_user_id) {
    try {
      await sock.sendMessage(`${tx.wa_user_id}@s.whatsapp.net`, {
        text: `❌ *Pembayaran Ditolak*\n\n` +
              `📱 Struk: ${strukId}\n` +
              `👁 Alasan: ${reason || 'Tidak ada alasan'}\n\n` +
              `Coba lagi atau hubungi owner.`,
      });
    } catch (_) {}
  }

  return { success: true, tx: updated };
}

async function cekStruk(strukId) {
  const tx = await getPaymentByStrukId(strukId);
  if (!tx) return { error: 'Struk tidak ditemukan' };
  const typeText = tx.type === 'topup' ? 'Top Up Token' : `Upgrade Plan ${tx.plan || ''}`;
  const statusEmoji = tx.status === 'approved' ? '✅' : tx.status === 'rejected' ? '❌' : tx.status === 'paid' ? '⏳' : '⏰';
  return {
    success: true,
    info: {
      strukId: tx.struk_id, type: typeText, nama: tx.nama || '-', email: tx.user_email,
      amount: tx.amount, status: tx.status, statusEmoji, createdAt: tx.created_at,
      expiredAt: tx.expired_at, paidAt: tx.paid_at, approvedAt: tx.approved_at,
      approvedBy: tx.approved_by, rejectedAt: tx.rejected_at, rejectReason: tx.reject_reason,
      proofUrl: tx.proof_url, amountTokens: tx.amount_tokens, plan: tx.plan,
    },
  };
}

module.exports = {
  createPaymentTx, uploadProof, notifyOwner,
  approveTopUp, approvePlanUpgrade, rejectPaymentTx,
  cekStruk, getPendingPayments, getPaymentsByUser,
  getPaymentByStrukId, generateStrukId, PROOFS_DIR,
};
