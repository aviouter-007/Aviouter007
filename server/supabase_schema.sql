-- Run this in Supabase SQL Editor to set up your tables

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  balance BIGINT NOT NULL DEFAULT 0,
  avatar_id TEXT NOT NULL DEFAULT 'plane-red',
  plane_skin TEXT NOT NULL DEFAULT 'classic',
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  total_won BIGINT NOT NULL DEFAULT 0,
  best_multiplier REAL NOT NULL DEFAULT 0,
  has_deposited BOOLEAN NOT NULL DEFAULT FALSE,
  reference TEXT,
  referral_code TEXT,
  referred_by TEXT,
  referral_earnings BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  amount BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  note TEXT,
  admin_id UUID,
  round_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rounds (
  id UUID PRIMARY KEY,
  crash_point REAL NOT NULL,
  server_seed TEXT NOT NULL,
  server_seed_hash TEXT NOT NULL,
  client_seed TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  started_at TIMESTAMPTZ,
  crashed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bets (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  round_id UUID NOT NULL REFERENCES rounds(id),
  amount BIGINT NOT NULL,
  auto_cashout REAL,
  cashout_multiplier REAL,
  profit BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS currency_requests (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  amount BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_id UUID,
  note TEXT,
  depositor_name TEXT,
  sender_number TEXT,
  transaction_id TEXT,
  account_name TEXT,
  account_number TEXT,
  account_type TEXT,
  admin_reply TEXT,
  admin_replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  username TEXT NOT NULL,
  message TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_claims (
  user_id UUID NOT NULL REFERENCES users(id),
  claim_date TEXT NOT NULL,
  PRIMARY KEY (user_id, claim_date)
);

CREATE TABLE IF NOT EXISTS private_chat_messages (
  id UUID PRIMARY KEY,
  thread_user_id UUID NOT NULL REFERENCES users(id),
  sender_role TEXT NOT NULL,
  sender_id UUID,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial settings
INSERT INTO game_settings (key, value) VALUES
  ('min_bet', '10'),
  ('max_bet', '10000'),
  ('max_multiplier', '100'),
  ('house_edge', '0.03'),
  ('betting_seconds', '5'),
  ('daily_reward', '500'),
  ('starting_balance', '0'),
  ('referral_commission_percent', '2'),
  ('referral_win_chance_percent', '10'),
  ('deposit_account_name', 'Aviouter Account'),
  ('deposit_account_number', '0000000000000')
ON CONFLICT (key) DO NOTHING;
