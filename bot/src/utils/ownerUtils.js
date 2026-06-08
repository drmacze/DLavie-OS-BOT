/**
 * DLavie OS — Owner Utilities
 * Shared JID parsing + owner detection untuk semua commands dan engine.
 *
 * Root-cause fix:
 *   WA Business multi-device mengirim JID dengan device suffix :0 → strip dulu.
 *   isOwnerMsg juga cek session role='owner' via webAuth hook (tanpa circular dep).
 */

'use strict';

// Auto-owner emails: akun ini selalu mendapat hak owner di web dashboard
const AUTO_OWNER_EMAILS = ['dev@dlavie.com'];

// Hook ke webAuth (diset dari bot.js startup — hindari circular dependency)
let _webAuthGetter = null;
function setWebAuthGetter(fn) { _webAuthGetter = fn; }

/**
 * Parse WhatsApp JID menjadi nomor digit bersih.
 * Handles semua format Baileys multi-device:
 *   628XXXXXXXX@s.whatsapp.net
 *   628XXXXXXXX:0@s.whatsapp.net  ← WA Business device suffix
 *   120363XXXXXX@g.us             ← group JID
 */
function parseJid(jid) {
  return String(jid || '')
    .replace(/:\d+@/, '@')     // hapus device suffix :0, :1, dst SEBELUM @
    .replace(/@[^@]+$/, '')    // hapus @s.whatsapp.net, @g.us, dll
    .replace(/\D/g, '');       // digits only
}

/**
 * Normalisasi nomor HP ke format internasional (tanpa +).
 * 08XXXXXXXXX  → 628XXXXXXXXX  (Indonesia)
 * +628XXXXXXXX → 628XXXXXXXX
 */
function normalizeNumber(num) {
  let digits = String(num || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0') && digits.length >= 10 && digits.length <= 13) {
    digits = '62' + digits.slice(1);
  }
  return digits;
}

/**
 * Ambil nomor pengirim dari pesan Baileys.
 * - Group chat : pakai msg.key.participant
 * - Private DM : pakai msg.key.remoteJid
 */
function extractSenderNumber(msg) {
  const rawJid = msg?.key?.participant || msg?.key?.remoteJid || '';
  return parseJid(rawJid);
}

/**
 * Cek apakah email adalah auto-owner.
 */
function isAutoOwnerEmail(email) {
  return AUTO_OWNER_EMAILS.includes(String(email || '').toLowerCase().trim());
}

/**
 * Cek apakah userId (digits) cocok dengan ownerNumber.
 */
function isOwnerById(userId, ownerNum) {
  if (!ownerNum || !userId) return false;
  const sender = normalizeNumber(userId);
  const owner  = normalizeNumber(ownerNum);
  if (!sender || !owner) return false;
  return sender === owner ||
         sender.endsWith(owner) ||
         owner.endsWith(sender);
}

/**
 * Cek apakah pengirim pesan adalah owner.
 * Cek berurutan:
 *   1. WA number match dengan OWNER_NUMBER
 *   2. Session WA punya role='owner' (sudah login sebagai owner email)
 *   3. Session email ada di AUTO_OWNER_EMAILS
 *
 * @param {object} msg       - Pesan Baileys
 * @param {string} ownerNum  - config.ownerNumber (env OWNER_NUMBER)
 * @returns {boolean}
 */
function isOwnerMsg(msg, ownerNum) {
  const sender = extractSenderNumber(msg);

  // 1. WA number check
  if (ownerNum && isOwnerById(sender, ownerNum)) return true;

  // 2 & 3. Session role / email check via webAuth hook
  if (_webAuthGetter && sender) {
    try {
      const auth = _webAuthGetter();
      const session = auth?.getSession?.(sender);
      if (session?.role === 'owner') return true;
      if (session?.email && isAutoOwnerEmail(session.email)) return true;
    } catch (_) {}
  }

  return false;
}

module.exports = {
  parseJid,
  normalizeNumber,
  extractSenderNumber,
  isAutoOwnerEmail,
  isOwnerById,
  isOwnerMsg,
  setWebAuthGetter,
  AUTO_OWNER_EMAILS,
};
