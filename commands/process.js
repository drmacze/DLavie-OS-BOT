const { exec } = require('child_process');
const pidusage = require('pidusage');

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

module.exports = {
  name: 'process',
  aliases: ['ps', 'proc', 'task'],
  description: 'Process management',
  execute: async (sock, msg, args, config) => {
    if (!isOwner(msg, config)) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Owner only.' });
      return;
    }

    const mode = (args.shift() || 'list').toLowerCase();

    if (mode === 'list') {
      try {
        const stats = await pidusage(process.pid);
        const text = `
*Process Info*

PID: ${process.pid}
CPU: ${stats.cpu.toFixed(1)}%
Memory: ${(stats.memory / 1024 / 1024).toFixed(2)} MB
Elapsed: ${Math.floor(stats.elapsed / 1000)}s

PPID: ${process.ppid || 'N/A'}
Node: ${process.version}
Platform: ${process.platform}
`.trim();
        await sock.sendMessage(msg.key.remoteJid, { text });
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { text: `PID: ${process.pid}, Error: ${err.message}` });
      }
      return;
    }

    if (mode === 'memory') {
      const mem = process.memoryUsage();
      const text = `
*Memory Usage*

RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB
Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB
Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB
External: ${(mem.external / 1024 / 1024).toFixed(2)} MB
Array Buffers: ${(mem.arrayBuffers / 1024 / 1024).toFixed(2)} MB
`.trim();
      await sock.sendMessage(msg.key.remoteJid, { text });
      return;
    }

    if (mode === 'env') {
      const envKeys = Object.keys(process.env).filter(k => k.startsWith('DLAVIE') || k.startsWith('BOT') || k.startsWith('OWNER') || k.startsWith('SUPABASE') || k.startsWith('API') || k.startsWith('JWT') || k.startsWith('GEMINI') || k.startsWith('OPENAI') || k.startsWith('GROK'));
      const lines = envKeys.map(k => `${k}: ${process.env[k] ? 'SET' : 'NOT SET'}`);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Environment Variables*\n\n${lines.join('\n') || 'No DLavie env vars found'}`
      });
      return;
    }

    if (mode === 'uptime') {
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const mins = Math.floor((uptime % 3600) / 60);
      const secs = Math.floor(uptime % 60);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Uptime*\n\n${hours}h ${mins}m ${secs}s`
      });
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `*Process Commands*\n\n!process list - Process info\n!process memory - Memory usage\n!process env - Environment vars\n!process uptime - Uptime`
    });
  }
};
