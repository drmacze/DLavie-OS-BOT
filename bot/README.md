# DLavie OS Bot v2.0

WhatsApp Multi-Device Bot Control Platform dengan **Multi-Bot Control**, **Token System**, **Monitoring**, dan **Website Integration**.

## Fitur

### Core Multi-Bot Control
- Hubungkan banyak bot WhatsApp ke DLavie OS
- Centralized Command Relay ke semua bot
- Bot Health Score (0-100)
- Bulk Command Execution
- Bot Grouping & Management
- Real-time Heartbeat Monitoring

### Token System
- 5,000 free tokens untuk akun baru
- Rate limit: 100 tokens / 10 menit
- Feature-based cost system
- Token History & Heatmap
- Low Token Warning
- Referral Bonus

### Security & Permission
- Role System (Owner 100, Admin 80, User 50, Guest 10)
- Command Authentication
- Temporary Access Token
- Audit Log lengkap
- Stealth Mode
- Emergency Lockdown

### Monitoring & Diagnostics
- Smart Error Aggregator
- Plugin Health Monitor
- Performance Profiler
- Auto Diagnostic Report
- Real-time Log Streaming
- Anomaly Detection
- Memory & CPU Monitor

### Automation
- Scheduled Task System
- Cron-based scheduling
- Auto Plugin Update
- Rollback support
- Task History

### Plugin System
- Plugin Marketplace
- One-Click Install
- Version Control
- Dependency Resolver
- Health Score
- Sandbox Mode
- Hot Reload

### Auto-Fix System
- Rule-based deterministic fix
- AI Fallback (Grok, Gemini, ChatGPT)
- Owner confirmation sebelum apply
- Toggle on/off
- Graceful error handling

### Website Integration
- REST API (Express)
- WebSocket Real-time
- Supabase Database
- JWT Authentication
- Webhook Events
- Full documentation

## Instalasi

```bash
npm install
npm start
```

## Environment Variables

Salin `.env.example` ke `.env` dan isi:

```env
BOT_NUMBER=6285725483343
OWNER_NUMBER=62882007437216
BOT_NAME=DLavie OS

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# API
API_PORT=8080
JWT_SECRET=your-secret

# AI (opsional)
GEMINI_API_KEY=
OPENAI_API_KEY=
GROK_API_KEY=
```

## Command WhatsApp

| Command | Role | Fungsi |
|---|---|---|
| `!menu` | Guest | Menu utama |
| `!halo` | Guest | Greeting |
| `!ping` | Guest | Status check |
| `!info` | Guest | System info |
| `!token` | User | Token management |
| `!bot` | User | Multi-bot control |
| `!plugin` | User | Plugin management |
| `!monitor` | User | Monitoring |
| `!owner` | Owner | Owner commands |
| `!status` | Owner | Full system status |
| `!lockdown` | Owner | Emergency lockdown |
| `!stealth` | Owner | Stealth mode |
| `!audit` | Owner | Audit logs |
| `!broadcast` | Owner | Broadcast message |
| `!schedule` | Owner | Scheduled tasks |
| `!fix` | Owner | Auto-fix system |

## API Endpoints

| Method | Endpoint | Auth |
|---|---|---|
| GET | `/api/health` | Optional |
| GET | `/api/status` | Required |
| GET | `/api/bots` | Required |
| GET | `/api/bots/:token` | Required |
| POST | `/api/bots/:token/relay` | Required |
| GET | `/api/tokens/:userId` | Required |
| GET | `/api/monitoring/health` | Required |
| GET | `/api/monitoring/errors` | Required |
| GET | `/api/plugins` | Required |
| POST | `/api/auth/login` | None |

## WebSocket

```javascript
const ws = new WebSocket('ws://your-domain:8081/ws');
ws.on('open', () => {
  ws.send(JSON.stringify({ subscribe: 'bot.updates' }));
});
```

## Supabase Setup

1. Buat project di Supabase
2. Jalankan schema dari `config/supabase-schema.sql`
3. Aktifkan Realtime untuk tables
4. Isi environment variables

## Website Integration

Lihat `config/website-integration.md` untuk panduan lengkap.

## Arsitektur

```
DLavie OS Bot
├── Core Engine (orchestrator)
├── Database (Supabase)
├── API Server (Express + WebSocket)
├── WhatsApp Bot (Baileys)
├── Multi-Bot Manager
├── Token Engine
├── Permission System
├── Health Monitor
├── Error Aggregator
├── Plugin Manager
├── Task Scheduler
├── Auto-Fix Controller
└── Webhook Manager
```

## License

Private - DLavie OS
