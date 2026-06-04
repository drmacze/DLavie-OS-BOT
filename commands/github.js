const axios = require('axios');

module.exports = {
  name: 'github',
  aliases: ['gh', 'repo'],
  description: 'GitHub repository info',
  execute: async (sock, msg, args, config) => {
    const repo = args.join('');
    if (!repo || !repo.includes('/')) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !github <owner/repo>\nContoh: !github drmacze/DLavie-OS-BOT' });
      return;
    }

    try {
      const response = await axios.get(`https://api.github.com/repos/${repo}`, { timeout: 10000 });
      const data = response.data;
      const text = `
*GitHub Repository*

${data.full_name}
${data.description || 'No description'}

Stars: ${data.stargazers_count}
Forks: ${data.forks_count}
Issues: ${data.open_issues_count}
Watchers: ${data.watchers_count}

Language: ${data.language || 'N/A'}
License: ${data.license?.name || 'N/A'}
Default Branch: ${data.default_branch}

Created: ${new Date(data.created_at).toLocaleDateString('id-ID')}
Updated: ${new Date(data.updated_at).toLocaleDateString('id-ID')}

URL: ${data.html_url}
`.trim();
      await sock.sendMessage(msg.key.remoteJid, { text });
    } catch (err) {
      await sock.sendMessage(msg.key.remoteJid, { text: `GitHub error: ${err.message}` });
    }
  }
};
