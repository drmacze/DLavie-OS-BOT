const fs = require('fs');
const path = require('path');

const NOTES_DIR = path.join(__dirname, '..', 'tmp', 'notes');
if (!fs.existsSync(NOTES_DIR)) fs.mkdirSync(NOTES_DIR, { recursive: true });

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function senderNumber(msg) {
  return digitsOnly(msg.key.participant || msg.key.remoteJid || '');
}

function getNotesFile(userId) {
  return path.join(NOTES_DIR, `${userId}.json`);
}

function getNotes(userId) {
  const file = getNotesFile(userId);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch { return []; }
}

function saveNotes(userId, notes) {
  fs.writeFileSync(getNotesFile(userId), JSON.stringify(notes, null, 2));
}

module.exports = {
  name: 'notes',
  aliases: ['note', 'memo', 'reminder'],
  description: 'Personal notes and reminders',
  execute: async (sock, msg, args, config) => {
    const userId = senderNumber(msg);
    const mode = (args.shift() || 'list').toLowerCase();
    const notes = getNotes(userId);

    if (mode === 'list') {
      const lines = notes.map((n, i) => `${i + 1}. ${n.title} (${new Date(n.date).toLocaleDateString('id-ID')})`);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Your Notes*\n\n${lines.join('\n') || 'No notes'}`
      });
      return;
    }

    if (mode === 'add') {
      const title = args.shift();
      const content = args.join(' ');
      if (!title || !content) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !notes add <title> <content>' });
        return;
      }
      notes.push({ id: Date.now(), title, content, date: Date.now() });
      saveNotes(userId, notes);
      await sock.sendMessage(msg.key.remoteJid, { text: `Note added: ${title}` });
      return;
    }

    if (mode === 'get') {
      const index = parseInt(args.shift()) - 1;
      if (isNaN(index) || index < 0 || index >= notes.length) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Invalid note number.' });
        return;
      }
      const n = notes[index];
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*${n.title}*\n\n${n.content}\n\nDate: ${new Date(n.date).toLocaleString('id-ID')}`
      });
      return;
    }

    if (mode === 'remove') {
      const index = parseInt(args.shift()) - 1;
      if (isNaN(index) || index < 0 || index >= notes.length) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Invalid note number.' });
        return;
      }
      const removed = notes.splice(index, 1)[0];
      saveNotes(userId, notes);
      await sock.sendMessage(msg.key.remoteJid, { text: `Note removed: ${removed.title}` });
      return;
    }

    if (mode === 'clear') {
      saveNotes(userId, []);
      await sock.sendMessage(msg.key.remoteJid, { text: 'All notes cleared.' });
      return;
    }

    if (mode === 'search') {
      const query = args.join(' ').toLowerCase();
      if (!query) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !notes search <query>' });
        return;
      }
      const found = notes.filter(n => n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query));
      const lines = found.map((n, i) => `${i + 1}. ${n.title}`);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `*Search Results*\n\n${lines.join('\n') || 'No matches'}`
      });
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `*Notes Commands*\n\n!notes list - List notes\n!notes add <title> <content> - Add note\n!notes get <number> - View note\n!notes remove <number> - Delete note\n!notes clear - Clear all\n!notes search <query> - Search notes`
    });
  }
};
