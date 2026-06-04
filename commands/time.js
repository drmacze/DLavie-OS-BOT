module.exports = {
  name: 'time',
  aliases: ['jam', 'waktu'],
  description: 'Current time and date',
  execute: async (sock, msg, args, config) => {
    const now = new Date();
    const mode = (args.shift() || 'all').toLowerCase();

    if (mode === 'all' || mode === 'now') {
      const text = `
*Current Time*

Date: ${now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Time: ${now.toLocaleTimeString('id-ID')}
Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
Timestamp: ${now.getTime()}
ISO: ${now.toISOString()}
`.trim();
      await sock.sendMessage(msg.key.remoteJid, { text });
      return;
    }

    if (mode === 'date') {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `Date: ${now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`
      });
      return;
    }

    if (mode === 'clock') {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `Time: ${now.toLocaleTimeString('id-ID')}`
      });
      return;
    }

    if (mode === 'timestamp') {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `Timestamp: ${now.getTime()}\nISO: ${now.toISOString()}`
      });
      return;
    }

    if (mode === 'timezone') {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`
      });
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `*Time Commands*\n\n!time now - Full datetime\n!time date - Date only\n!time clock - Time only\n!time timestamp - Unix timestamp\n!time timezone - Current timezone`
    });
  }
};
