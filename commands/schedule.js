const { getEngine } = require('../src/core/engine');
const { TaskScheduler } = require('../src/automation/taskScheduler');

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function senderNumber(msg) {
  return digitsOnly(msg.key.participant || msg.key.remoteJid || '');
}

function isOwner(msg, config) {
  const owner = digitsOnly(config.ownerNumber);
  return msg.key.fromMe || (owner && senderNumber(msg).includes(owner));
}

// Global scheduler instance
let globalScheduler = null;
function getScheduler() {
  if (!globalScheduler) globalScheduler = new TaskScheduler();
  return globalScheduler;
}

module.exports = {
  name: 'schedule',
  aliases: ['task', 'cron'],
  description: 'Scheduled task management',
  execute: async (sock, msg, args, config) => {
    if (!isOwner(msg, config)) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Owner only.' });
      return;
    }

    const userId = senderNumber(msg);
    const engine = getEngine();
    const tokenEngine = engine.getSystem('token');
    const mode = (args.shift() || 'list').toLowerCase();
    const scheduler = getScheduler();

    if (!tokenEngine.getAccount(userId)) tokenEngine.registerAccount(userId);

    if (mode === 'list') {
      const tasks = await scheduler.getTasks();
      const lines = tasks.map(t => `${t.name}: ${t.cronExpression} (${t.active ? 'Active' : 'Stopped'})`);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Scheduled Tasks*\n\n${lines.join('\n') || 'No tasks'}`
      });
      return;
    }

    if (mode === 'create') {
      const name = args.shift();
      const cronExpr = args.shift();
      const command = args.join(' ');
      if (!name || !cronExpr || !command) {
        await sock.sendMessage(msg.key.remoteJid, {
          text: 'Format: !schedule create <name> <cron> <command>'
        });
        return;
      }
      const cost = tokenEngine.spend(userId, 'scheduled_task');
      if (!cost.success) {
        await sock.sendMessage(msg.key.remoteJid, { text: `Token tidak cukup: ${cost.error}` });
        return;
      }
      const result = await scheduler.schedule(name, cronExpr, async () => {
        console.log(`[DLAVIE][SCHEDULE] Running: ${command}`);
      });
      await sock.sendMessage(msg.key.remoteJid, {
        text: result.success ? `Task created: ${name} (${cronExpr})` : `Error: ${result.error}`
      });
      return;
    }

    if (mode === 'stop') {
      const taskId = args.shift();
      if (!taskId) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !schedule stop <taskId>' });
        return;
      }
      const result = await scheduler.stop(taskId);
      await sock.sendMessage(msg.key.remoteJid, {
        text: result.success ? `Task stopped: ${taskId}` : `Error: ${result.error}`
      });
      return;
    }

    if (mode === 'start') {
      const taskId = args.shift();
      if (!taskId) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !schedule start <taskId>' });
        return;
      }
      const result = await scheduler.start(taskId);
      await sock.sendMessage(msg.key.remoteJid, {
        text: result.success ? `Task started: ${taskId}` : `Error: ${result.error}`
      });
      return;
    }

    if (mode === 'delete') {
      const taskId = args.shift();
      if (!taskId) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !schedule delete <taskId>' });
        return;
      }
      const result = await scheduler.delete(taskId);
      await sock.sendMessage(msg.key.remoteJid, {
        text: result.success ? `Task deleted: ${taskId}` : `Error: ${result.error}`
      });
      return;
    }

    if (mode === 'history') {
      const history = await scheduler.getHistory(20);
      const lines = history.map(h => `${h.name}: ${h.success ? 'OK' : 'FAIL'} (${h.duration}ms)`);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Task History*\n\n${lines.join('\n') || 'No history'}`
      });
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `*Schedule Commands*\n\n!schedule list - List tasks\n!schedule create <name> <cron> <cmd> - Create task\n!schedule stop <id> - Stop task\n!schedule start <id> - Start task\n!schedule delete <id> - Delete task\n!schedule history - Task history`
    });
  }
};
