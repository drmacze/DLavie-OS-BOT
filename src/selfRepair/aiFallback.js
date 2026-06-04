function providerOrder() {
  return (process.env.DLAVIE_AI_ORDER || 'gemini,chatgpt,grok')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function buildPrompt(errorText, context = '') {
  return [
    'You are DLavie OS Bot repair assistant for a Node.js WhatsApp Baileys bot.',
    'Analyze the error and return concise, safe repair guidance.',
    'Do not expose secrets. Prefer deterministic fixes first.',
    'Return Indonesian language output with: Ringkasan, Penyebab, Langkah Fix, Patch Jika Perlu, Risiko.',
    context ? `Context:\n${context}` : '',
    `Error/log:\n${String(errorText || '').slice(0, 12000)}`
  ].filter(Boolean).join('\n\n');
}

async function postJson(url, headers, body, timeoutMs = 45000) {
  if (typeof fetch !== 'function') throw new Error('Global fetch tidak tersedia. Gunakan Node.js >=18.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }

    if (!res.ok) {
      const reason = json?.error?.message || json?.raw || `${res.status} ${res.statusText}`;
      throw new Error(String(reason).slice(0, 500));
    }

    return json;
  } finally {
    clearTimeout(timeout);
  }
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY belum ada.');

  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const json = await postJson(url, {}, {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2 }
  });

  const parts = json?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((part) => part.text || '').join('\n').trim();
  if (!text) throw new Error('Gemini tidak mengembalikan teks.');
  return text;
}

async function callChatGPT(prompt) {
  const apiKey = process.env.CHATGPT_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('CHATGPT_API_KEY/OPENAI_API_KEY belum ada.');

  const model = process.env.CHATGPT_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const json = await postJson('https://api.openai.com/v1/chat/completions', {
    Authorization: `Bearer ${apiKey}`
  }, {
    model,
    temperature: 0.2,
    messages: [
      { role: 'system', content: 'You repair Node.js WhatsApp bot errors safely.' },
      { role: 'user', content: prompt }
    ]
  });

  const text = json?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('ChatGPT tidak mengembalikan teks.');
  return text;
}

async function callGrok(prompt) {
  const apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
  if (!apiKey) throw new Error('GROK_API_KEY/XAI_API_KEY belum ada.');

  const model = process.env.GROK_MODEL || process.env.XAI_MODEL || 'grok-2-latest';
  const json = await postJson('https://api.x.ai/v1/chat/completions', {
    Authorization: `Bearer ${apiKey}`
  }, {
    model,
    temperature: 0.2,
    messages: [
      { role: 'system', content: 'You repair Node.js WhatsApp bot errors safely.' },
      { role: 'user', content: prompt }
    ]
  });

  const text = json?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Grok tidak mengembalikan teks.');
  return text;
}

async function askAiFallback({ errorText, context = '', provider = 'auto' } = {}) {
  const prompt = buildPrompt(errorText, context);
  const order = provider === 'auto' ? providerOrder() : [provider.toLowerCase()];
  const errors = [];

  for (const name of order) {
    try {
      if (name === 'gemini') return { provider: 'gemini', text: await callGemini(prompt) };
      if (name === 'chatgpt' || name === 'openai') return { provider: 'chatgpt', text: await callChatGPT(prompt) };
      if (name === 'grok' || name === 'xai') return { provider: 'grok', text: await callGrok(prompt) };
      errors.push(`${name}: provider tidak dikenal`);
    } catch (err) {
      errors.push(`${name}: ${err.message}`);
    }
  }

  throw new Error(`Semua AI fallback gagal: ${errors.join(' | ')}`);
}

module.exports = { askAiFallback, buildPrompt };
