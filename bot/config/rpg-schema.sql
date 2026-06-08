-- DLavie RPG - Game Tables Schema

CREATE TABLE IF NOT EXISTS dlavie_rpg_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  char_name TEXT NOT NULL,
  char_class TEXT NOT NULL DEFAULT 'balanced',
  level INTEGER DEFAULT 1,
  exp INTEGER DEFAULT 0,
  exp_to_next INTEGER DEFAULT 100,
  hp INTEGER DEFAULT 100,
  max_hp INTEGER DEFAULT 100,
  mp INTEGER DEFAULT 50,
  max_mp INTEGER DEFAULT 50,
  str INTEGER DEFAULT 10,
  int_stat INTEGER DEFAULT 10,
  agi INTEGER DEFAULT 10,
  vit INTEGER DEFAULT 10,
  luk INTEGER DEFAULT 10,
  gold INTEGER DEFAULT 100,
  gems INTEGER DEFAULT 0,
  story_chapter INTEGER DEFAULT 0,
  story_scene INTEGER DEFAULT 0,
  exploration_zone TEXT DEFAULT 'aethoria_forest',
  pvp_wins INTEGER DEFAULT 0,
  pvp_losses INTEGER DEFAULT 0,
  pvp_rating INTEGER DEFAULT 1000,
  quests_done INTEGER DEFAULT 0,
  monsters_killed INTEGER DEFAULT 0,
  inventory JSONB DEFAULT '[]',
  equipment JSONB DEFAULT '{"weapon":null,"armor":null,"accessory":null}',
  skills JSONB DEFAULT '[]',
  achievements JSONB DEFAULT '[]',
  settings JSONB DEFAULT '{"theme":"classic","notifications":true}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_played TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dlavie_rpg_leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES dlavie_rpg_players(id) ON DELETE CASCADE,
  phone_number TEXT,
  char_name TEXT,
  char_class TEXT,
  level INTEGER,
  pvp_rating INTEGER,
  quests_done INTEGER,
  monsters_killed INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dlavie_rpg_pvp_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID REFERENCES dlavie_rpg_players(id) ON DELETE CASCADE,
  defender_id UUID REFERENCES dlavie_rpg_players(id) ON DELETE CASCADE,
  winner_id UUID,
  combat_log JSONB DEFAULT '[]',
  exp_gained INTEGER DEFAULT 0,
  gold_gained INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dlavie_bot_mode (
  id INTEGER PRIMARY KEY DEFAULT 1,
  mode TEXT DEFAULT 'multibot',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT
);

INSERT INTO dlavie_bot_mode (id, mode) VALUES (1, 'multibot') ON CONFLICT (id) DO NOTHING;
