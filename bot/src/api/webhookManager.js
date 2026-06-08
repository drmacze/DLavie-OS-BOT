/**
 * DLavie OS - Webhook Manager
 * Sends events to configured website/dashboard endpoints.
 */

const axios = require('axios');
const config = require('../config');

class WebhookManager {
  constructor() {
    this.queue = [];
    this.retryCount = new Map();
    this.maxRetries = 3;
  }

  async init() {
    console.log('[DLAVIE][WEBHOOK] Initialized');
    this.startProcessor();
  }

  startProcessor() {
    setInterval(() => this.processQueue(), 5000);
  }

  async send(event, payload) {
    if (!config.website.enableWebhook || !config.website.webhookUrl) return { success: false, reason: 'webhook disabled' };

    const entry = {
      id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      event,
      payload,
      timestamp: Date.now(),
      attempts: 0
    };

    this.queue.push(entry);
    return { success: true, queued: true, id: entry.id };
  }

  async processQueue() {
    if (this.queue.length === 0) return;
    const entry = this.queue.shift();

    try {
      await axios.post(config.website.webhookUrl, {
        event: entry.event,
        payload: entry.payload,
        timestamp: entry.timestamp,
        source: 'dlavie-os-bot'
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'X-DLavie-Event': entry.event,
          'X-DLavie-Signature': 'placeholder' // HMAC would be implemented here
        }
      });
      console.log(`[DLAVIE][WEBHOOK] Sent: ${entry.event}`);
    } catch (err) {
      entry.attempts++;
      if (entry.attempts < this.maxRetries) {
        this.queue.unshift(entry);
      } else {
        console.error(`[DLAVIE][WEBHOOK] Failed to send ${entry.event} after ${this.maxRetries} attempts:`, err.message);
      }
    }
  }

  async getStatus() {
    return {
      active: true,
      enabled: config.website.enableWebhook,
      queueLength: this.queue.length,
      webhookUrl: config.website.webhookUrl || 'not configured'
    };
  }

  shutdown() {
    this.queue = [];
  }
}

module.exports = { WebhookManager };
