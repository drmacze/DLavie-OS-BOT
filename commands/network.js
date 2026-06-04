const { exec } = require('child_process');
const dns = require('dns');
const { promisify } = require('util');
const dnsLookup = promisify(dns.lookup);
const dnsResolve = promisify(dns.resolve);

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

function execPromise(cmd, timeout = 10000) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve(stdout.trim());
    });
  });
}

module.exports = {
  name: 'network',
  aliases: ['net', 'dns', 'ping', 'ip'],
  description: 'Network tools',
  execute: async (sock, msg, args, config) => {
    const mode = (args.shift() || 'help').toLowerCase();
    const target = args.shift();

    if (mode === 'dns') {
      if (!target) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !network dns <domain>' });
        return;
      }
      try {
        const records = await dnsResolve(target, 'A');
        await sock.sendMessage(msg.key.remoteJid, {
          text: `*DNS A Records for ${target}*\n\n${records.join('\n')}`
        });
      } catch (err) {
        try {
          const lookup = await dnsLookup(target);
          await sock.sendMessage(msg.key.remoteJid, {
            text: `*DNS Lookup for ${target}*\n\nIP: ${lookup.address}\nFamily: IPv${lookup.family}`
          });
        } catch (e) {
          await sock.sendMessage(msg.key.remoteJid, { text: `DNS error: ${e.message}` });
        }
      }
      return;
    }

    if (mode === 'ping') {
      if (!target) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !network ping <host>' });
        return;
      }
      try {
        const stdout = await execPromise(`ping -c 4 ${target} 2>&1`);
        const lines = stdout.split('\n').slice(-5);
        await sock.sendMessage(msg.key.remoteJid, {
          text: `*Ping ${target}*\n\n${lines.join('\n')}`
        });
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { text: `Ping error: ${err.message}` });
      }
      return;
    }

    if (mode === 'ip') {
      try {
        const ip = await execPromise('curl -s ifconfig.me 2>/dev/null || wget -qO- ifconfig.me 2>/dev/null || echo "Unable to detect"');
        await sock.sendMessage(msg.key.remoteJid, {
          text: `*Public IP*\n\n${ip}`
        });
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { text: `IP error: ${err.message}` });
      }
      return;
    }

    if (mode === 'whois') {
      if (!target) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !network whois <domain>' });
        return;
      }
      try {
        const stdout = await execPromise(`whois ${target} 2>&1 | head -20`);
        await sock.sendMessage(msg.key.remoteJid, {
          text: `*Whois ${target}*\n\n${stdout}`
        });
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { text: `Whois error: ${err.message}` });
      }
      return;
    }

    if (mode === 'port') {
      if (!target) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !network port <host> [port]' });
        return;
      }
      const port = args.shift() || '80';
      try {
        const stdout = await execPromise(`timeout 3 bash -c 'cat < /dev/null > /dev/tcp/${target}/${port}' 2>&1 && echo "OPEN" || echo "CLOSED"`);
        await sock.sendMessage(msg.key.remoteJid, {
          text: `*Port Check ${target}:${port}*\n\nStatus: ${stdout}`
        });
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { text: `Port check error: ${err.message}` });
      }
      return;
    }

    if (mode === 'speed') {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Network Speed Test*\n\nRun !sysinfo for network interfaces.\nFull speed test requires speedtest-cli package.`
      });
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `*Network Commands*\n\n!network dns <domain> - DNS lookup\n!network ping <host> - Ping test\n!network ip - Public IP\n!network whois <domain> - Whois lookup\n!network port <host> [port] - Port check\n!network speed - Speed test info`
    });
  }
};
