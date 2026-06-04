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
  name: 'group',
  aliases: ['gc', 'grup'],
  description: 'Group management commands',
  execute: async (sock, msg, args, config) => {
    const mode = (args.shift() || 'help').toLowerCase();
    const chatId = msg.key.remoteJid;

    // Check if this is a group chat
    if (!chatId.endsWith('@g.us')) {
      await sock.sendMessage(chatId, { text: 'This command only works in group chats.' });
      return;
    }

    if (mode === 'info') {
      try {
        const groupMetadata = await sock.groupMetadata(chatId);
        const text = `
*Group Info*

Name: ${groupMetadata.subject}
ID: ${groupMetadata.id}
Members: ${groupMetadata.participants.length}
Created: ${new Date(groupMetadata.creation * 1000).toLocaleString('id-ID')}
Owner: ${groupMetadata.owner || 'Unknown'}
Restricted: ${groupMetadata.restrict ? 'Yes' : 'No'}
Announce: ${groupMetadata.announce ? 'Yes' : 'No'}
`.trim();
        await sock.sendMessage(chatId, { text });
      } catch (err) {
        await sock.sendMessage(chatId, { text: `Error: ${err.message}` });
      }
      return;
    }

    if (mode === 'members') {
      try {
        const groupMetadata = await sock.groupMetadata(chatId);
        const admins = groupMetadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
        const members = groupMetadata.participants.filter(p => !p.admin);
        const text = `
*Group Members*

Admins (${admins.length}):
${admins.slice(0, 10).map(a => `- ${a.id.split('@')[0]}`).join('\n')}

Members (${members.length}):
${members.slice(0, 10).map(m => `- ${m.id.split('@')[0]}`).join('\n')}
${members.length > 10 ? `\n...and ${members.length - 10} more` : ''}
`.trim();
        await sock.sendMessage(chatId, { text });
      } catch (err) {
        await sock.sendMessage(chatId, { text: `Error: ${err.message}` });
      }
      return;
    }

    if (mode === 'link') {
      if (!isOwner(msg, config)) {
        await sock.sendMessage(chatId, { text: 'Owner only.' });
        return;
      }
      try {
        const inviteCode = await sock.groupInviteCode(chatId);
        await sock.sendMessage(chatId, {
          text: `*Group Invite Link*\n\nhttps://chat.whatsapp.com/${inviteCode}`
        });
      } catch (err) {
        await sock.sendMessage(chatId, { text: `Error: ${err.message}` });
      }
      return;
    }

    if (mode === 'revoke') {
      if (!isOwner(msg, config)) {
        await sock.sendMessage(chatId, { text: 'Owner only.' });
        return;
      }
      try {
        await sock.groupRevokeInvite(chatId);
        await sock.sendMessage(chatId, { text: 'Group invite link revoked. Generate new link with !group link' });
      } catch (err) {
        await sock.sendMessage(chatId, { text: `Error: ${err.message}` });
      }
      return;
    }

    if (mode === 'setname') {
      if (!isOwner(msg, config)) {
        await sock.sendMessage(chatId, { text: 'Owner only.' });
        return;
      }
      const name = args.join(' ');
      if (!name) {
        await sock.sendMessage(chatId, { text: 'Format: !group setname <new name>' });
        return;
      }
      try {
        await sock.groupUpdateSubject(chatId, name);
        await sock.sendMessage(chatId, { text: `Group name updated to: ${name}` });
      } catch (err) {
        await sock.sendMessage(chatId, { text: `Error: ${err.message}` });
      }
      return;
    }

    if (mode === 'setdesc') {
      if (!isOwner(msg, config)) {
        await sock.sendMessage(chatId, { text: 'Owner only.' });
        return;
      }
      const desc = args.join(' ');
      if (!desc) {
        await sock.sendMessage(chatId, { text: 'Format: !group setdesc <description>' });
        return;
      }
      try {
        await sock.groupUpdateDescription(chatId, desc);
        await sock.sendMessage(chatId, { text: 'Group description updated.' });
      } catch (err) {
        await sock.sendMessage(chatId, { text: `Error: ${err.message}` });
      }
      return;
    }

    await sock.sendMessage(chatId, {
      text: `*Group Commands*\n\n!group info - Group info\n!group members - Member list\n!group link - Invite link (owner)\n!group revoke - Revoke link (owner)\n!group setname <name> - Set name (owner)\n!group setdesc <desc> - Set description (owner)`
    });
  }
};
