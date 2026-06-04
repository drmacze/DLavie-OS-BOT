const os = require('os');
const si = require('systeminformation');
const config = require('../src/config');

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
  name: 'sysinfo',
  aliases: ['system', 'sys'],
  description: 'System information',
  execute: async (sock, msg, args, config) => {
    const mode = (args.shift() || 'all').toLowerCase();

    if (mode === 'all') {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memPercent = Math.round((usedMem / totalMem) * 100);
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const mins = Math.floor((uptime % 3600) / 60);
      const secs = Math.floor(uptime % 60);

      const text = `
*System Information*

Platform: ${os.platform()} ${os.arch()}
Hostname: ${os.hostname()}
Node: ${process.version}

Memory: ${Math.round(usedMem / 1024 / 1024)}MB / ${Math.round(totalMem / 1024 / 1024)}MB (${memPercent}%)
Free: ${Math.round(freeMem / 1024 / 1024)}MB

CPU Cores: ${os.cpus().length}
Load: ${os.loadavg().map(l => l.toFixed(2)).join(', ')}

Uptime: ${hours}h ${mins}m ${secs}s
Process PID: ${process.pid}
`.trim();
      await sock.sendMessage(msg.key.remoteJid, { text });
      return;
    }

    if (mode === 'cpu') {
      try {
        const cpu = await si.cpu();
        const currentLoad = await si.currentLoad();
        const text = `
*CPU Info*

Manufacturer: ${cpu.manufacturer}
Brand: ${cpu.brand}
Speed: ${cpu.speed} GHz
Cores: ${cpu.cores}
Physical Cores: ${cpu.physicalCores}

Load: ${currentLoad.currentLoad.toFixed(1)}%
User: ${currentLoad.currentLoadUser.toFixed(1)}%
System: ${currentLoad.currentLoadSystem.toFixed(1)}%
`.trim();
        await sock.sendMessage(msg.key.remoteJid, { text });
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { text: `CPU info: ${os.cpus().length} cores, Load: ${os.loadavg().map(l => l.toFixed(2)).join(', ')}` });
      }
      return;
    }

    if (mode === 'memory') {
      const total = os.totalmem();
      const free = os.freemem();
      const used = total - free;
      const text = `
*Memory Info*

Total: ${(total / 1024 / 1024 / 1024).toFixed(2)} GB
Used: ${(used / 1024 / 1024 / 1024).toFixed(2)} GB (${Math.round((used / total) * 100)}%)
Free: ${(free / 1024 / 1024 / 1024).toFixed(2)} GB

Node Heap: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB
Node RSS: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB
`.trim();
      await sock.sendMessage(msg.key.remoteJid, { text });
      return;
    }

    if (mode === 'disk') {
      try {
        const fs = await si.fsSize();
        const lines = fs.map(d => `${d.fs}: ${(d.used / 1024 / 1024 / 1024).toFixed(1)}GB / ${(d.size / 1024 / 1024 / 1024).toFixed(1)}GB (${d.use}%)`);
        await sock.sendMessage(msg.key.remoteJid, { text: `*Disk Info*\n\n${lines.join('\n')}` });
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Disk info tidak tersedia.' });
      }
      return;
    }

    if (mode === 'network') {
      try {
        const net = await si.networkInterfaces();
        const lines = net.map(n => `${n.iface}: ${n.ip4 || 'no IP'}`);
        await sock.sendMessage(msg.key.remoteJid, { text: `*Network*\n\n${lines.join('\n')}` });
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Network info tidak tersedia.' });
      }
      return;
    }

    if (mode === 'os') {
      const text = `
*OS Info*

Platform: ${os.platform()}
Type: ${os.type()}
Release: ${os.release()}
Arch: ${os.arch()}
Endianness: ${os.endianness()}
Hostname: ${os.hostname()}
Total Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB
`.trim();
      await sock.sendMessage(msg.key.remoteJid, { text });
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `*SysInfo Commands*\n\n!sysinfo all - All info\n!sysinfo cpu - CPU details\n!sysinfo memory - Memory usage\n!sysinfo disk - Disk usage\n!sysinfo network - Network interfaces\n!sysinfo os - OS details`
    });
  }
};
