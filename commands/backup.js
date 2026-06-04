const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const fsExtra = require('fs-extra');

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
  name: 'backup',
  aliases: ['export', 'save'],
  description: 'Backup system files',
  execute: async (sock, msg, args, config) => {
    if (!isOwner(msg, config)) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Owner only.' });
      return;
    }

    const mode = (args.shift() || 'help').toLowerCase();

    if (mode === 'create') {
      const timestamp = Date.now();
      const backupPath = path.join('tmp', `backup_${timestamp}.zip`);
      const output = fs.createWriteStream(backupPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', async () => {
        const stats = fs.statSync(backupPath);
        await sock.sendMessage(msg.key.remoteJid, {
          text: `*Backup Created*\n\nFile: backup_${timestamp}.zip\nSize: ${(stats.size / 1024).toFixed(2)} KB\nPath: tmp/backup_${timestamp}.zip`
        });
      });

      archive.on('error', (err) => {
        console.error('[DLAVIE][BACKUP] Error:', err);
      });

      archive.pipe(output);
      archive.directory('src/', 'src');
      archive.directory('commands/', 'commands');
      archive.file('package.json', { name: 'package.json' });
      archive.file('index.js', { name: 'index.js' });
      archive.finalize();
      return;
    }

    if (mode === 'list') {
      const backups = fs.readdirSync('tmp').filter(f => f.startsWith('backup_') && f.endsWith('.zip'));
      const lines = backups.map(f => {
        const stats = fs.statSync(path.join('tmp', f));
        return `${f}: ${(stats.size / 1024).toFixed(1)} KB`;
      });
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Backups*\n\n${lines.join('\n') || 'No backups'}`
      });
      return;
    }

    if (mode === 'clean') {
      const backups = fs.readdirSync('tmp').filter(f => f.startsWith('backup_') && f.endsWith('.zip'));
      let deleted = 0;
      for (const f of backups) {
        fs.unlinkSync(path.join('tmp', f));
        deleted++;
      }
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Backup Clean*\n\nDeleted ${deleted} backup files.`
      });
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `*Backup Commands*\n\n!backup create - Create backup zip\n!backup list - List backups\n!backup clean - Delete all backups`
    });
  }
};
