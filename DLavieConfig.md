# DLavie OS - Configuration Template

## CARA MENGISI CONFIG

1. Copy file ini ke `.env` (bukan .env.example)
2. Isi semua field yang ditandai **[REQUIRED]**
3. Untuk field yang ditandai **[OPTIONAL]** boleh dikosongkan jika tidak dipakai
4. Jangan commit file `.env` ke GitHub!

---

## 1. BOT IDENTITY [REQUIRED]

```env
# Nomor WhatsApp bot (format: tanpa +, tanpa spasi)
# Contoh: 6285725483343
BOT_NUMBER=6285725483343

# Nomor WhatsApp owner (format: sama seperti di atas)
OWNER_NUMBER=62882007437216

# Nama bot yang akan muncul di pesan
BOT_NAME=DLavie OS
```

---

## 2. SUPABASE DATABASE [REQUIRED untuk website]

```env
# URL project Supabase kamu
# Format: https://[project-id].supabase.co
# Cara dapat: Dashboard Supabase > Project Settings > API
SUPABASE_URL=https://your-project.supabase.co

# Anon key (public key, aman untuk client-side)
# Cara dapat: Dashboard Supabase > Project Settings > API > anon public
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx

# Service role key (SECRET, jangan share!)
# Cara dapat: Dashboard Supabase > Project Settings > API > service_role secret
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx
```

---

## 3. API SERVER [REQUIRED]

```env
# Port API server (Replit: gunakan 8080 atau 3000)
API_PORT=8080

# Host API (biasanya 0.0.0.0 untuk semua interface)
API_HOST=0.0.0.0

# JWT Secret (ganti dengan random string panjang, minimal 32 karakter)
# Cara generate: buka https://randomkeygen.com/ dan pilih "Encryption Key"
JWT_SECRET=dlavie-super-secret-2026-change-this-now

# JWT expiry (format: 7d = 7 hari, 1h = 1 jam, 30m = 30 menit)
JWT_EXPIRY=7d

# Domain website yang diizinkan CORS (pisahkan dengan koma)
# Contoh: https://dlavie.mywebsite.com,https://app.dlavie.mywebsite.com
CORS_ORIGINS=https://your-website.com
```

---

## 4. WEBSOCKET [OPTIONAL]

```env
# Port WebSocket (biasanya sama dengan API port, atau beda)
WS_PORT=8081

# Enable WebSocket?
WS_ENABLED=true
```

---

## 5. AI FALLBACK [OPTIONAL - tapi sangat direkomendasikan]

```env
# Urutan AI provider yang dipakai (dipisah koma)
# Pilihan: gemini, chatgpt, grok
# Default: grok,gemini,chatgpt
DLAVIE_AI_ORDER=grok,gemini,chatgpt

# === Gemini AI ===
# API Key dari Google AI Studio: https://aistudio.google.com/
GEMINI_API_KEY=AIzaSyBxxx
GEMINI_MODEL=gemini-1.5-flash

# === ChatGPT / OpenAI ===
# API Key dari: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-xxx
OPENAI_MODEL=gpt-4o-mini

# === Grok / xAI ===
# API Key dari: https://console.x.ai/
GROK_API_KEY=xai-xxx
GROK_MODEL=grok-2-latest
```

---

## 6. TOKEN SYSTEM [OPTIONAL]

```env
# Token gratis untuk akun baru
DLAVIE_DEFAULT_FREE_TOKENS=5000

# Rate limit: token yang di-reset setiap interval
DLAVIE_RATE_LIMIT_AMOUNT=100
DLAVIE_RATE_LIMIT_WINDOW=600

# Pengali biaya (1.0 = normal, 0.5 = setengah, 2.0 = dua kali)
DLAVIE_COST_MULTIPLIER=1.0
```

---

## 7. MULTI-BOT [OPTIONAL]

```env
# Maksimal bot per user
DLAVIE_MAX_BOTS_PER_USER=5

# Interval heartbeat (detik)
DLAVIE_HEARTBEAT_INTERVAL=30

# Auto reconnect bot?
DLAVIE_AUTO_RECONNECT=true
```

---

## 8. SECURITY [OPTIONAL]

```env
# Stealth mode (bot tidak membalas chat biasa)
DLAVIE_STEALTH_MODE=false

# Emergency lockdown (lock semua akun)
DLAVIE_EMERGENCY_LOCKDOWN=false

# Maksimal percobaan login salah
DLAVIE_MAX_LOGIN_ATTEMPTS=5

# Durasi lockout (detik)
DLAVIE_LOCKOUT_DURATION=3600
```

---

## 9. MONITORING [OPTIONAL]

```env
# Interval health check (detik)
DLAVIE_HEALTH_CHECK_INTERVAL=60

# Retensi log (hari)
DLAVIE_LOG_RETENTION=7

# Threshold anomaly detection (0.0-1.0)
DLAVIE_ANOMALY_THRESHOLD=0.8
```

---

## 10. PLUGIN [OPTIONAL]

```env
# URL registry plugin marketplace
DLAVIE_PLUGIN_REGISTRY=https://raw.githubusercontent.com/drmacze/DLavie-Plugins/main/registry.json

# Enable plugin sandbox?
DLAVIE_PLUGIN_SANDBOX=true

# Auto update plugin?
DLAVIE_PLUGIN_AUTO_UPDATE=false
```

---

## 11. WEBSITE INTEGRATION [REQUIRED]

```env
# URL dashboard website kamu
# Contoh: https://dlavie.mywebsite.com
DLAVIE_DASHBOARD_URL=https://your-website.com

# URL webhook untuk menerima event dari bot
# Contoh: https://your-website.com/api/webhooks/dlavie
DLAVIE_WEBHOOK_URL=https://your-website.com/api/webhooks/dlavie

# Enable webhook?
DLAVIE_ENABLE_WEBHOOK=false
```

---

## 12. AUTO-FIX [OPTIONAL]

```env
# Repair saat startup?
DLAVIE_STARTUP_REPAIR=true

# Auto-fix dengan AI?
DLAVIE_AI_AUTOFIX=false

# Auto-install dependency yang hilang?
DLAVIE_AUTOFIX_INSTALL_MISSING=false
```

---

## CONTOH .env LENGKAP

```env
# ============ BOT IDENTITY ============
BOT_NUMBER=6285725483343
OWNER_NUMBER=62882007437216
BOT_NAME=DLavie OS

# ============ SUPABASE ============
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx

# ============ API ============
API_PORT=8080
API_HOST=0.0.0.0
JWT_SECRET=dlavie-super-secret-2026-change-this-now
JWT_EXPIRY=7d
CORS_ORIGINS=https://your-website.com

# ============ WEBSOCKET ============
WS_PORT=8081
WS_ENABLED=true

# ============ AI ============
DLAVIE_AI_ORDER=grok,gemini,chatgpt
GEMINI_API_KEY=AIzaSyBxxx
GEMINI_MODEL=gemini-1.5-flash
OPENAI_API_KEY=sk-proj-xxx
OPENAI_MODEL=gpt-4o-mini
GROK_API_KEY=xai-xxx
GROK_MODEL=grok-2-latest

# ============ TOKEN ============
DLAVIE_DEFAULT_FREE_TOKENS=5000
DLAVIE_RATE_LIMIT_AMOUNT=100
DLAVIE_RATE_LIMIT_WINDOW=600
DLAVIE_COST_MULTIPLIER=1.0

# ============ MULTI-BOT ============
DLAVIE_MAX_BOTS_PER_USER=5
DLAVIE_HEARTBEAT_INTERVAL=30
DLAVIE_AUTO_RECONNECT=true

# ============ SECURITY ============
DLAVIE_STEALTH_MODE=false
DLAVIE_EMERGENCY_LOCKDOWN=false
DLAVIE_MAX_LOGIN_ATTEMPTS=5
DLAVIE_LOCKOUT_DURATION=3600

# ============ MONITORING ============
DLAVIE_HEALTH_CHECK_INTERVAL=60
DLAVIE_LOG_RETENTION=7
DLAVIE_ANOMALY_THRESHOLD=0.8

# ============ PLUGIN ============
DLAVIE_PLUGIN_REGISTRY=https://raw.githubusercontent.com/drmacze/DLavie-Plugins/main/registry.json
DLAVIE_PLUGIN_SANDBOX=true
DLAVIE_PLUGIN_AUTO_UPDATE=false

# ============ WEBSITE ============
DLAVIE_DASHBOARD_URL=https://your-website.com
DLAVIE_WEBHOOK_URL=https://your-website.com/api/webhooks/dlavie
DLAVIE_ENABLE_WEBHOOK=false

# ============ AUTO-FIX ============
DLAVIE_STARTUP_REPAIR=true
DLAVIE_AI_AUTOFIX=false
DLAVIE_AUTOFIX_INSTALL_MISSING=false
```

---

## CARA DAPATKAN API KEY

| Provider | Link | Cara |
|----------|------|------|
| **Supabase** | https://supabase.com | Buat project gratis, copy URL & keys dari Settings > API |
| **Gemini** | https://aistudio.google.com | Buat API key gratis, copy key |
| **OpenAI** | https://platform.openai.com | Buat API key (berbayar), copy key |
| **Grok/xAI** | https://console.x.ai | Buat API key, copy key |

---

## CARA SET ENV DI REPLIT

1. Klik tombol **Secrets** (icon gembok) di panel kanan
2. Klik **New Secret**
3. Isi Key dan Value
4. Ulangi untuk semua secrets di atas
5. Restart bot setelah selesai

Atau buat file `.env` di root project:
```bash
cat > .env << 'EOF'
# Paste semua config di sini
EOF
```
