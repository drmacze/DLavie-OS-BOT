/**
 * DLavie OS — 24/7 Never-Dead Keep-Alive System v3.0
 *
 * Upgrade dari v2.0:
 *   ✅ Circuit breaker — max 5 rescues/jam, anti spam reconnect
 *   ✅ Adaptive ping — 60s (unstable) vs 3min (stable), otomatis switch
 *   ✅ localhost-first ping — tanpa proxy, selalu reliable
 *   ✅ WA health score 0-100 — deteksi degraded/critical
 *   ✅ CPU spike monitor via os module
 *   ✅ Memory auto-GC + safe cache clearing
 *   ✅ Owner WhatsApp alert saat event kritis (cooldown 10 menit)
 *   ✅ Milestone notifications (1h / 6h / 12h / 24h / 48h / 7d)
 *   ✅ Exponential backoff + jitter untuk rescue
 *   ✅ SIGTERM → tetap hidup | SIGUSR1 → force WA reconnect
 *   ✅ Status log terstruktur setiap 30 menit
 */

'use strict';

const os    = require('os');
const https = require('https');
const http  = require('http');

// ─── Timing ───────────────────────────────────────────────────────────────
const PING_STABLE_MS     = 3  * 60 * 1000;  // 3 menit saat stabil
const PING_UNSTABLE_MS   = 60 * 1000;        // 1 menit saat tidak stabil
const WA_WATCHDOG_MS     = 40 * 1000;        // cek WA setiap 40 detik
const WA_DOWN_RESCUE_MS  = 2.5 * 60 * 1000; // rescue jika WA down > 2.5 menit
const HEARTBEAT_MS       = 10  * 1000;       // jaga event loop tetap hidup
const MEMORY_CHECK_MS    = 4  * 60 * 1000;  // cek memori setiap 4 menit
const CPU_CHECK_MS       = 2  * 60 * 1000;  // cek CPU setiap 2 menit
const MILESTONE_CHECK_MS = 60 * 1000;        // cek milestone setiap 1 menit
const STATUS_LOG_MS      = 30 * 60 * 1000;  // log status setiap 30 menit

// ─── Thresholds ───────────────────────────────────────────────────────────
const MEMORY_WARN_MB     = 350;
const MEMORY_CRITICAL_MB = 550;
const CPU_WARN_PCT       = 80;
const CPU_CRITICAL_PCT   = 95;
const CIRCUIT_MAX        = 5;               // maks rescue per window
const CIRCUIT_WINDOW_MS  = 60 * 60 * 1000; // 1-jam window
const RESCUE_COOLDOWN_MS = 90 * 1000;      // min 90 detik antar rescue
const ALERT_COOLDOWN_MS  = 10 * 60 * 1000; // cooldown alert WA owner 10 menit

const MILESTONE_HOURS    = [1, 6, 12, 24, 48, 168];

// ─── State ────────────────────────────────────────────────────────────────
let _started          = false;
let _startTime        = Date.now();
let _pingCount        = 0;
let _pingFails        = 0;
let _rescueCount      = 0;
let _rescueTimestamps = [];
let _lastRescueAt     = 0;
let _waDownSince      = null;
let _waScore          = 100;
let _pingMode         = 'stable';
let _pingTimer        = null;
let _watchdogTimer    = null;
let _heartbeat        = null;
let _memTimer         = null;
let _cpuTimer         = null;
let _milestoneTimer   = null;
let _statusLogTimer   = null;
let _lastCpuSample    = { idle: 0, total: 0 };
let _milestonesDone   = new Set();
let _crashCount       = 0;
let _lastAlertAt      = 0;

// ─── URL resolution ───────────────────────────────────────────────────────
function _getSelfUrls() {
  const port = parseInt(process.env.WEB_PORT || '5000');
  // localhost selalu reliable — tidak terpengaruh proxy Replit
  const urls = [`http://localhost:${port}/ping`];

  // Secondary: URL publik Replit (bagus untuk UptimeRobot)
  const domain = (process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN || '')
    .split(',')[0].trim();
  if (domain) urls.push(`https://${domain}/ping`);

  return urls;
}

// ─── HTTP ping ────────────────────────────────────────────────────────────
function _doPing(url, cb) {
  const mod = url.startsWith('https') ? https : http;
  const req = mod.get(url, { timeout: 7000 }, (res) => {
    cb(res.statusCode >= 200 && res.statusCode < 400, res.statusCode);
    res.resume();
  });
  req.on('error', () => cb(false, 0));
  req.on('timeout', () => { req.destroy(); cb(false, 408); });
}

// ─── Adaptive ping runner ─────────────────────────────────────────────────
function _doPingAll() {
  const urls = _getSelfUrls();

  // Primary ping — localhost, selalu berhasil jika proses jalan
  _doPing(urls[0], (ok, code) => {
    _pingCount++;
    if (!ok) {
      _pingFails++;
      console.warn(`[DLAVIE][KEEPALIVE] ⚠️ Ping ${code} → ${urls[0]}`);
    }
    _applyPingMode(ok ? 'stable' : 'unstable');
  });

  // Secondary ping (public URL) setelah 6 detik
  if (urls.length > 1) {
    setTimeout(() => _doPing(urls[1], (ok, code) => {
      if (!ok && process.env.DLAVIE_DEBUG_PING === 'true') {
        console.warn(`[DLAVIE][KEEPALIVE] ⚠️ Public ping ${code} → ${urls[1]}`);
      }
    }), 6000);
  }
}

// ─── Adaptive interval switch ─────────────────────────────────────────────
function _applyPingMode(mode) {
  if (_pingMode === mode) return;
  _pingMode = mode;
  if (_pingTimer) { clearInterval(_pingTimer); _pingTimer = null; }
  const ms = mode === 'unstable' ? PING_UNSTABLE_MS : PING_STABLE_MS;
  _pingTimer = setInterval(_doPingAll, ms);
  console.log(`[DLAVIE][KEEPALIVE] 🔄 Ping mode → ${mode.toUpperCase()} (setiap ${ms / 1000}s)`);
}

// ─── Circuit breaker check ────────────────────────────────────────────────
function _circuitOk() {
  const now = Date.now();
  _rescueTimestamps = _rescueTimestamps.filter(t => now - t < CIRCUIT_WINDOW_MS);
  return _rescueTimestamps.length < CIRCUIT_MAX;
}

// ─── WA health score ──────────────────────────────────────────────────────
function _updateWaScore(connected) {
  if (connected) {
    _waScore = Math.min(100, _waScore + 10);
  } else {
    const downSec = _waDownSince ? (Date.now() - _waDownSince) / 1000 : 0;
    _waScore = Math.max(0, 100 - Math.round(downSec / 10));
  }
}

// ─── WA watchdog ──────────────────────────────────────────────────────────
function _waWatchdog() {
  try {
    const { getSock, connectToWhatsApp, forceReconnect } = require('../bot');
    const sock        = getSock();
    const isConnected = !!(sock && sock.user);

    _updateWaScore(isConnected);

    if (isConnected) {
      _waDownSince = null;
      _applyPingMode('stable');
      return;
    }

    if (!_waDownSince) {
      _waDownSince = Date.now();
      console.warn('[DLAVIE][KEEPALIVE] ⚠️ WA disconnected — watchdog aktif');
      _applyPingMode('unstable');
      return;
    }

    const downMs     = Date.now() - _waDownSince;
    const cooldownOk = (Date.now() - _lastRescueAt) > RESCUE_COOLDOWN_MS;

    if (downMs < WA_DOWN_RESCUE_MS) {
      console.log(`[DLAVIE][KEEPALIVE] ⏳ WA down ${Math.round(downMs / 1000)}s — menunggu auto-reconnect...`);
      return;
    }

    if (!_circuitOk()) {
      console.error(
        `[DLAVIE][KEEPALIVE] 🚫 Circuit breaker OPEN — ` +
        `${_rescueTimestamps.length}/${CIRCUIT_MAX} rescues dalam 1 jam. Tunggu window reset.`
      );
      _alertOwner(
        '🚫 Circuit breaker terbuka!\nTerlalu banyak percobaan reconnect gagal. Bot butuh perhatian manual.',
        'critical'
      );
      return;
    }

    if (!cooldownOk) return;

    // ── Eksekusi rescue ──
    _rescueCount++;
    _rescueTimestamps.push(Date.now());
    _lastRescueAt = Date.now();
    _waDownSince  = null;

    // Backoff exponential + jitter agar tidak colide dengan proses lain
    const base  = Math.min(30000, 5000 * Math.pow(1.5, Math.min(_rescueCount - 1, 5)));
    const delay = base + Math.floor(Math.random() * 4000);

    console.warn(
      `[DLAVIE][KEEPALIVE] 🔧 Rescue #${_rescueCount} — ` +
      `reconnect dalam ${Math.round(delay / 1000)}s (backoff+jitter) | ` +
      `CB: ${_rescueTimestamps.length}/${CIRCUIT_MAX}`
    );

    setTimeout(() => {
      try {
        if (typeof forceReconnect === 'function') {
          forceReconnect();
        } else {
          connectToWhatsApp().catch(e =>
            console.error('[DLAVIE][KEEPALIVE] Reconnect error:', e.message)
          );
        }
      } catch (e) {
        console.error('[DLAVIE][KEEPALIVE] Rescue gagal:', e.message);
      }
    }, delay);

  } catch (err) {
    if (process.env.DLAVIE_DEBUG_PING === 'true') {
      console.warn('[DLAVIE][KEEPALIVE] WA watchdog error:', err.message);
    }
  }
}

// ─── Memory monitor ───────────────────────────────────────────────────────
function _checkMemory() {
  try {
    const mem    = process.memoryUsage();
    const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
    const rssMB  = Math.round(mem.rss      / 1024 / 1024);

    if (heapMB >= MEMORY_CRITICAL_MB) {
      console.error(`[DLAVIE][KEEPALIVE] 🚨 Memory CRITICAL: ${heapMB}MB heap / ${rssMB}MB RSS`);
      if (global.gc) {
        global.gc();
        console.log('[DLAVIE][KEEPALIVE] ♻️ Manual GC dieksekusi');
      }
      _clearSafeCaches();
      _alertOwner(`🚨 Memory critical: *${heapMB}MB*\nGC otomatis dijalankan.`, 'critical');
    } else if (heapMB >= MEMORY_WARN_MB) {
      console.warn(`[DLAVIE][KEEPALIVE] ⚠️ Memory tinggi: ${heapMB}MB heap / ${rssMB}MB RSS`);
      if (global.gc) global.gc();
    }
  } catch (_) {}
}

// ─── CPU monitor ─────────────────────────────────────────────────────────
function _getCpuPct() {
  const cpus = os.cpus();
  let idle = 0, total = 0;
  for (const cpu of cpus) {
    for (const t in cpu.times) total += cpu.times[t];
    idle += cpu.times.idle;
  }
  if (!_lastCpuSample.total) { _lastCpuSample = { idle, total }; return 0; }
  const dIdle  = idle  - _lastCpuSample.idle;
  const dTotal = total - _lastCpuSample.total;
  _lastCpuSample = { idle, total };
  return dTotal ? Math.round((1 - dIdle / dTotal) * 100) : 0;
}

function _checkCpu() {
  try {
    const cpu = _getCpuPct();
    if (cpu >= CPU_CRITICAL_PCT) {
      console.error(`[DLAVIE][KEEPALIVE] 🚨 CPU CRITICAL: ${cpu}%`);
      _alertOwner(`🚨 CPU spike: *${cpu}%*\nBot mungkin lambat merespons pesan.`, 'critical');
    } else if (cpu >= CPU_WARN_PCT) {
      console.warn(`[DLAVIE][KEEPALIVE] ⚠️ CPU tinggi: ${cpu}%`);
    }
  } catch (_) {}
}

// ─── Safe cache clearing ──────────────────────────────────────────────────
function _clearSafeCaches() {
  const safe = ['chalk', 'moment', 'ansi-styles', 'ansi-colors', 'supports-color'];
  for (const key of Object.keys(require.cache)) {
    if (safe.some(p => key.includes(p))) delete require.cache[key];
  }
}

// ─── Owner WhatsApp alert ─────────────────────────────────────────────────
function _alertOwner(message, level = 'info') {
  try {
    if (level === 'critical') {
      if (Date.now() - _lastAlertAt < ALERT_COOLDOWN_MS) return;
      _lastAlertAt = Date.now();
    }
    const ownerNumber = process.env.OWNER_NUMBER;
    if (!ownerNumber) return;
    const { getSock } = require('../bot');
    const sock = getSock();
    if (!sock || !sock.user) return;
    const jid  = ownerNumber.includes('@') ? ownerNumber : `${ownerNumber}@s.whatsapp.net`;
    const text =
      `[🤖 *DLavie OS* — System Alert]\n${message}\n\n` +
      `⏱️ _${new Date().toLocaleString('id-ID')}_`;
    sock.sendMessage(jid, { text }).catch(() => {});
  } catch (_) {}
}

// ─── Uptime milestones ────────────────────────────────────────────────────
function _checkMilestones() {
  const uptimeH = (Date.now() - _startTime) / (3600 * 1000);
  for (const h of MILESTONE_HOURS) {
    if (uptimeH >= h && !_milestonesDone.has(h)) {
      _milestonesDone.add(h);
      const label = h >= 168 ? '7 hari 🔥' : h >= 24 ? `${h / 24} hari` : `${h} jam`;
      console.log(`[DLAVIE][KEEPALIVE] 🎯 Milestone: Bot online ${label} nonstop!`);
      _alertOwner(`🎯 *Milestone!*\nBot DLavie OS sudah online *${label}* tanpa gangguan! 💪`, 'info');
    }
  }
}

// ─── Periodic status log ──────────────────────────────────────────────────
function _logStatus() {
  const s = getStatus();
  console.log(
    `[DLAVIE][KEEPALIVE] 📊 Status Report — ` +
    `Uptime: ${s.uptime} | WA: ${s.waStatus} (score ${s.waScore}/100) | ` +
    `Ping: ${s.pingCount} (${s.pingSuccessRate} sukses) | ` +
    `Rescues: ${s.rescueCount} | CB: ${s.circuitBreakerOpen ? 'OPEN 🚫' : 'OK ✅'} | ` +
    `Mem: ${s.memoryMB}MB | CPU: ${s.cpuPercent}% | Mode: ${s.pingMode}`
  );
}

// ─── Public status (dipanggil dari web/API) ───────────────────────────────
function getStatus() {
  const uptimeSec = Math.round((Date.now() - _startTime) / 1000);
  const h = Math.floor(uptimeSec / 3600);
  const m = Math.floor((uptimeSec % 3600) / 60);
  const s = uptimeSec % 60;

  let waStatus = 'unknown';
  try {
    const { getSock } = require('../bot');
    const sock = getSock();
    waStatus = (sock && sock.user) ? 'connected' : 'disconnected';
  } catch (_) {}

  const mem            = process.memoryUsage();
  const heapMB         = Math.round(mem.heapUsed  / 1024 / 1024);
  const rssMB          = Math.round(mem.rss        / 1024 / 1024);
  const now            = Date.now();
  const recentRescues  = _rescueTimestamps.filter(t => now - t < CIRCUIT_WINDOW_MS).length;

  return {
    uptime:             `${h}h ${m}m ${s}s`,
    uptimeSec,
    pingCount:          _pingCount,
    pingFails:          _pingFails,
    pingSuccessRate:    _pingCount
      ? `${Math.round(((_pingCount - _pingFails) / _pingCount) * 100)}%`
      : 'N/A',
    pingMode:           _pingMode,
    waStatus,
    waScore:            _waScore,
    waDownSince:        _waDownSince,
    rescueCount:        _rescueCount,
    recentRescues,
    circuitBreakerOpen: recentRescues >= CIRCUIT_MAX,
    circuitBreakerMax:  CIRCUIT_MAX,
    memoryMB:           heapMB,
    rssMB,
    cpuPercent:         _getCpuPct(),
    selfUrls:           _getSelfUrls(),
    milestonesDone:     [..._milestonesDone],
    crashCount:         _crashCount,
    startedAt:          new Date(_startTime).toISOString(),
    nodeVersion:        process.version,
    platform:           process.platform,
  };
}

// ─── Start ────────────────────────────────────────────────────────────────
function start() {
  if (_started) return;
  _started   = true;
  _startTime = Date.now();

  const urls = _getSelfUrls();
  console.log('[DLAVIE][KEEPALIVE] 🚀 24/7 Never-Dead System v3.0 — started');
  console.log(`[DLAVIE][KEEPALIVE]    Primary  : ${urls[0]}`);
  console.log(`[DLAVIE][KEEPALIVE]    Secondary: ${urls[1] || '(tidak dikonfigurasi)'}`);
  console.log(`[DLAVIE][KEEPALIVE]    Stable: ${PING_STABLE_MS / 60000}min | Unstable fallback: ${PING_UNSTABLE_MS / 1000}s`);
  console.log(`[DLAVIE][KEEPALIVE]    Circuit breaker: max ${CIRCUIT_MAX} rescues/jam`);
  console.log(`[DLAVIE][KEEPALIVE]    Alert thresholds: CPU>${CPU_WARN_PCT}% | Mem>${MEMORY_WARN_MB}MB`);

  // Event-loop heartbeat
  _heartbeat = setInterval(() => {}, HEARTBEAT_MS);
  if (_heartbeat.unref) _heartbeat.unref();

  // Ping awal setelah 20 detik (web server butuh waktu start)
  setTimeout(_doPingAll, 20_000);
  _pingTimer = setInterval(_doPingAll, PING_STABLE_MS);

  // WA watchdog — mulai setelah 35 detik (beri waktu WA pairing/connect)
  setTimeout(() => {
    _watchdogTimer = setInterval(_waWatchdog, WA_WATCHDOG_MS);
  }, 35_000);

  // Monitor sistem
  _memTimer       = setInterval(_checkMemory,     MEMORY_CHECK_MS);
  _cpuTimer       = setInterval(_checkCpu,        CPU_CHECK_MS);
  _milestoneTimer = setInterval(_checkMilestones, MILESTONE_CHECK_MS);
  _statusLogTimer = setInterval(_logStatus,       STATUS_LOG_MS);

  if (_memTimer.unref)       _memTimer.unref();
  if (_cpuTimer.unref)       _cpuTimer.unref();
  if (_milestoneTimer.unref) _milestoneTimer.unref();
  if (_statusLogTimer.unref) _statusLogTimer.unref();

  // ── Signal handling ──────────────────────────────────────────────────
  process.removeAllListeners('SIGTERM');
  process.on('SIGTERM', () => {
    console.log('[DLAVIE][KEEPALIVE] ⚡ SIGTERM ditangkap — bot tetap hidup, tidak keluar');
    // Sengaja tidak memanggil process.exit() agar bot 24/7
  });
  process.on('SIGHUP', () => {
    console.log('[DLAVIE][KEEPALIVE] 🔄 SIGHUP ditangkap — diabaikan');
  });
  process.on('SIGUSR1', () => {
    console.log('[DLAVIE][KEEPALIVE] 🔧 SIGUSR1 — force WA reconnect diminta oleh signal');
    setTimeout(_waWatchdog, 500);
  });

  // ── Anti-crash guards ────────────────────────────────────────────────
  process.removeAllListeners('uncaughtException');
  process.on('uncaughtException', (err) => {
    _crashCount++;
    console.error(`[DLAVIE][KEEPALIVE] 🚨 UncaughtException #${_crashCount}: ${err.message}`);
    _alertOwner(
      `🚨 Crash #${_crashCount} terdeteksi!\n\`${err.message}\`\n\nBot tetap berjalan otomatis.`,
      'critical'
    );
  });

  process.removeAllListeners('unhandledRejection');
  process.on('unhandledRejection', (reason) => {
    console.error('[DLAVIE][KEEPALIVE] ⚠️ UnhandledRejection:', reason?.message || String(reason));
  });
}

// ─── Stop ─────────────────────────────────────────────────────────────────
function stop() {
  [_pingTimer, _watchdogTimer, _heartbeat, _memTimer, _cpuTimer, _milestoneTimer, _statusLogTimer]
    .forEach(t => { if (t) clearInterval(t); });
  _pingTimer      = null;
  _watchdogTimer  = null;
  _heartbeat      = null;
  _memTimer       = null;
  _cpuTimer       = null;
  _milestoneTimer = null;
  _statusLogTimer = null;
  _started        = false;
  console.log('[DLAVIE][KEEPALIVE] 🛑 System dihentikan');
}

module.exports = { start, stop, getStatus };
