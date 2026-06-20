import { v4 as uuid } from 'uuid';
import { db } from './db.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateReferralCode() {
  let code = '';
  let attempts = 0;
  do {
    code =
      'AV' +
      Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join(
        ''
      );
    attempts += 1;
  } while (
    db.prepare('SELECT 1 FROM users WHERE referral_code = ?').get(code) &&
    attempts < 50
  );
  return code;
}

export function resolveReferrer(referralCodeInput) {
  const code = (referralCodeInput || '').trim().toUpperCase();
  if (!code) return null;
  const referrer = db
    .prepare('SELECT id, username, referral_code FROM users WHERE UPPER(referral_code) = ?')
    .get(code);
  return referrer || null;
}

export function assignReferralCodesToExistingUsers() {
  const users = db
    .prepare(`SELECT id FROM users WHERE referral_code IS NULL OR referral_code = ''`)
    .all();
  const update = db.prepare('UPDATE users SET referral_code = ? WHERE id = ?');
  for (const u of users) {
    update.run(generateReferralCode(), u.id);
  }
}

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM game_settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export function creditReferrerOnWin(referredUserId, profit) {
  if (!profit || profit <= 0) return;

  const referred = db
    .prepare('SELECT referred_by FROM users WHERE id = ?')
    .get(referredUserId);
  if (!referred?.referred_by) return;

  const winChance = parseFloat(getSetting('referral_win_chance_percent', '10'));
  if (winChance <= 0) return;
  if (Math.random() * 100 >= winChance) return;

  const commissionPercent = parseFloat(getSetting('referral_commission_percent', '2'));
  if (commissionPercent <= 0) return;

  const commission = Math.floor((profit * commissionPercent) / 100);
  if (commission <= 0) return;

  db.prepare(
    'UPDATE users SET balance = balance + ?, referral_earnings = referral_earnings + ? WHERE id = ?'
  ).run(commission, commission, referred.referred_by);

  db.prepare(
    `INSERT INTO transactions (id, user_id, type, amount, status, note)
     VALUES (?, ?, 'referral_commission', ?, 'completed', ?)`
  ).run(
    uuid(),
    referred.referred_by,
    commission,
    `Referral bonus ${commissionPercent}% (${winChance}% win chance) from team`
  );
}
