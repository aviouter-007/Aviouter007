import jwt from 'jsonwebtoken';
import { getDisplayBalance } from './userDeposit.js';

const JWT_SECRET = process.env.JWT_SECRET || 'aviouter-dev-secret';

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function adminMiddleware(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    role: row.role,
    balance: getDisplayBalance(row),
    avatarId: row.avatar_id,
    planeSkin: row.plane_skin,
    totalWon: row.total_won,
    bestMultiplier: row.best_multiplier,
    isBlocked: !!row.is_blocked,
    createdAt: row.created_at,
    referralCode: row.referral_code,
    referralEarnings: row.referral_earnings ?? 0,
  };
}
