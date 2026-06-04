const config = require('../src/config');
const { askAiFallback } = require('../src/selfRepair/aiFallback');
const { getEngine } = require('../src/core/engine');

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function senderNumber(msg) {
  return digitsOnly(msg.key.participant || msg.key.remoteJid || '');
}

module.exports = {
  name: 'ai',
  aliases: ['ask', 'gpt', 'gemini', 'grok'],
  description: 'AI chat and query',
  execute: async (sock, msg, args, config) => {
    const userId = senderNumber(msg);
    const engine = getEngine();
    const tokenEngine = engine.getSystem('token');
    const mode = (args.shift() || 'chat').toLowerCase();
    const prompt = args.join(' ');

    if (!tokenEngine.getAccount(userId)) tokenEngine.registerAccount(userId);

    if (mode === 'chat' || (!prompt && mode === 'chat')) {
      if (!prompt) {
        await sock.sendMessage(msg.key.remoteJid, {
          text: `*AI Chat*\n\n!ai chat <pertanyaan>\n!ai fix <error>\n!ai code <kode>\n!ai explain <kode>\n!ai summarize <teks>\n!ai translate <teks> ke <bahasa>`
        });
        return;
      }
      const cost = tokenEngine.spend(userId, 'ai_fallback');
      if (!cost.success) {
        await sock.sendMessage(msg.key.remoteJid, { text: `Token tidak cukup: ${cost.error}` });
        return;
      }
      try {
        const ai = await askAiFallback({
          errorText: prompt,
          provider: 'auto',
          context: 'User chat query'
        });
        await sock.sendMessage(msg.key.remoteJid, {
          text: `🤖 *${ai.provider.toUpperCase()}*\n\n${ai.text.slice(0, 3500)}\n\nCost: ${cost.cost} tokens | Balance: ${cost.balance}`
        });
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { text: `AI error: ${err.message}` });
      }
      return;
    }

    if (mode === 'fix') {
      if (!prompt) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !ai fix <error log>' });
        return;
      }
      const cost = tokenEngine.spend(userId, 'ai_fallback');
      if (!cost.success) {
        await sock.sendMessage(msg.key.remoteJid, { text: `Token tidak cukup: ${cost.error}` });
        return;
      }
      try {
        const ai = await askAiFallback({
          errorText: prompt,
          provider: 'auto',
          context: 'Fix error analysis'
        });
        await sock.sendMessage(msg.key.remoteJid, {
          text: `🤖 *AI Fix Analysis*\n\n${ai.text.slice(0, 3500)}\n\nCost: ${cost.cost} tokens | Balance: ${cost.balance}`
        });
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { text: `AI error: ${err.message}` });
      }
      return;
    }

    if (mode === 'code') {
      if (!prompt) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !ai code <tugas kode>' });
        return;
      }
      const cost = tokenEngine.spend(userId, 'ai_fallback');
      if (!cost.success) {
        await sock.sendMessage(msg.key.remoteJid, { text: `Token tidak cukup: ${cost.error}` });
        return;
      }
      try {
        const ai = await askAiFallback({
          errorText: `Write code for: ${prompt}`,
          provider: 'auto',
          context: 'Code generation'
        });
        await sock.sendMessage(msg.key.remoteJid, {
          text: `🤖 *AI Code*\n\n${ai.text.slice(0, 3500)}\n\nCost: ${cost.cost} tokens | Balance: ${cost.balance}`
        });
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { text: `AI error: ${err.message}` });
      }
      return;
    }

    if (mode === 'explain') {
      if (!prompt) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !ai explain <kode>' });
        return;
      }
      const cost = tokenEngine.spend(userId, 'ai_fallback');
      if (!cost.success) {
        await sock.sendMessage(msg.key.remoteJid, { text: `Token tidak cukup: ${cost.error}` });
        return;
      }
      try {
        const ai = await askAiFallback({
          errorText: `Explain this code: ${prompt}`,
          provider: 'auto',
          context: 'Code explanation'
        });
        await sock.sendMessage(msg.key.remoteJid, {
          text: `🤖 *AI Explanation*\n\n${ai.text.slice(0, 3500)}\n\nCost: ${cost.cost} tokens | Balance: ${cost.balance}`
        });
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { text: `AI error: ${err.message}` });
      }
      return;
    }

    if (mode === 'summarize') {
      if (!prompt) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !ai summarize <teks>' });
        return;
      }
      const cost = tokenEngine.spend(userId, 'ai_fallback');
      if (!cost.success) {
        await sock.sendMessage(msg.key.remoteJid, { text: `Token tidak cukup: ${cost.error}` });
        return;
      }
      try {
        const ai = await askAiFallback({
          errorText: `Summarize: ${prompt}`,
          provider: 'auto',
          context: 'Text summarization'
        });
        await sock.sendMessage(msg.key.remoteJid, {
          text: `🤖 *Summary*\n\n${ai.text.slice(0, 3500)}\n\nCost: ${cost.cost} tokens | Balance: ${cost.balance}`
        });
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { text: `AI error: ${err.message}` });
      }
      return;
    }

    if (mode === 'translate') {
      const textToTranslate = prompt.split(' ke ')[0];
      const targetLang = prompt.split(' ke ')[1] || 'English';
      if (!textToTranslate) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Format: !ai translate <teks> ke <bahasa>' });
        return;
      }
      const cost = tokenEngine.spend(userId, 'ai_fallback');
      if (!cost.success) {
        await sock.sendMessage(msg.key.remoteJid, { text: `Token tidak cukup: ${cost.error}` });
        return;
      }
      try {
        const ai = await askAiFallback({
          errorText: `Translate to ${targetLang}: ${textToTranslate}`,
          provider: 'auto',
          context: 'Translation'
        });
        await sock.sendMessage(msg.key.remoteJid, {
          text: `🤖 *Translation (${targetLang})*\n\n${ai.text.slice(0, 3500)}\n\nCost: ${cost.cost} tokens | Balance: ${cost.balance}`
        });
      } catch (err) {
        await sock.sendMessage(msg.key.remoteJid, { text: `AI error: ${err.message}` });
      }
      return;
    }

    await sock.sendMessage(msg.key.remoteJid, {
      text: `*AI Commands*\n\n!ai chat <question>\n!ai fix <error>\n!ai code <task>\n!ai explain <code>\n!ai summarize <text>\n!ai translate <text> ke <language>`
    });
  }
};
