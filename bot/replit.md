# DLavie OS Bot v2.0

A WhatsApp Multi-Device Bot Control Platform with a web dashboard, token-based monetization, multi-bot management, and a self-repairing engine.

## How to Run

The app starts automatically via the **DLavie WA Bot** workflow, which runs `npm start`.

- **Web Dashboard**: port 5000
- **API Server**: port 8080

## Key Configuration

All configuration is in `DLavieConfig.js` and `src/config.js`. Values can be overridden with environment variables.

| Variable | Description |
|---|---|
| `BOT_NUMBER` | WhatsApp number for the bot (e.g. `628123456789`) |
| `OWNER_NUMBER` | Owner's WhatsApp number |
| `BOT_NAME` | Bot display name |
| `JWT_SECRET` | Secret key for JWT auth tokens (auto-generated) |
| `SUPABASE_URL` | Optional: Supabase project URL |
| `SUPABASE_ANON_KEY` | Optional: Supabase anon key |
| `GEMINI_API_KEY` | Optional: Gemini AI key for auto-fix |
| `OPENAI_API_KEY` | Optional: OpenAI key for auto-fix |
| `GROK_API_KEY` | Optional: Grok/xAI key for auto-fix |

## Database

The app uses **Replit PostgreSQL** by default (automatically connected). Supabase is optional.

## WhatsApp Connection

On first run, a QR code or pairing code will appear in the console. Scan it with your WhatsApp to connect the bot.

## User Preferences

- Language: Indonesian (Bahasa Indonesia) with English support
- Timezone: Asia/Jakarta
