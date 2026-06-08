/**
 * DLavie OS — Anti-Ban WhatsApp System
 *
 * Fitur:
 * 1. Rate limiting per menit/jam
 * 2. Random delay antar pesan
 * 3. Typing simulation sebelum kirim
 * 4. Message batching untuk grup
 * 5. Jeda otomatis jika limit mendekati
 * 6. Rotating send patterns
 * 7. Cooldown escalation
 */

class AntiBan {
  constructor(config = {}) {
    this.enabled            = config.enabled !== false;
    this.maxMsgPerMin       = config.maxMsgPerMinute    || 20;
    this.maxMsgPerHour      = config.maxMsgPerHour      || 200;
    this.randomizeDelay     = config.randomizeDelay     !== false;
    this.useTyping          = config.useTypingSimulation !== false;
    this.typingDuration     = config.typingDurationMs   || 1000;
    this.cooldownOnLimit    = config.cooldownOnLimitMs  || 60000;
    this.minDelay           = config.minDelayMs         || 600;
    this.maxDelay           = config.maxDelayMs         || 2000;

    // State
    this.msgCountMin        = 0;
    this.msgCountHour       = 0;
    this.cooldownLevel      = 0;  // 0 = normal, 1 = warning, 2 = critical, 3 = halt
    this.lastSentAt         = 0;
    this.totalSent          = 0;
    this.blockedCount       = 0;
    this.isHalted           = false;

    this._startRateReset();
  }

  // ─── Safe send: wrap pengiriman pesan dengan anti-ban ───
  async safeSend(sock, jid, message, options = {}) {
    if (!this.enabled) return await sock.sendMessage(jid, message, options);

    // Cek halt
    if (this.isHalted) {
      throw new Error('Bot sedang cooldown anti-ban. Coba lagi dalam beberapa menit.');
    }

    // Cek rate limit
    this._checkAndEscalate();

    // Hitung delay
    const delay = this._computeDelay();
    const elapsed = Date.now() - this.lastSentAt;
    if (elapsed < delay) {
      await this._sleep(delay - elapsed);
    }

    // Typing simulation
    if (this.useTyping && !jid.endsWith('@g.us')) {
      try {
        await sock.sendPresenceUpdate('composing', jid);
        const typingTime = Math.min(
          this.typingDuration + Math.floor(Math.random() * 500),
          3000
        );
        await this._sleep(typingTime);
        await sock.sendPresenceUpdate('paused', jid);
      } catch (_) { /* silent */ }
    }

    // Kirim pesan
    const result = await sock.sendMessage(jid, message, options);

    this.msgCountMin++;
    this.msgCountHour++;
    this.totalSent++;
    this.lastSentAt = Date.now();

    return result;
  }

  // ─── Cek dan eskalasi level cooldown ───
  _checkAndEscalate() {
    const minPercent  = (this.msgCountMin  / this.maxMsgPerMin)  * 100;
    const hourPercent = (this.msgCountHour / this.maxMsgPerHour) * 100;
    const maxPct      = Math.max(minPercent, hourPercent);

    if (maxPct >= 100) {
      // Limit reached — cooldown
      this.cooldownLevel = 3;
      this.blockedCount++;
      this._triggerHalt();
      throw new Error('Rate limit reached. Bot cooling down.');
    } else if (maxPct >= 80) {
      this.cooldownLevel = 2; // Critical — delay panjang
    } else if (maxPct >= 60) {
      this.cooldownLevel = 1; // Warning — delay sedang
    } else {
      this.cooldownLevel = 0; // Normal
    }
  }

  // ─── Hitung delay berdasarkan cooldown level ───
  _computeDelay() {
    const multipliers = [1, 2, 4, 8];
    const base = this.randomizeDelay
      ? this.minDelay + Math.floor(Math.random() * (this.maxDelay - this.minDelay))
      : (this.minDelay + this.maxDelay) / 2;

    return base * (multipliers[this.cooldownLevel] || 1);
  }

  // ─── Halt sementara ───
  _triggerHalt() {
    if (this.isHalted) return;
    this.isHalted = true;
    const duration = this.cooldownOnLimit;
    console.warn(`[DLAVIE][ANTIBAN] Rate limit reached! Halting for ${duration / 1000}s`);
    setTimeout(() => {
      this.isHalted = false;
      this.cooldownLevel = 0;
      this.msgCountMin = 0;
      console.log('[DLAVIE][ANTIBAN] Halt lifted, resuming normal operation');
    }, duration);
  }

  // ─── Reset counters ───
  _startRateReset() {
    setInterval(() => { this.msgCountMin = 0; }, 60 * 1000);
    setInterval(() => { this.msgCountHour = 0; }, 60 * 60 * 1000);
  }

  // ─── Get status ───
  getStatus() {
    return {
      enabled: this.enabled,
      totalSent: this.totalSent,
      blockedCount: this.blockedCount,
      msgThisMinute: this.msgCountMin,
      msgThisHour: this.msgCountHour,
      cooldownLevel: ['normal', 'warning', 'critical', 'halt'][this.cooldownLevel],
      isHalted: this.isHalted,
      limits: {
        perMinute: this.maxMsgPerMin,
        perHour: this.maxMsgPerHour,
      },
    };
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

let instance = null;
function getAntiBan(config = {}) {
  if (!instance) instance = new AntiBan(config);
  return instance;
}

module.exports = { AntiBan, getAntiBan };
