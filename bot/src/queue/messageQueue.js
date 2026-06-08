/**
 * DLavie OS — Message Queue & Anti-Spam System
 *
 * Tier Queue Logic:
 * - free / starter  → masuk antrian (queue)
 * - pro / enterprise → bypass queue, langsung diproses
 *
 * Anti-Ban Logic:
 * - Random delay antar pesan
 * - Rate limit per menit dan per jam
 * - Simulasi typing sebelum kirim
 * - Cooldown otomatis jika limit tercapai
 */

const { EventEmitter } = require('events');

const PRIORITY_PLANS = ['pro', 'enterprise'];

class MessageQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxConcurrent   = options.maxConcurrent   || 5;
    this.maxQueueSize    = options.maxQueueSize     || 50;
    this.processInterval = options.processIntervalMs|| 800;
    this.minDelay        = options.minDelayMs       || 800;
    this.maxDelay        = options.maxDelayMs       || 2500;

    // Anti-ban counters
    this.msgCountMin     = 0;
    this.msgCountHour    = 0;
    this.maxMsgPerMin    = options.maxMsgPerMinute  || 20;
    this.maxMsgPerHour   = options.maxMsgPerHour    || 200;
    this.inCooldown      = false;
    this.cooldownMs      = options.cooldownOnLimitMs || 60000;

    this.queue           = [];      // Antrian: [{ task, userId, plan, resolve, reject, enqueuedAt }]
    this.processing      = new Set();
    this.userPositions   = new Map(); // userId -> position info
    this.stats           = { processed: 0, queued: 0, rejected: 0, antibanBlocked: 0 };

    this._startProcessor();
    this._startRateReset();
  }

  // ─── Tambah task ke queue ───
  enqueue(task, userId, plan = 'free') {
    return new Promise((resolve, reject) => {
      // Priority bypass
      if (PRIORITY_PLANS.includes(plan)) {
        this._executeWithAntiBan(task, userId, plan)
          .then(resolve).catch(reject);
        return;
      }

      // Cek queue penuh
      if (this.queue.length >= this.maxQueueSize) {
        this.stats.rejected++;
        reject({
          code: 'QUEUE_FULL',
          message: `Antrian penuh (${this.maxQueueSize} pesan). Coba lagi dalam beberapa menit.`,
          queueSize: this.queue.length,
        });
        return;
      }

      // Cari apakah user sudah di queue
      const existingIdx = this.queue.findIndex(q => q.userId === userId);
      if (existingIdx !== -1) {
        const pos = existingIdx + 1;
        reject({
          code: 'ALREADY_QUEUED',
          message: `Kamu sudah ada di antrian posisi #${pos}. Tunggu sebentar.`,
          position: pos,
        });
        return;
      }

      const entry = { task, userId, plan, resolve, reject, enqueuedAt: Date.now() };
      this.queue.push(entry);
      this.stats.queued++;

      const position = this.queue.length;
      this.userPositions.set(userId, { position, enqueuedAt: entry.enqueuedAt });

      // Emit event untuk notifikasi posisi
      this.emit('queued', { userId, position, queueSize: this.queue.length });
    });
  }

  // ─── Cek posisi user di queue ───
  getQueuePosition(userId) {
    const idx = this.queue.findIndex(q => q.userId === userId);
    if (idx === -1) return null;
    return {
      position: idx + 1,
      total:    this.queue.length,
      estimatedWaitMs: idx * (this.processInterval + this._avgDelay()),
    };
  }

  // ─── Get stats ───
  getStats() {
    return {
      ...this.stats,
      currentQueue:    this.queue.length,
      currentProcessing: this.processing.size,
      inCooldown:      this.inCooldown,
      msgThisMinute:   this.msgCountMin,
      msgThisHour:     this.msgCountHour,
    };
  }

  // ─── Processor utama ───
  _startProcessor() {
    setInterval(async () => {
      if (this.inCooldown) return;
      if (this.processing.size >= this.maxConcurrent) return;
      if (this.queue.length === 0) return;

      const entry = this.queue.shift();
      if (!entry) return;

      this.userPositions.delete(entry.userId);
      this.processing.add(entry.userId);

      // Update posisi sisanya
      this.queue.forEach((q, i) => {
        this.userPositions.set(q.userId, { position: i + 1, enqueuedAt: q.enqueuedAt });
      });

      try {
        const result = await this._executeWithAntiBan(entry.task, entry.userId, entry.plan);
        entry.resolve(result);
      } catch (err) {
        entry.reject(err);
      } finally {
        this.processing.delete(entry.userId);
      }
    }, this.processInterval);
  }

  // ─── Execute dengan anti-ban logic ───
  async _executeWithAntiBan(task, userId, plan) {
    // Cek rate limits (anti-ban)
    if (this.msgCountMin >= this.maxMsgPerMin || this.msgCountHour >= this.maxMsgPerHour) {
      this.stats.antibanBlocked++;
      await this._triggerCooldown();
    }

    // Random delay
    const delay = this.minDelay + Math.floor(Math.random() * (this.maxDelay - this.minDelay));
    await this._sleep(delay);

    this.msgCountMin++;
    this.msgCountHour++;
    this.stats.processed++;

    return await task();
  }

  // ─── Cooldown ───
  async _triggerCooldown() {
    if (this.inCooldown) return;
    this.inCooldown = true;
    console.warn(`[DLAVIE][QUEUE] Anti-ban cooldown triggered for ${this.cooldownMs / 1000}s`);
    await this._sleep(this.cooldownMs);
    this.inCooldown = false;
    console.log('[DLAVIE][QUEUE] Cooldown lifted, resuming');
  }

  // ─── Reset rate counters ───
  _startRateReset() {
    setInterval(() => { this.msgCountMin = 0; }, 60 * 1000);
    setInterval(() => { this.msgCountHour = 0; }, 60 * 60 * 1000);
  }

  _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  _avgDelay() {
    return (this.minDelay + this.maxDelay) / 2;
  }
}

let instance = null;
function getMessageQueue(options = {}) {
  if (!instance) instance = new MessageQueue(options);
  return instance;
}

module.exports = { MessageQueue, getMessageQueue };
