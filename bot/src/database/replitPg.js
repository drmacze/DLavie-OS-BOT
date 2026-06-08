/**
 * DLavie OS - Replit PostgreSQL Database Adapter
 * Replaces Supabase with Replit's built-in PostgreSQL database.
 */

const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.warn('[DLAVIE][DB] DATABASE_URL not set. PostgreSQL database not available.');
      return null;
    }
    pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    pool.on('error', (err) => {
      console.error('[DLAVIE][DB] Unexpected PostgreSQL error:', err.message);
    });
  }
  return pool;
}

function isConnected() {
  return Boolean(process.env.DATABASE_URL);
}

async function query(sql, params = []) {
  const client = getPool();
  if (!client) return { rows: [], error: 'Database not connected' };
  try {
    const result = await client.query(sql, params);
    return { rows: result.rows, error: null };
  } catch (err) {
    console.error('[DLAVIE][DB] Query error:', err.message);
    return { rows: [], error: err.message };
  }
}

async function getUserById(id) {
  const result = await query('SELECT * FROM dlavie_users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function getUserByPhone(phone) {
  const result = await query('SELECT * FROM dlavie_users WHERE phone_number = $1', [phone]);
  return result.rows[0] || null;
}

async function createUser(phone, email, name, role = 'USER') {
  const result = await query(
    `INSERT INTO dlavie_users (phone_number, email, name, role, tokens, total_earned)
     VALUES ($1, $2, $3, $4, 5000, 5000)
     RETURNING *`,
    [phone, email, name, role]
  );
  return result.rows[0] || null;
}

async function updateUserTokens(id, newTokens) {
  const result = await query(
    'UPDATE dlavie_users SET tokens = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [newTokens, id]
  );
  return result.rows[0] || null;
}

async function addTransaction(userId, type, amount, feature, reason, balanceAfter) {
  const result = await query(
    `INSERT INTO dlavie_transactions (user_id, type, amount, feature, reason, balance_after)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, type, amount, feature, reason, balanceAfter]
  );
  return result.rows[0] || null;
}

async function getTransactions(userId, limit = 50) {
  const result = await query(
    `SELECT * FROM dlavie_transactions WHERE user_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

async function addAuditLog(action, userId, details, severity = 'info', ip = 'unknown') {
  const result = await query(
    `INSERT INTO dlavie_audit_logs (action, user_id, details, severity, ip)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [action, userId, JSON.stringify(details), severity, ip]
  );
  return result.rows[0] || null;
}

async function getAuditLogs(userId, limit = 50) {
  const result = await query(
    `SELECT * FROM dlavie_audit_logs WHERE user_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

async function addError(hash, errorText, stack, severity, source) {
  const existing = await query('SELECT * FROM dlavie_errors WHERE hash = $1', [hash]);
  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    await query(
      `UPDATE dlavie_errors
       SET count = count + 1, last_seen = NOW(), error_text = $2, stack = $3
       WHERE id = $1`,
      [row.id, errorText, stack]
    );
    return row;
  }
  const result = await query(
    `INSERT INTO dlavie_errors (hash, error_text, stack, severity, source)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [hash, errorText, stack, severity, source]
  );
  return result.rows[0] || null;
}

async function getErrors(limit = 50) {
  const result = await query(
    `SELECT * FROM dlavie_errors WHERE resolved = false
     ORDER BY count DESC, last_seen DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function resolveError(id) {
  const result = await query(
    'UPDATE dlavie_errors SET resolved = true WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows[0] || null;
}

async function registerBot(token, name, phoneNumber, ownerId, metadata = {}) {
  const result = await query(
    `INSERT INTO dlavie_bots (token, name, phone_number, owner_id, status, connected_at, metadata)
     VALUES ($1, $2, $3, $4, 'connecting', NOW(), $5)
     ON CONFLICT (token) DO UPDATE SET
       name = EXCLUDED.name,
       phone_number = EXCLUDED.phone_number,
       owner_id = EXCLUDED.owner_id,
       status = 'connecting',
       connected_at = NOW(),
       metadata = EXCLUDED.metadata
     RETURNING *`,
    [token, name, phoneNumber, ownerId, JSON.stringify(metadata)]
  );
  return result.rows[0] || null;
}

async function getBotByToken(token) {
  const result = await query('SELECT * FROM dlavie_bots WHERE token = $1', [token]);
  return result.rows[0] || null;
}

async function getBotsByOwner(ownerId) {
  const result = await query(
    'SELECT * FROM dlavie_bots WHERE owner_id = $1 ORDER BY created_at DESC',
    [ownerId]
  );
  return result.rows;
}

async function updateBotStatus(token, status, healthScore = null) {
  const params = [status, token];
  let sql = `UPDATE dlavie_bots SET status = $1, last_heartbeat = NOW() WHERE token = $2 RETURNING *`;
  if (healthScore !== null) {
    sql = `UPDATE dlavie_bots SET status = $1, health_score = $2, last_heartbeat = NOW() WHERE token = $3 RETURNING *`;
    params.splice(1, 0, healthScore);
  }
  const result = await query(sql, params);
  return result.rows[0] || null;
}

async function getBotCount() {
  const result = await query('SELECT COUNT(*) as count FROM dlavie_bots');
  return parseInt(result.rows[0]?.count || 0);
}

async function getOnlineBotCount() {
  const result = await query(`SELECT COUNT(*) as count FROM dlavie_bots WHERE status = 'online'`);
  return parseInt(result.rows[0]?.count || 0);
}

async function getHealthStats() {
  const result = await query(
    `SELECT COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'online') as online,
            AVG(health_score) as avg_health
     FROM dlavie_bots`
  );
  return result.rows[0] || { total: 0, online: 0, avg_health: 0 };
}

async function getDashboardStats() {
  const users = await query('SELECT COUNT(*) as count FROM dlavie_users');
  const bots = await getHealthStats();
  const transactions = await query('SELECT COUNT(*) as count FROM dlavie_transactions');
  const errors = await query('SELECT COUNT(*) as count FROM dlavie_errors WHERE resolved = false');
  return {
    totalUsers: parseInt(users.rows[0]?.count || 0),
    totalBots: parseInt(bots.total || 0),
    onlineBots: parseInt(bots.online || 0),
    avgHealth: Math.round(bots.avg_health || 0),
    totalTransactions: parseInt(transactions.rows[0]?.count || 0),
    unresolvedErrors: parseInt(errors.rows[0]?.count || 0),
  };
}

// ─── Payment helpers ───
async function createPayment({ strukId, userEmail, waUserId, type, plan, amount, amountTokens, nama, metadata }) {
  const result = await query(
    `INSERT INTO dlavie_payments (struk_id, user_email, wa_user_id, type, plan, amount, amount_tokens, nama, metadata, expired_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() + INTERVAL '5 minutes')
     RETURNING *`,
    [strukId, userEmail, waUserId, type, plan || null, amount, amountTokens || null, nama || null, JSON.stringify(metadata || {})]
  );
  return result.rows[0] || null;
}

async function getPaymentByStrukId(strukId) {
  const result = await query('SELECT * FROM dlavie_payments WHERE struk_id = $1', [strukId]);
  return result.rows[0] || null;
}

async function getPaymentsByUser(email, limit = 20) {
  const result = await query(
    `SELECT * FROM dlavie_payments WHERE user_email = $1 ORDER BY created_at DESC LIMIT $2`,
    [email, limit]
  );
  return result.rows;
}

async function getPendingPayments() {
  const result = await query(
    `SELECT * FROM dlavie_payments WHERE status = 'pending' AND expired_at > NOW() ORDER BY created_at DESC`
  );
  return result.rows;
}

async function updatePaymentProof(strukId, proofUrl) {
  const result = await query(
    `UPDATE dlavie_payments SET proof_url = $1, status = 'paid', paid_at = NOW(), updated_at = NOW()
     WHERE struk_id = $2 AND status = 'pending' RETURNING *`,
    [proofUrl, strukId]
  );
  return result.rows[0] || null;
}

async function approvePayment(strukId, approvedBy, amountTokens, newPlan) {
  const result = await query(
    `UPDATE dlavie_payments SET
       status = 'approved', approved_at = NOW(), approved_by = $2, amount_tokens = $3, plan = $4, updated_at = NOW()
     WHERE struk_id = $1 RETURNING *`,
    [strukId, approvedBy, amountTokens, newPlan || null]
  );
  return result.rows[0] || null;
}

async function rejectPayment(strukId, approvedBy, reason) {
  const result = await query(
    `UPDATE dlavie_payments SET
       status = 'rejected', rejected_at = NOW(), reject_reason = $3, updated_at = NOW()
     WHERE struk_id = $1 RETURNING *`,
    [strukId, reason]
  );
  return result.rows[0] || null;
}

module.exports = {
  getPool,
  isConnected,
  query,
  getUserById,
  getUserByPhone,
  createUser,
  updateUserTokens,
  addTransaction,
  getTransactions,
  addAuditLog,
  getAuditLogs,
  addError,
  getErrors,
  resolveError,
  registerBot,
  getBotByToken,
  getBotsByOwner,
  updateBotStatus,
  getBotCount,
  getOnlineBotCount,
  getHealthStats,
  getDashboardStats,
  createPayment,
  getPaymentByStrukId,
  getPaymentsByUser,
  getPendingPayments,
  updatePaymentProof,
  approvePayment,
  rejectPayment,
};
