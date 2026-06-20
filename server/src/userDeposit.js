import { db } from './db.js';

export function userHasDeposited(userId) {
  if (!userId) return false;
  const user = db.prepare('SELECT has_deposited FROM users WHERE id = ?').get(userId);
  if (user?.has_deposited) return true;
  const approved = db
    .prepare(
      `SELECT 1 FROM currency_requests
       WHERE user_id = ? AND type = 'deposit' AND status = 'approved' LIMIT 1`
    )
    .get(userId);
  return !!approved;
}

export function markUserDeposited(userId) {
  db.prepare('UPDATE users SET has_deposited = 1 WHERE id = ?').run(userId);
}

/** Balance visible/usable only after admin-approved deposit (admins exempt). */
export function getDisplayBalance(user) {
  if (!user) return 0;
  if (user.role === 'admin') return user.balance ?? 0;
  if (!userHasDeposited(user.id)) return 0;
  return user.balance ?? 0;
}
