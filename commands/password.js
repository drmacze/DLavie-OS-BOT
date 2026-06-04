const crypto = require('crypto');

module.exports = {
  name: 'password',
  aliases: ['pass', 'pwd'],
  description: 'Generate secure password',
  execute: async (sock, msg, args, config) => {
    const length = parseInt(args.shift() || '16');
    const includeSymbols = args.includes('symbols') || args.includes('special');
    const includeNumbers = !args.includes('no-numbers');
    const includeUpper = !args.includes('no-upper');
    const includeLower = !args.includes('no-lower');

    let chars = '';
    if (includeLower) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (includeUpper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (includeNumbers) chars += '0123456789';
    if (includeSymbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz';

    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars[crypto.randomInt(chars.length)];
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `*Password Generator*\n\nLength: ${length}\nPassword: ${password}\n\nStrength: ${length >= 16 ? 'Strong' : length >= 12 ? 'Medium' : 'Weak'}`
    });
  }
};
