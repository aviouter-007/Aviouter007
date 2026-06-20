import crypto from 'crypto';
import fs from 'fs';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { assignReferralCodesToExistingUsers } from './referrals.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'aviouter.db');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      balance INTEGER NOT NULL DEFAULT 0,
      avatar_id TEXT NOT NULL DEFAULT 'plane-red',
      plane_skin TEXT NOT NULL DEFAULT 'classic',
      is_blocked INTEGER NOT NULL DEFAULT 0,
      total_won INTEGER NOT NULL DEFAULT 0,
      best_multiplier REAL NOT NULL DEFAULT 0,
      has_deposited INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      note TEXT,
      admin_id TEXT,
      round_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS rounds (
      id TEXT PRIMARY KEY,
      crash_point REAL NOT NULL,
      server_seed TEXT NOT NULL,
      server_seed_hash TEXT NOT NULL,
      client_seed TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      started_at TEXT,
      crashed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      round_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      auto_cashout REAL,
      cashout_multiplier REAL,
      profit INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (round_id) REFERENCES rounds(id)
    );

    CREATE TABLE IF NOT EXISTS currency_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_id TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      message TEXT NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS game_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_claims (
      user_id TEXT NOT NULL,
      claim_date TEXT NOT NULL,
      PRIMARY KEY (user_id, claim_date)
    );

    CREATE TABLE IF NOT EXISTS private_chat_messages (
      id TEXT PRIMARY KEY,
      thread_user_id TEXT NOT NULL,
      sender_role TEXT NOT NULL,
      sender_id TEXT,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (thread_user_id) REFERENCES users(id)
    );
  `);

  const settings = [
    ['min_bet', '10'],
    ['max_bet', '10000'],
    ['max_multiplier', '100'],
    ['house_edge', '0.03'],
    ['betting_seconds', '5'],
    ['daily_reward', '500'],
    ['starting_balance', '0'],
    ['referral_commission_percent', '2'],
    ['referral_win_chance_percent', '10'],
  ];

  const upsert = db.prepare(
    'INSERT OR IGNORE INTO game_settings (key, value) VALUES (?, ?)'
  );
  for (const [k, v] of settings) upsert.run(k, v);
  const paymentSettings = [
    ['deposit_account_name', 'Aviouter Account'],
    ['deposit_account_number', '0000000000000'],
  ];
  for (const [k, v] of paymentSettings) upsert.run(k, v);
  upsert.run('referral_win_chance_percent', '10');

  db.prepare(
    `UPDATE game_settings SET value = '10' WHERE key = 'referral_win_chance_percent' AND value IN ('25', '20', '15')`
  ).run();
  db.prepare(
    `UPDATE game_settings SET value = '2' WHERE key = 'referral_commission_percent' AND value IN ('5', '4', '3')`
  ).run();

  migrateCurrencyRequests();
  seedAdmin();
}

function migrateCurrencyRequests() {
  const reqCols = db.prepare('PRAGMA table_info(currency_requests)').all().map((c) => c.name);
  const addReqCol = (name) => {
    if (!reqCols.includes(name)) {
      db.exec(`ALTER TABLE currency_requests ADD COLUMN ${name} TEXT`);
    }
  };
  addReqCol('depositor_name');
  addReqCol('sender_number');
  addReqCol('transaction_id');
  addReqCol('account_name');
  addReqCol('account_number');
  addReqCol('account_type');
  addReqCol('admin_reply');
  addReqCol('admin_replied_at');

  const userCols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  if (!userCols.includes('has_deposited')) {
    db.exec('ALTER TABLE users ADD COLUMN has_deposited INTEGER NOT NULL DEFAULT 0');
  }
  db.exec(
    `UPDATE users SET has_deposited = 1 WHERE id IN (
       SELECT DISTINCT user_id FROM currency_requests
       WHERE type = 'deposit' AND status = 'approved'
     )`
  );
  db.exec(
    `UPDATE users SET balance = 0 WHERE role != 'admin' AND (has_deposited IS NULL OR has_deposited = 0)`
  );

  const userColNames = () =>
    db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  const addUserCol = (name, sql) => {
    if (!userColNames().includes(name)) db.exec(sql);
  };
  addUserCol('reference', 'ALTER TABLE users ADD COLUMN reference TEXT');
  addUserCol('referral_code', 'ALTER TABLE users ADD COLUMN referral_code TEXT');
  addUserCol('referred_by', 'ALTER TABLE users ADD COLUMN referred_by TEXT');
  addUserCol(
    'referral_earnings',
    'ALTER TABLE users ADD COLUMN referral_earnings INTEGER NOT NULL DEFAULT 0'
  );

  assignReferralCodesToExistingUsers();
}

function makeUsernameFromEmail(email) {
  const base = (email.split('@')[0] || 'player')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 20) || 'player';
  let username = base;
  let n = 0;
  while (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) {
    n += 1;
    username = `${base}${n}`;
  }
  return username;
}

export { makeUsernameFromEmail };

function seedAdmin() {
  const adminEmail = 'miansabmi6@gmail.com';
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (existing) return;

  const hash = bcrypt.hashSync('12345six@', 10);
  db.prepare(
    `INSERT INTO users (id, email, password_hash, username, role, balance)
     VALUES (?, ?, ?, ?, 'admin', 999999)`
  ).run(cryptoRandomId(), adminEmail, hash, 'Admin');
}

function cryptoRandomId() {
  return crypto.randomUUID();
}
