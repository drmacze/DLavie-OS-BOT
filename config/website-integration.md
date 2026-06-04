# DLavie OS - Website Integration Guide

## Overview
This guide helps you integrate the DLavie OS Bot with your website dashboard.

## API Endpoints

### Base URL
```
http://your-bot-domain:8080/api
```

### Authentication
All endpoints require a Bearer token:
```
Authorization: Bearer <jwt_token>
```

To get a token:
```
POST /api/auth/login
Body: { "userId": "your-user-id", "password": "your-password" }
```

### Endpoints

#### Health Check
```
GET /api/health
```

#### Engine Status
```
GET /api/status
```

#### Multi-Bot
```
GET /api/bots                    # List all bots
GET /api/bots/:token             # Get bot status
POST /api/bots/:token/relay       # Relay command
Body: { "command": "ping", "args": {} }
```

#### Token System
```
GET /api/tokens/:userId          # Get balance
GET /api/tokens/:userId/history  # Get history
GET /api/tokens/:userId/heatmap  # Get heatmap
```

#### Monitoring
```
GET /api/monitoring/health       # Health report
GET /api/monitoring/errors       # Error summary
```

#### Plugins
```
GET /api/plugins                 # List installed
GET /api/plugins/search?q=query  # Search marketplace
```

#### Audit
```
GET /api/audit?userId=&action=&severity=&limit=50
```

## WebSocket

### Connection
```
ws://your-bot-domain:8081/ws
```

### Subscribe to channels
```javascript
ws.send(JSON.stringify({ subscribe: 'bot.updates' }));
```

### Available channels
- `bot.updates` - Bot status changes
- `health.updates` - Health metrics
- `errors` - Error reports
- `*` - All channels

### Message format
```json
{
  "event": "bot.updates",
  "data": { ... },
  "timestamp": 1234567890
}
```

## Supabase Integration

### Environment Variables
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Tables to Create
```sql
-- Users table
CREATE TABLE dlavie_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT UNIQUE,
  role TEXT DEFAULT 'USER',
  tokens INTEGER DEFAULT 5000,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Connected bots
CREATE TABLE dlavie_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE,
  name TEXT,
  owner_id UUID REFERENCES dlavie_users(id),
  status TEXT DEFAULT 'offline',
  health_score INTEGER DEFAULT 100,
  connected_at TIMESTAMP,
  last_heartbeat TIMESTAMP,
  version TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Token transactions
CREATE TABLE dlavie_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES dlavie_users(id),
  type TEXT, -- spend, earn, deduct
  amount INTEGER,
  feature TEXT,
  balance_after INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit logs
CREATE TABLE dlavie_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT,
  user_id UUID REFERENCES dlavie_users(id),
  details JSONB DEFAULT '{}',
  severity TEXT DEFAULT 'info',
  ip TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Plugin registry
CREATE TABLE dlavie_plugins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id TEXT UNIQUE,
  name TEXT,
  version TEXT,
  description TEXT,
  url TEXT,
  dependencies JSONB DEFAULT '[]',
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Bot groups
CREATE TABLE dlavie_bot_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  owner_id UUID REFERENCES dlavie_users(id),
  bot_tokens JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Scheduled tasks
CREATE TABLE dlavie_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  cron_expression TEXT,
  command TEXT,
  owner_id UUID REFERENCES dlavie_users(id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Realtime Subscriptions
Enable Supabase realtime for tables:
- `dlavie_bots` - Live bot status updates
- `dlavie_transactions` - Live token changes
- `dlavie_audit_logs` - Live audit events

```javascript
const subscription = supabase
  .from('dlavie_bots')
  .on('INSERT', callback)
  .on('UPDATE', callback)
  .subscribe();
```

## Webhook Configuration

### Environment Variables
```env
DLAVIE_ENABLE_WEBHOOK=true
DLAVIE_WEBHOOK_URL=https://your-website.com/api/webhooks/dlavie
```

### Webhook Payload
```json
{
  "event": "bot.connected",
  "payload": {
    "botName": "DLavie OS",
    "timestamp": 1234567890
  },
  "timestamp": 1234567890,
  "source": "dlavie-os-bot"
}
```

### Headers
```
Content-Type: application/json
X-DLavie-Event: bot.connected
X-DLavie-Signature: <hmac-signature>
```

## JWT Configuration

### Secret
```env
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRY=7d
```

### Token Claims
```json
{
  "userId": "628123456789",
  "role": "OWNER",
  "iat": 1234567890,
  "exp": 1234571490
}
```

## CORS
Configure allowed origins:
```env
CORS_ORIGINS=https://your-website.com,https://app.your-website.com
```

## Rate Limits
- 100 requests per 15 minutes per IP
- 1000 requests per hour per authenticated user

## Dashboard Widget Ideas
1. **Bot Grid** - Visual grid of all connected bots with health indicators
2. **Token Gauge** - Circular gauge showing token balance
3. **Health Chart** - Line chart of system health over time
4. **Error Feed** - Real-time error stream
5. **Command Terminal** - Web-based terminal to send commands
6. **Plugin Cards** - Visual plugin marketplace
7. **Audit Timeline** - Timeline of all actions
8. **Heatmap** - Token usage heatmap
