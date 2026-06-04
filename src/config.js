try { require('dotenv').config(); } catch { /* dotenv optional during auto-repair */ }

const config = {
  botNumber: process.env.BOT_NUMBER || '6285725483343',
  ownerNumber: process.env.OWNER_NUMBER || '62882007437216',
  botName: process.env.BOT_NAME || 'DLV BOT',

  autoFix: {
    startupRepair: process.env.DLAVIE_STARTUP_REPAIR !== 'false',
    aiFallback: process.env.DLAVIE_AI_AUTOFIX === 'true',
    installMissing: process.env.DLAVIE_AUTOFIX_INSTALL_MISSING === 'true',
    providerOrder: process.env.DLAVIE_AI_ORDER || 'gemini,chatgpt,grok'
  },

  ai: {
    gemini: {
      enabled: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
    },
    chatgpt: {
      enabled: Boolean(process.env.CHATGPT_API_KEY || process.env.OPENAI_API_KEY),
      model: process.env.CHATGPT_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini'
    },
    grok: {
      enabled: Boolean(process.env.GROK_API_KEY || process.env.XAI_API_KEY),
      model: process.env.GROK_MODEL || process.env.XAI_MODEL || 'grok-2-latest'
    }
  }
};

module.exports = config;
