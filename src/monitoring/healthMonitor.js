/**
 * DLavie OS - Health Monitor
 * Real-time health monitoring with anomaly detection.
 */

const os = require('os');
const pidusage = require('pidusage');
const si = require('systeminformation');
const config = require('../config');

class HealthMonitor {
  constructor() {
    this.metrics = [];
    this.maxMetrics = 1000;
    this.lastCheck = 0;
    this.anomalies = [];
    this.botHealth = new Map();
  }

  async init() {
    this.startAutoCheck();
    console.log('[DLAVIE][HEALTH] Initialized');
  }

  startAutoCheck() {
    setInterval(() => this.checkSystem(), config.monitoring.healthCheckInterval * 1000);
  }

  async checkSystem() {
    try {
      const metrics = {
        timestamp: Date.now(),
        timestampISO: new Date().toISOString(),
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
          usedPercent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
          nodeHeap: process.memoryUsage().heapUsed
        },
        cpu: {
          loadAvg: os.loadavg(),
          usagePercent: await this.getCpuUsage()
        },
        process: {
          pid: process.pid,
          uptime: process.uptime(),
          version: process.version
        },
        platform: {
          hostname: os.hostname(),
          platform: os.platform(),
          arch: os.arch()
        },
        anomaly: null
      };

      // Detect anomalies
      const anomaly = this.detectAnomaly(metrics);
      if (anomaly) {
        metrics.anomaly = anomaly;
        this.anomalies.push(anomaly);
        if (this.anomalies.length > 100) this.anomalies = this.anomalies.slice(-50);
      }

      this.metrics.push(metrics);
      if (this.metrics.length > this.maxMetrics) {
        this.metrics = this.metrics.slice(-this.maxMetrics / 2);
      }

      this.lastCheck = Date.now();
      return metrics;
    } catch (err) {
      console.error('[DLAVIE][HEALTH] Check error:', err.message);
      return null;
    }
  }

  async getCpuUsage() {
    try {
      const stats = await pidusage(process.pid);
      return Math.round(stats.cpu);
    } catch {
      return 0;
    }
  }

  detectAnomaly(metrics) {
    const recent = this.metrics.slice(-10);
    if (recent.length < 5) return null;

    const avgMem = recent.reduce((sum, m) => sum + m.memory.usedPercent, 0) / recent.length;
    if (metrics.memory.usedPercent > avgMem * 1.5 && metrics.memory.usedPercent > 90) {
      return {
        type: 'memory_spike',
        severity: 'high',
        message: `Memory usage spike detected: ${metrics.memory.usedPercent}%`,
        timestamp: Date.now()
      };
    }

    const avgCpu = recent.reduce((sum, m) => sum + m.cpu.usagePercent, 0) / recent.length;
    if (metrics.cpu.usagePercent > avgCpu * 2 && metrics.cpu.usagePercent > 80) {
      return {
        type: 'cpu_spike',
        severity: 'medium',
        message: `CPU usage spike detected: ${metrics.cpu.usagePercent}%`,
        timestamp: Date.now()
      };
    }

    return null;
  }

  async getHealthReport() {
    const latest = this.metrics[this.metrics.length - 1];
    if (!latest) return { status: 'unknown' };

    let healthScore = 100;
    if (latest.memory.usedPercent > 80) healthScore -= 20;
    if (latest.memory.usedPercent > 95) healthScore -= 30;
    if (latest.cpu.usagePercent > 70) healthScore -= 15;
    if (latest.cpu.usagePercent > 90) healthScore -= 25;
    if (this.anomalies.length > 10) healthScore -= 10;

    healthScore = Math.max(0, Math.min(100, healthScore));

    return {
      status: healthScore >= 80 ? 'healthy' : healthScore >= 50 ? 'warning' : 'critical',
      healthScore,
      latest: latest,
      anomalies: this.anomalies.slice(-10),
      uptime: process.uptime()
    };
  }

  async getBotHealth(botId) {
    return this.botHealth.get(botId) || {
      status: 'unknown',
      healthScore: 0,
      lastCheck: 0
    };
  }

  async updateBotHealth(botId, healthData) {
    this.botHealth.set(botId, {
      ...healthData,
      lastCheck: Date.now()
    });
  }

  async getStatus() {
    return {
      active: true,
      totalMetrics: this.metrics.length,
      totalAnomalies: this.anomalies.length,
      lastCheck: this.lastCheck
    };
  }

  shutdown() {
    // Nothing special to clean up
  }
}

module.exports = { HealthMonitor };
