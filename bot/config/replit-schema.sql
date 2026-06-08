-- DLavie OS - Replit PostgreSQL Schema
-- Adapted from Supabase schema for Replit PostgreSQL

-- Users table
CREATE TABLE IF NOT EXISTS dlavie_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT UNIQUE,
  email TEXT UNIQUE,
  name TEXT,
  role TEXT DEFAULT 'USER',
  tokens INTEGER DEFAULT 5000,
  total_earned INTEGER DEFAULT 5000,
  total_spent INTEGER DEFAULT 0,
  password_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Connected bots
CREATE TABLE IF NOT EXISTS dlavie_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  name TEXT,
  phone_number TEXT,
  owner_id UUID REFERENCES dlavie_users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'offline',
  health_score INTEGER DEFAULT 100,
  connected_at TIMESTAMP WITH TIME ZONE,
  last_heartbeat TIMESTAMP WITH TIME ZONE,
  version TEXT,
  metadata JSONB DEFAULT '{}',
  capabilities JSONB DEFAULT '[]',
  ip TEXT,
  platform TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Token transactions
CREATE TABLE IF NOT EXISTS dlavie_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES dlavie_users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  feature TEXT,
  reason TEXT,
  balance_after INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit logs
CREATE TABLE IF NOT EXISTS dlavie_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  user_id UUID REFERENCES dlavie_users(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}',
  severity TEXT DEFAULT 'info',
  ip TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Plugin registry
CREATE TABLE IF NOT EXISTS dlavie_plugins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id TEXT UNIQUE NOT NULL,
  name TEXT,
  version TEXT,
  description TEXT,
  url TEXT,
  dependencies JSONB DEFAULT '[]',
  tags JSONB DEFAULT '[]',
  author TEXT,
  downloads INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bot groups
CREATE TABLE IF NOT EXISTS dlavie_bot_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  owner_id UUID REFERENCES dlavie_users(id) ON DELETE CASCADE,
  bot_tokens JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scheduled tasks
CREATE TABLE IF NOT EXISTS dlavie_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  cron_expression TEXT,
  command TEXT,
  owner_id UUID REFERENCES dlavie_users(id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT true,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Error logs
CREATE TABLE IF NOT EXISTS dlavie_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hash TEXT,
  error_text TEXT,
  stack TEXT,
  count INTEGER DEFAULT 1,
  severity TEXT DEFAULT 'low',
  bot_id UUID REFERENCES dlavie_bots(id) ON DELETE SET NULL,
  source TEXT,
  first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Referrals
CREATE TABLE IF NOT EXISTS dlavie_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES dlavie_users(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES dlavie_users(id) ON DELETE CASCADE,
  bonus_amount INTEGER DEFAULT 500,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Web dashboard users
CREATE TABLE IF NOT EXISTS dlavie_web_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE,
  email TEXT UNIQUE,
  name TEXT,
  password_hash TEXT,
  plan TEXT DEFAULT 'free',
  tokens INTEGER DEFAULT 5000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,
  bots JSONB DEFAULT '[]',
  recent_activity JSONB DEFAULT '[]',
  token_history JSONB DEFAULT '[]',
  token_used_today INTEGER DEFAULT 0,
  commands_today INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'
);

-- Payments (QRIS topup & plan upgrade)
CREATE TABLE IF NOT EXISTS dlavie_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  struk_id TEXT UNIQUE NOT NULL,
  user_email TEXT,
  wa_user_id TEXT,
  type TEXT NOT NULL,
  plan TEXT,
  amount INTEGER NOT NULL,
  amount_tokens INTEGER,
  nama TEXT,
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  proof_url TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  expired_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by TEXT,
  rejected_at TIMESTAMP WITH TIME ZONE,
  reject_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bot customization (per owner)
CREATE TABLE IF NOT EXISTS dlavie_bot_customization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_phone TEXT UNIQUE NOT NULL,
  config JSONB DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bot connections (web dashboard linking)
CREATE TABLE IF NOT EXISTS dlavie_bot_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id TEXT UNIQUE NOT NULL,
  bot_number TEXT,
  owner_web_user_id TEXT,
  owner_email TEXT,
  owner_phone TEXT,
  plan TEXT DEFAULT 'free',
  status TEXT DEFAULT 'active',
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_ping TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Connect tokens (for !connect verify)
CREATE TABLE IF NOT EXISTS dlavie_connect_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  owner_web_user_id TEXT,
  owner_email TEXT,
  plan TEXT DEFAULT 'free',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bots_owner ON dlavie_bots(owner_id);
CREATE INDEX IF NOT EXISTS idx_bots_status ON dlavie_bots(status);
CREATE INDEX IF NOT EXISTS idx_bots_token ON dlavie_bots(token);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON dlavie_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON dlavie_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_user ON dlavie_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON dlavie_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON dlavie_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_errors_hash ON dlavie_errors(hash);
CREATE INDEX IF NOT EXISTS idx_errors_bot ON dlavie_errors(bot_id);
CREATE INDEX IF NOT EXISTS idx_errors_resolved ON dlavie_errors(resolved);
CREATE INDEX IF NOT EXISTS idx_web_users_email ON dlavie_web_users(email);
CREATE INDEX IF NOT EXISTS idx_web_users_user_id ON dlavie_web_users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_phone ON dlavie_users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_email ON dlavie_users(email);
CREATE INDEX IF NOT EXISTS idx_payments_email ON dlavie_payments(user_email);
CREATE INDEX IF NOT EXISTS idx_payments_struk ON dlavie_payments(struk_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON dlavie_payments(status);
CREATE INDEX IF NOT EXISTS idx_bot_connections_email ON dlavie_bot_connections(owner_email);
CREATE INDEX IF NOT EXISTS idx_connect_tokens ON dlavie_connect_tokens(token);