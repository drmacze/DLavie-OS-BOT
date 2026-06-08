-- DLavie OS - Supabase Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE dlavie_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT UNIQUE,
  role TEXT DEFAULT 'USER',
  tokens INTEGER DEFAULT 5000,
  total_earned INTEGER DEFAULT 5000,
  total_spent INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Connected bots
CREATE TABLE dlavie_bots (
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
CREATE TABLE dlavie_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES dlavie_users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- spend, earn, deduct, topup
  amount INTEGER NOT NULL,
  feature TEXT,
  reason TEXT,
  balance_after INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit logs
CREATE TABLE dlavie_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  user_id UUID REFERENCES dlavie_users(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}',
  severity TEXT DEFAULT 'info',
  ip TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Plugin registry
CREATE TABLE dlavie_plugins (
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
CREATE TABLE dlavie_bot_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  owner_id UUID REFERENCES dlavie_users(id) ON DELETE CASCADE,
  bot_tokens JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scheduled tasks
CREATE TABLE dlavie_tasks (
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
CREATE TABLE dlavie_errors (
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
CREATE TABLE dlavie_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES dlavie_users(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES dlavie_users(id) ON DELETE CASCADE,
  bonus_amount INTEGER DEFAULT 500,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_bots_owner ON dlavie_bots(owner_id);
CREATE INDEX idx_bots_status ON dlavie_bots(status);
CREATE INDEX idx_bots_token ON dlavie_bots(token);
CREATE INDEX idx_transactions_user ON dlavie_transactions(user_id);
CREATE INDEX idx_transactions_created ON dlavie_transactions(created_at);
CREATE INDEX idx_audit_user ON dlavie_audit_logs(user_id);
CREATE INDEX idx_audit_action ON dlavie_audit_logs(action);
CREATE INDEX idx_audit_created ON dlavie_audit_logs(created_at);
CREATE INDEX idx_errors_hash ON dlavie_errors(hash);
CREATE INDEX idx_errors_bot ON dlavie_errors(bot_id);
CREATE INDEX idx_errors_resolved ON dlavie_errors(resolved);

-- Row Level Security (RLS)
ALTER TABLE dlavie_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dlavie_bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE dlavie_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dlavie_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dlavie_bot_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE dlavie_tasks ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own data" ON dlavie_users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can view own bots" ON dlavie_bots
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can view own transactions" ON dlavie_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own audit logs" ON dlavie_audit_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own groups" ON dlavie_bot_groups
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can view own tasks" ON dlavie_tasks
  FOR SELECT USING (auth.uid() = owner_id);

-- Functions
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON dlavie_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Realtime
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE dlavie_bots;
ALTER PUBLICATION supabase_realtime ADD TABLE dlavie_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE dlavie_audit_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE dlavie_errors;
