/**
 * DLavie OS — !core4x command v1.0
 * Core4X Engine status and management
 * Shows feature health, draft errors, recovery queue
 */

'use strict';

const { isOwnerMsg } = require('../src/utils/ownerUtils');
const { getCore4X }  = require('../src/core4x/core4xEngine');

module.exports = {
  name: 'core4x',
  aliases: ['engine', 'health4x', 'c4x'],
  description: 'Core4X Engine status & management (Owner only)',
  ownerOnly: true,

  execute: async (sock, msg, args, config, ctx = {}) => {
    const jid      = msg.key.remoteJid;
    const safeSend = ctx.safeSend || ((j, m) => sock.sendMessage(j, m));

    if (!isOwnerMsg(msg, config.ownerNumber || process.env.OWNER_NUMBER)) {
      await safeSend(jid, { text: '🚫 Command ini hanya untuk Owner DLavie OS.' });
      return;
    }

    const core4x = getCore4X();
    const sub    = (args[0] || 'status').toLowerCase();

    if (sub === 'status') {
      const report = core4x.getStatusReport();
      const lines  = report.features.map(f => {
        const icon = f.score >= 80 ? '🟢' : f.score >= 50 ? '🟡' : '🔴';
        return `${icon} ${f.name}: ${f.score}/100 (✅${f.successes} ❌${f.failures})`;
      });

      await safeSend(jid, {
        text: `⚡ *Core4X Engine Status*\n\n` +
              `Features:\n${lines.length ? lines.join('\n') : '(Belum ada data)'}\n\n` +
              `📋 Recovery Queue: ${report.pendingRecovery}\n` +
              `🚨 Draft Errors: ${report.draftErrors}\n\n` +
              `Subcommands:\n` +
              `\`!core4x errors [feature]\` — Lihat error draft\n` +
              `\`!core4x queue\` — Recovery queue\n` +
              `\`!core4x health <feature>\` — Detail health\n` +
              `\`!core4x test <feature>\` — Test fallback`
      });
      return;
    }

    if (sub === 'errors') {
      const featureName = args[1] || null;
      const errors = core4x.getDraftErrors(featureName, 10);
      if (!errors.length) {
        await safeSend(jid, { text: '✅ Tidak ada draft error.' });
        return;
      }
      const lines = errors.slice(0, 5).map((e, i) =>
        `${i+1}. *${e.featureName}* [${e.layer}]\n   ${e.message.slice(0, 80)}\n   ${e.createdAt}`
      );
      await safeSend(jid, { text: `*🚨 Draft Errors (${errors.length}):*\n\n${lines.join('\n\n')}` });
      return;
    }

    if (sub === 'queue') {
      const queue = core4x.getRecoveryQueue();
      const pending = queue.filter(q => q.status === 'pending').slice(0, 5);
      if (!pending.length) {
        await safeSend(jid, { text: '✅ Recovery queue kosong.' });
        return;
      }
      const lines = pending.map((q, i) => `${i+1}. ${q.featureName}: ${q.error.slice(0, 60)}`);
      await safeSend(jid, { text: `*Recovery Queue (${pending.length}):*\n\n${lines.join('\n')}` });
      return;
    }

    if (sub === 'health') {
      const featureName = args[1];
      if (!featureName) { await safeSend(jid, { text: '❌ Format: `!core4x health <feature>`' }); return; }
      const h = core4x.getHealth(featureName);
      const icon = h.score >= 80 ? '🟢' : h.score >= 50 ? '🟡' : '🔴';
      await safeSend(jid, {
        text: `*${icon} Health: ${featureName}*\n\nScore: ${h.score}/100\nSuccesses: ${h.successes || 0}\nFailures: ${h.failures || 0}\nLast Check: ${h.lastChecked ? new Date(h.lastChecked).toLocaleString('id-ID') : '-'}`
      });
      return;
    }

    if (sub === 'test') {
      const featureName = args[1] || 'test';
      await safeSend(jid, { text: `⚡ Testing Core4X engine with feature: ${featureName}...` });
      try {
        const result = await core4x.run(featureName, {
          primary: async (ctx) => ({ tested: true, ts: Date.now() }),
          context: { userId: msg.key.remoteJid, command: 'test' }
        });
        await safeSend(jid, { text: `✅ Test passed!\nLayer: ${result.layer}\nResult: ${JSON.stringify(result.result || {})}` });
      } catch (err) {
        await safeSend(jid, { text: `❌ Test failed: ${err.message}` });
      }
      return;
    }

    await safeSend(jid, { text: `*Core4X Commands:*\n\`!core4x status\` — Semua feature health\n\`!core4x errors [feature]\` — Draft errors\n\`!core4x queue\` — Recovery queue\n\`!core4x health <feature>\` — Detail\n\`!core4x test\` — Test engine` });
  }
};
