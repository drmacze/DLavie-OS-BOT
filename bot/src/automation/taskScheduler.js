/**
 * DLavie OS - Task Scheduler
 * Automated task execution with scheduling, rollback, and recovery.
 */

const cron = require('node-cron');
const config = require('../config');

class TaskScheduler {
  constructor() {
    this.tasks = new Map();
    this.scheduled = new Map();
    this.history = [];
    this.maxHistory = 500;
  }

  async init() {
    console.log('[DLAVIE][SCHEDULER] Initialized');
  }

  async schedule(name, cronExpression, task, options = {}) {
    if (!cron.validate(cronExpression)) {
      return { success: false, error: 'Invalid cron expression' };
    }

    const scheduledTask = cron.schedule(cronExpression, async () => {
      const start = Date.now();
      try {
        const result = await task();
        this.addHistory({
          name,
          type: 'scheduled',
          success: true,
          result: result?.toString?.() || 'OK',
          duration: Date.now() - start,
          timestamp: Date.now()
        });
      } catch (err) {
        this.addHistory({
          name,
          type: 'scheduled',
          success: false,
          error: err.message,
          duration: Date.now() - start,
          timestamp: Date.now()
        });
        if (options.onError) {
          try { await options.onError(err); } catch (e) { /* noop */ }
        }
      }
    }, {
      scheduled: true,
      timezone: options.timezone || 'UTC'
    });

    const taskInfo = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      cronExpression,
      options,
      createdAt: Date.now(),
      runs: 0,
      active: true
    };

    this.tasks.set(taskInfo.id, taskInfo);
    this.scheduled.set(taskInfo.id, scheduledTask);

    return { success: true, task: taskInfo };
  }

  async runOnce(name, task, options = {}) {
    const start = Date.now();
    try {
      const result = await task();
      this.addHistory({
        name,
        type: 'once',
        success: true,
        result: result?.toString?.() || 'OK',
        duration: Date.now() - start,
        timestamp: Date.now()
      });
      return { success: true, result, duration: Date.now() - start };
    } catch (err) {
      this.addHistory({
        name,
        type: 'once',
        success: false,
        error: err.message,
        duration: Date.now() - start,
        timestamp: Date.now()
      });
      if (options.rollback) {
        try {
          await options.rollback(err);
        } catch (e) {
          console.error('[DLAVIE][SCHEDULER] Rollback failed:', e.message);
        }
      }
      return { success: false, error: err.message };
    }
  }

  async stop(taskId) {
    const scheduled = this.scheduled.get(taskId);
    if (scheduled) {
      scheduled.stop();
      const task = this.tasks.get(taskId);
      if (task) task.active = false;
      return { success: true };
    }
    return { success: false, error: 'Task not found' };
  }

  async start(taskId) {
    const scheduled = this.scheduled.get(taskId);
    if (scheduled) {
      scheduled.start();
      const task = this.tasks.get(taskId);
      if (task) task.active = true;
      return { success: true };
    }
    return { success: false, error: 'Task not found' };
  }

  async delete(taskId) {
    const scheduled = this.scheduled.get(taskId);
    if (scheduled) {
      scheduled.stop();
      this.scheduled.delete(taskId);
    }
    this.tasks.delete(taskId);
    return { success: true };
  }

  addHistory(entry) {
    this.history.push(entry);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory / 2);
    }
  }

  async getHistory(limit = 50) {
    return this.history.slice(-limit).reverse();
  }

  async getTasks() {
    return Array.from(this.tasks.values());
  }

  async getStatus() {
    return {
      active: true,
      totalTasks: this.tasks.size,
      activeTasks: Array.from(this.tasks.values()).filter(t => t.active).length,
      totalHistory: this.history.length
    };
  }

  shutdown() {
    for (const scheduled of this.scheduled.values()) {
      scheduled.stop();
    }
    this.scheduled.clear();
  }
}

module.exports = { TaskScheduler };
