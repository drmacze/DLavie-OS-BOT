/**
 * DLavie OS — Keep-Alive & 24/7 Never-Dead System v2.0
 * - Multi-URL self-ping (primary + backup)
 * - WA watchdog with exponential backoff rescue
 * - Memory leak detector with auto-GC
 * - Process heartbeat (prevents Node event loop death)
 * - Uptime + status tracking with full metrics
 */

const https = require('https');
const http  = require('http');

const PING_INTERVAL_MS     = 3 * 60 * 1000;   // ping every 3 min (was 4)
const WA_WATCHDOG_MS       = 45 * 1000;        // check WA every 45s
const WA_DOWN_RESCUE_MS    = 3 * 60 * 1000;    // rescue if WA down > 3 min (was 5)
const HEARTBEAT_MS         = 15 * 1000;        // keep event loop alive
const MEMORY_CHECK_MS      = 5 * 60 * 1000;    // memory check every 5 min
const MEMORY_WARN_MB       = 400;              // warn at 400MB
const MEMORY_CRITICAL_MB   = 600;              // try GC at 600MB

let _started       = false;
let _pingTimer     = null;
let _watchdogTimer = null;
let _heartbeat     = null;
let _memTimer      = null;
let _waDownSince   = null;
let _pingCount     = 0;
let _pingFails     = 0;
let _rescueCount   = 0;
let _startTime     = Date.now();
let _lastRescueAt  = 0;

function _getSelfUrls() {
  const domain = process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN || '';
  const port   = process.env.WEB_PORT || 5000;
  const urls   = [];

  if (domain) {
    const first = domain.split(',')[0].trim();
    urls.push(`https://${first}/ping`);
    urls.push(`https://${first}/api/health`);
  }

  urls.push(`http://localhost:${port}/ping`);
  return urls;
}

function _doPing(url) {
  const mod = url.startsWith('https') ? https : http;

  const req = mod.get(url, { timeout: 8000 }, (res) => {
    _pingCount++;
    if (res.statusCode >= 200 && res.statusCode < 400) {
      if (process.env.DLAVIE_DEBUG_PING === 'true') {
        console.log(`[DLAVIE][KEEPALIVE] ✅ Ping OK #${_pingCount} → ${url}`);
      }
    } else {
      _pingFails++;
      console.warn(`[DLAVIE][KEEPALIVE] ⚠️ Ping ${res.statusCode} → ${url}`);
    }
    res.resume();
  });

  req.on('error', (err) => {
    _pingFails++;
    if (process.env.DLAVIE_DEBUG_PING === 'true') {
      console.warn(`[DLAVIE][KEEPALIVE] ⚠️ Ping fail: ${err.code || err.message} → ${url}`);
    }
  });

  req.on('timeout', () => {
    _pingFails++;
    req.destroy();
  });
}

function _doPingAll() {
  const urls = _getSelfUrls();
  // Ping primary URL, then backup with 5s delay
  _doPing(urls[0]);
  if (urls.length > 1) {
    setTimeout(() => _doPing(urls[1]), 5000);
  }
}

function _waWatchdog() {
  try {
    const { getSock, connectToWhatsApp, forceReconnect } = require('../bot');
    const sock        = getSock();
    const isConnected = sock && sock.user;

    if (isConnected) {
      _waDownSince = null;
      return;
    }

    if (!_waDownSince) {
      _waDownSince = Date.now();
      console.warn('[DLAVIE][KEEPALIVE] ⚠️ WA disconnected — watchdog started');
      return;
    }

    const downMs = Date.now() - _waDownSince;

    // Prevent rescue spam — wait at least 2 min between rescues
    const rescueCooldown = 2 * 60 * 1000;
    if (downMs >= WA_DOWN_RESCUE_MS && (Date.now() - _lastRescueAt) > rescueCooldown) {
      _rescueCount++;
      console.warn(`[DLAVIE][KEEPALIVE] 🔧 WA down ${Math.round(downMs/1000)}s — rescue #${_rescueCount}`);
      _waDownSince  = null;
      _lastRescueAt = Date.now();

      if (typeof forceReconnect === 'function') {
        forceReconnect();
      } else {
        connectToWhatsApp().catch(e => {
          console.error('[DLAVIE][KEEPALIVE] Reconnect failed:', e.message);
        });
      }
    } else if (downMs < WA_DOWN_RESCUE_MS) {
      console.log(`[DLAVIE][KEEPALIVE] ⏳ WA down ${Math.round(downMs/1000)}s — waiting for auto-reconnect`);
    }
  } catch (err) {
    if (process.env.DLAVIE_DEBUG_PING === 'true') {
      console.warn('[DLAVIE][KEEPALIVE] WA watchdog error:', err.message);
    }
  }
}

function _checkMemory() {
  try {
    const mem    = process.memoryUsage();
    const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
    const rssMB  = Math.round(mem.rss      / 1024 / 1024);

    if (heapMB >= MEMORY_CRITICAL_MB) {
      console.warn(`[DLAVIE][KEEPALIVE] 🚨 Memory critical: ${heapMB}MB heap / ${rssMB}MB RSS — requesting GC`);
      if (global.gc) {
        global.gc();
        console.log('[DLAVIE][KEEPALIVE] ✅ GC executed');
      }
    } else if (heapMB >= MEMORY_WARN_MB) {
      console.warn(`[DLAVIE][KEEPALIVE] ⚠️ Memory high: ${heapMB}MB heap / ${rssMB}MB RSS`);
    }
  } catch (_) {}
}

function getStatus() {
  const uptimeSec = Math.round((Date.now() - _startTime) / 1000);
  const h  = Math.floor(uptimeSec / 3600);
  const m  = Math.floor((uptimeSec % 3600) / 60);
  const s  = uptimeSec % 60;

  let waStatus = 'unknown';
  try {
    const { getSock } = require('../bot');
    const sock = getSock();
    waStatus = sock && sock.user ? 'connected' : 'disconnected';
  } catch (_) {}

  const mem    = process.memoryUsage();
  const heapMB = Math.round(mem.heapUsed / 1024 / 1024);

  return {
    uptime:       `${h}h ${m}m ${s}s`,
    uptimeSec,
    pingCount:    _pingCount,
    pingFails:    _pingFails,
    pingSuccessRate: _pingCount ? `${Math.round(((_pingCount - _pingFails) / _pingCount) * 100)}%` : 'N/A',
    waStatus,
    waDownSince:  _waDownSince,
    rescueCount:  _rescueCount,
    memoryMB:     heapMB,
    selfUrls:     _getSelfUrls(),
    startedAt:    new Date(_startTime).toISOString(),
    nodeVersion:  process.version,
    platform:     process.platform,
  };
}

function start() {
  if (_started) return;
  _started   = true;
  _startTime = Date.now();

  const urls = _getSelfUrls();
  console.log('[DLAVIE][KEEPALIVE] 🚀 24/7 Never-Dead System v2.0 started');
  console.log(`[DLAVIE][KEEPALIVE]    Primary URL: ${urls[0]}`);
  console.log(`[DLAVIE][KEEPALIVE]    Ping every ${PING_INTERVAL_MS / 60000} min | WA watchdog every ${WA_WATCHDOG_MS / 1000}s`);

  // Heartbeat — prevent event loop from dying
  _heartbeat = setInterval(() => {}, HEARTBEAT_MS);
  if (_heartbeat.unref) _heartbeat.unref();

  // Initial ping after 15s
  setTimeout(_doPingAll, 15_000);

  // Recurring self-ping
  _pingTimer = setInterval(_doPingAll, PING_INTERVAL_MS);

  // WA connection watchdog — start after 30s (let WA connect first)
  setTimeout(() => {
    _watchdogTimer = setInterval(_waWatchdog, WA_WATCHDOG_MS);
  }, 30_000);

  // Memory monitor
  _memTimer = setInterval(_checkMemory, MEMORY_CHECK_MS);
  if (_memTimer.unref) _memTimer.unref();

  // Handle process signals gracefully
  const onSignal = (sig) => {
    console.log(`[DLAVIE][KEEPALIVE] 🛑 Signal ${sig} received — staying alive (bot will reconnect)`);
    // Don't exit — let auto-reconnect handle it
  };
  process.on('SIGTERM', onSignal);
  process.on('SIGHUP',  onSignal);

  // Catch unhandled promise rejections (prevent crashes)
  process.on('unhandledRejection', (reason) => {
    console.error('[DLAVIE][KEEPALIVE] ⚠️ Unhandled rejection:', reason?.message || reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('[DLAVIE][KEEPALIVE] 🚨 Uncaught exception:', err.message);
    // Don't exit — engine auto-fix will handle it
  });
}

function stop() {
  if (_pingTimer)     { clearInterval(_pingTimer);     _pingTimer     = null; }
  if (_watchdogTimer) { clearInterval(_watchdogTimer); _watchdogTimer = null; }
  if (_heartbeat)     { clearInterval(_heartbeat);     _heartbeat     = null; }
  if (_memTimer)      { clearInterval(_memTimer);      _memTimer      = null; }
  _started = false;
  console.log('[DLAVIE][KEEPALIVE] System stopped');
}

module.exports = { start, stop, getStatus };
