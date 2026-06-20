import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { db, makeUsernameFromEmail } from './db.js';
import { authMiddleware, adminMiddleware, publicUser, signToken } from './auth.js';
import { getGameEngine } from './gameEngine.js';
import { markUserDeposited, userHasDeposited, getDisplayBalance } from './userDeposit.js';
import { generateReferralCode, resolveReferrer } from './referrals.js';
import { buildFakeLeaderboard, mergeLeaderboard } from './fakeLeaderboard.js';

export function createRoutes(io) {
  const router = Router();
  const engine = getGameEngine(io);

  router.post('/auth/register', (req, res) => {
    const { email, password, reference } = req.body;
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'This email is already registered. Please sign in.' });
    }

    const username = makeUsernameFromEmail(normalizedEmail);
    const myReferralCode = generateReferralCode();
    let referredBy = null;
    const refInput = (reference || '').trim();
    if (refInput) {
      const referrer = resolveReferrer(refInput);
      if (!referrer) {
        return res.status(400).json({ error: 'Invalid referral code. Leave empty or use a valid code.' });
      }
      referredBy = referrer.id;
    }

    const id = uuid();
    const hash = bcrypt.hashSync(password, 10);
    try {
      db.prepare(
        `INSERT INTO users (
           id, email, password_hash, username, balance, has_deposited,
           reference, referral_code, referred_by, referral_earnings
         ) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, 0)`
      ).run(
        id,
        normalizedEmail,
        hash,
        username,
        refInput || null,
        myReferralCode,
        referredBy
      );
    } catch (e) {
      if (e.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'This email is already registered. Please sign in.' });
      }
      throw e;
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  });

  router.post('/auth/login', (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = (email || '').trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (user.is_blocked) {
      return res.status(403).json({ error: 'Your account has been suspended' });
    }
    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  });

  router.get('/auth/me', authMiddleware, (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user || user.is_blocked) {
      return res.status(403).json({ error: 'Account unavailable' });
    }
    res.json({ user: publicUser(user) });
  });

  router.get('/game/state', (req, res) => {
    res.json(engine.getState());
  });

  router.get('/game/history', (req, res) => {
    const rounds = db
      .prepare(
        `SELECT id, crash_point, server_seed_hash, client_seed, status, started_at, crashed_at
         FROM rounds WHERE status = 'crashed' ORDER BY created_at DESC LIMIT 20`
      )
      .all();
    res.json({ rounds });
  });

  router.get('/transactions', authMiddleware, (req, res) => {
    const rows = db
      .prepare(
        `SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`
      )
      .all(req.user.id);
    res.json({ transactions: rows });
  });

  router.get('/leaderboard', (req, res) => {
    const period = req.query.period || 'all';
    let filter = '';
    if (period === 'daily') {
      filter = `AND b.created_at >= datetime('now', '-1 day')`;
    } else if (period === 'weekly') {
      filter = `AND b.created_at >= datetime('now', '-7 days')`;
    }

    const topWins = db
      .prepare(
        `SELECT u.username, u.avatar_id, SUM(b.profit) as score
         FROM bets b JOIN users u ON u.id = b.user_id
         WHERE b.status = 'cashed_out' AND b.profit > 0 ${filter}
         GROUP BY u.id ORDER BY score DESC LIMIT 20`
      )
      .all();

    const topMultipliers = db
      .prepare(
        `SELECT username, avatar_id, best_multiplier as score
         FROM users WHERE best_multiplier > 1
         ORDER BY best_multiplier DESC LIMIT 20`
      )
      .all();

    const fake = buildFakeLeaderboard(period);
    const merged = mergeLeaderboard(topWins, topMultipliers, fake.topWins, fake.topMultipliers);

    res.json({ period, ...merged });
  });

  router.get('/avatars', (req, res) => {
    res.json({
      avatars: [
        { id: 'plane-red', name: 'Crimson Jet', color: '#ef4444' },
        { id: 'plane-blue', name: 'Sky Rider', color: '#3b82f6' },
        { id: 'plane-green', name: 'Emerald Wing', color: '#22c55e' },
        { id: 'plane-gold', name: 'Golden Eagle', color: '#eab308' },
        { id: 'plane-purple', name: 'Violet Storm', color: '#a855f7' },
        { id: 'plane-neon', name: 'Neon Phantom', color: '#06b6d4' },
      ],
      skins: [
        { id: 'classic', name: 'Classic' },
        { id: 'stealth', name: 'Stealth' },
        { id: 'racer', name: 'Racer' },
        { id: 'vintage', name: 'Vintage' },
      ],
    });
  });

  router.patch('/profile', authMiddleware, (req, res) => {
    const { avatarId, planeSkin, username } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    if (username && username !== user.username) {
      try {
        db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, req.user.id);
      } catch {
        return res.status(409).json({ error: 'Username already taken' });
      }
    }
    if (avatarId) {
      db.prepare('UPDATE users SET avatar_id = ? WHERE id = ?').run(avatarId, req.user.id);
    }
    if (planeSkin) {
      db.prepare('UPDATE users SET plane_skin = ? WHERE id = ?').run(planeSkin, req.user.id);
    }

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ user: publicUser(updated) });
  });

  router.post('/daily-reward', authMiddleware, (req, res) => {
    if (!userHasDeposited(req.user.id)) {
      return res.status(400).json({
        error: 'Complete a deposit and get admin approval before claiming rewards',
      });
    }
    const today = new Date().toISOString().slice(0, 10);
    const claimed = db
      .prepare('SELECT 1 FROM daily_claims WHERE user_id = ? AND claim_date = ?')
      .get(req.user.id, today);
    if (claimed) {
      return res.status(400).json({ error: 'Daily reward already claimed today' });
    }

    const amount = parseInt(
      db.prepare('SELECT value FROM game_settings WHERE key = ?').get('daily_reward')?.value || '500',
      10
    );

    db.prepare('INSERT INTO daily_claims (user_id, claim_date) VALUES (?, ?)').run(
      req.user.id,
      today
    );
    db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, req.user.id);
    db.prepare(
      `INSERT INTO transactions (id, user_id, type, amount, status, note)
       VALUES (?, ?, 'daily_reward', ?, 'completed', 'Daily login reward')`
    ).run(uuid(), req.user.id, amount);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ amount, user: publicUser(user) });
  });

  const MIN_REQUEST_AMOUNT = 10;

  router.get('/referral', authMiddleware, (req, res) => {
    const user = db
      .prepare('SELECT referral_code, referral_earnings, referred_by FROM users WHERE id = ?')
      .get(req.user.id);
    const percent =
      db.prepare('SELECT value FROM game_settings WHERE key = ?').get('referral_commission_percent')
        ?.value || '2';
    const winChance =
      db.prepare('SELECT value FROM game_settings WHERE key = ?').get('referral_win_chance_percent')
        ?.value || '10';
    const team = db
      .prepare(
        `SELECT username, total_won, best_multiplier, created_at
         FROM users WHERE referred_by = ? ORDER BY created_at DESC`
      )
      .all(req.user.id);
    let referredByCode = null;
    if (user.referred_by) {
      referredByCode = db
        .prepare('SELECT referral_code, username FROM users WHERE id = ?')
        .get(user.referred_by);
    }
    res.json({
      myCode: user.referral_code,
      referralEarnings: user.referral_earnings ?? 0,
      commissionPercent: parseFloat(percent),
      winChancePercent: parseFloat(winChance),
      teamCount: team.length,
      team,
      referredBy: referredByCode
        ? { code: referredByCode.referral_code, username: referredByCode.username }
        : null,
    });
  });

  router.get('/currency/deposit-info', authMiddleware, (req, res) => {
    const name =
      db.prepare('SELECT value FROM game_settings WHERE key = ?').get('deposit_account_name')
        ?.value || 'Aviouter Account';
    const number =
      db.prepare('SELECT value FROM game_settings WHERE key = ?').get('deposit_account_number')
        ?.value || '';
    const type =
      db.prepare('SELECT value FROM game_settings WHERE key = ?').get('deposit_account_type')
        ?.value || 'JazzCash / Bank';
    res.json({ accountName: name, accountNumber: number, accountType: type });
  });

  router.get('/currency/requests', authMiddleware, (req, res) => {
    const requests = db
      .prepare(
        `SELECT id, type, amount, status, note, depositor_name, sender_number,
                transaction_id, account_name, account_number, account_type, admin_reply, admin_replied_at,
                created_at
         FROM currency_requests WHERE user_id = ?
         ORDER BY created_at DESC LIMIT 50`
      )
      .all(req.user.id);
    res.json({ requests });
  });

  router.post('/currency/request', authMiddleware, (req, res) => {
    const {
      type,
      amount,
      note,
      depositorName,
      senderNumber,
      transactionId,
      accountName,
      accountNumber,
      accountType,
    } = req.body;
    if (!['deposit', 'withdraw'].includes(type)) {
      return res.status(400).json({ error: 'Type must be deposit or withdraw' });
    }
    const parsedAmount = parseInt(amount, 10);
    if (!parsedAmount || parsedAmount < MIN_REQUEST_AMOUNT) {
      return res.status(400).json({
        error: `Minimum amount is ${MIN_REQUEST_AMOUNT} coins`,
      });
    }

    if (type === 'deposit') {
      if (!depositorName?.trim()) {
        return res.status(400).json({ error: 'Your name is required' });
      }
      if (!senderNumber?.trim()) {
        return res.status(400).json({ error: 'Sender number / account is required' });
      }
      if (!transactionId?.trim()) {
        return res.status(400).json({ error: 'Transaction ID is required' });
      }
    }

    if (type === 'withdraw') {
      if (!accountName?.trim()) {
        return res.status(400).json({ error: 'Account holder name is required' });
      }
      if (!accountNumber?.trim()) {
        return res.status(400).json({ error: 'Account number is required' });
      }
      if (!accountType?.trim()) {
        return res.status(400).json({ error: 'Account type is required (e.g. JazzCash)' });
      }
      const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
      if (user.balance < parsedAmount) {
        return res.status(400).json({
          error: `Insufficient balance. You have ${user.balance} coins but requested ${parsedAmount}.`,
        });
      }
    }

    const pendingSame = db
      .prepare(
        `SELECT id FROM currency_requests
         WHERE user_id = ? AND type = ? AND status = 'pending' LIMIT 1`
      )
      .get(req.user.id, type);
    if (pendingSame) {
      return res.status(400).json({
        error: `You already have a pending ${type} request. Wait for admin approval.`,
      });
    }

    const id = uuid();
    db.prepare(
      `INSERT INTO currency_requests (
         id, user_id, type, amount, note,
         depositor_name, sender_number, transaction_id, account_name, account_number, account_type
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      req.user.id,
      type,
      parsedAmount,
      note || null,
      type === 'deposit' ? depositorName.trim() : null,
      type === 'deposit' ? senderNumber.trim() : null,
      type === 'deposit' ? transactionId.trim() : null,
      type === 'withdraw' ? accountName.trim() : null,
      type === 'withdraw' ? accountNumber.trim() : null,
      type === 'withdraw' ? accountType.trim() : null
    );

    const createdAt = new Date().toISOString();
    if (type === 'withdraw') {
      const u = db.prepare('SELECT username, email FROM users WHERE id = ?').get(req.user.id);
      io.to('admin:dashboard').emit('admin:withdraw-request', {
        id,
        userId: req.user.id,
        username: u?.username,
        email: u?.email,
        amount: parsedAmount,
        accountName: accountName.trim(),
        accountNumber: accountNumber.trim(),
        accountType: accountType.trim(),
        created_at: createdAt,
      });
    }

    res.json({
      request: {
        id,
        type,
        amount: parsedAmount,
        status: 'pending',
        depositor_name: type === 'deposit' ? depositorName.trim() : null,
        sender_number: type === 'deposit' ? senderNumber.trim() : null,
        transaction_id: type === 'deposit' ? transactionId.trim() : null,
        account_name: type === 'withdraw' ? accountName.trim() : null,
        account_number: type === 'withdraw' ? accountNumber.trim() : null,
        account_type: type === 'withdraw' ? accountType.trim() : null,
        created_at: createdAt,
      },
    });
  });

  router.get('/support/messages', authMiddleware, (req, res) => {
    const messages = db
      .prepare(
        `SELECT id, thread_user_id, sender_role, sender_id, message, created_at
         FROM private_chat_messages WHERE thread_user_id = ?
         ORDER BY created_at ASC LIMIT 100`
      )
      .all(req.user.id);
    res.json({ messages });
  });

  router.get('/chat', (req, res) => {
    res.json({ messages: [] });
  });

  // --- Admin ---
  router.get('/admin/stats', authMiddleware, adminMiddleware, (req, res) => {
    const users = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const pending = db
      .prepare(`SELECT COUNT(*) as c FROM currency_requests WHERE status = 'pending'`)
      .get().c;
    const pendingWithdraw = db
      .prepare(
        `SELECT COUNT(*) as c FROM currency_requests WHERE status = 'pending' AND type = 'withdraw'`
      )
      .get().c;
    const pendingDeposit = db
      .prepare(
        `SELECT COUNT(*) as c FROM currency_requests WHERE status = 'pending' AND type = 'deposit'`
      )
      .get().c;
    const totalBets = db.prepare('SELECT COUNT(*) as c FROM bets').get().c;
    const pendingWithdrawals = db
      .prepare(
        `SELECT r.*, u.username, u.email
         FROM currency_requests r
         JOIN users u ON u.id = r.user_id
         WHERE r.status = 'pending' AND r.type = 'withdraw'
         ORDER BY r.created_at DESC LIMIT 20`
      )
      .all();
    const unreadSupport = db
      .prepare(
        `SELECT COUNT(DISTINCT thread_user_id) as c FROM private_chat_messages
         WHERE sender_role = 'user' AND created_at >= datetime('now', '-7 days')`
      )
      .get().c;
    res.json({
      users,
      pendingRequests: pending,
      pendingWithdraw,
      pendingDeposit,
      totalBets,
      pendingWithdrawals,
      unreadSupport: unreadSupport.c,
    });
  });

  router.get('/admin/users', authMiddleware, adminMiddleware, (req, res) => {
    const users = db
      .prepare(
        `SELECT id, email, username, role, balance, is_blocked, created_at, total_won,
                best_multiplier, reference, referral_code, referral_earnings, referred_by
         FROM users ORDER BY created_at DESC`
      )
      .all();
    res.json({ users });
  });

  router.patch('/admin/users/:id', authMiddleware, adminMiddleware, (req, res) => {
    const { isBlocked, role } = req.body;
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    if (typeof isBlocked === 'boolean') {
      db.prepare('UPDATE users SET is_blocked = ? WHERE id = ?').run(isBlocked ? 1 : 0, req.params.id);
    }
    if (role && ['user', 'admin'].includes(role)) {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
    }
    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    res.json({ user: publicUser(updated) });
  });

  router.post('/admin/users/:id/balance', authMiddleware, adminMiddleware, (req, res) => {
    const { amount, note } = req.body;
    if (!amount || typeof amount !== 'number') {
      return res.status(400).json({ error: 'Amount required' });
    }
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    const newBalance = target.balance + amount;
    if (newBalance < 0) {
      return res.status(400).json({ error: 'Balance cannot go negative' });
    }

    db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, req.params.id);
    db.prepare(
      `INSERT INTO transactions (id, user_id, type, amount, status, admin_id, note)
       VALUES (?, ?, 'admin_adjustment', ?, 'completed', ?, ?)`
    ).run(uuid(), req.params.id, amount, req.user.id, note || 'Admin balance adjustment');

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    res.json({ user: publicUser(updated) });
  });

  router.get('/admin/requests', authMiddleware, adminMiddleware, (req, res) => {
    const requests = db
      .prepare(
        `SELECT r.*, u.username, u.email
         FROM currency_requests r
         JOIN users u ON u.id = r.user_id
         ORDER BY
           CASE WHEN r.status = 'pending' AND r.type = 'withdraw' THEN 0
                WHEN r.status = 'pending' THEN 1
                ELSE 2 END,
           r.created_at DESC
         LIMIT 100`
      )
      .all();
    res.json({ requests });
  });

  router.get('/admin/support/threads', authMiddleware, adminMiddleware, (req, res) => {
    const threads = db
      .prepare(
        `SELECT u.id, u.username, u.email,
                (SELECT message FROM private_chat_messages
                 WHERE thread_user_id = u.id ORDER BY created_at DESC LIMIT 1) as last_message,
                (SELECT created_at FROM private_chat_messages
                 WHERE thread_user_id = u.id ORDER BY created_at DESC LIMIT 1) as last_at,
                (SELECT COUNT(*) FROM private_chat_messages
                 WHERE thread_user_id = u.id AND sender_role = 'user'
                 AND created_at >= datetime('now', '-1 day')) as recent_count
         FROM users u
         WHERE u.role = 'user'
           AND u.id IN (SELECT DISTINCT thread_user_id FROM private_chat_messages)
         ORDER BY last_at DESC`
      )
      .all();
    res.json({ threads });
  });

  router.get('/admin/support/messages/:userId', authMiddleware, adminMiddleware, (req, res) => {
    const messages = db
      .prepare(
        `SELECT * FROM private_chat_messages WHERE thread_user_id = ?
         ORDER BY created_at ASC LIMIT 200`
      )
      .all(req.params.userId);
    const user = db
      .prepare('SELECT id, username, email FROM users WHERE id = ?')
      .get(req.params.userId);
    res.json({ user, messages });
  });

  function saveAdminReply(requestId, userId, message) {
    const text = (message || '').trim();
    if (!text) return;
    const now = new Date().toISOString();
    db.prepare(
      'UPDATE currency_requests SET admin_reply = ?, admin_replied_at = ? WHERE id = ?'
    ).run(text, now, requestId);
    io.to(`user:${userId}`).emit('request:reply', {
      requestId,
      adminReply: text,
      adminRepliedAt: now,
    });
  }

  router.post('/admin/requests/:id/reply', authMiddleware, adminMiddleware, (req, res) => {
    const { message } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ error: 'Reply message is required' });
    }
    const request = db
      .prepare('SELECT * FROM currency_requests WHERE id = ?')
      .get(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    saveAdminReply(request.id, request.user_id, message);
    res.json({ ok: true, adminReply: message.trim() });
  });

  router.patch('/admin/requests/:id', authMiddleware, adminMiddleware, (req, res) => {
    const { status, adminReply } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' });
    }

    const request = db
      .prepare('SELECT * FROM currency_requests WHERE id = ?')
      .get(req.params.id);
    if (!request || request.status !== 'pending') {
      return res.status(400).json({ error: 'Request not found or already processed' });
    }

    if (status === 'approved') {
      if (request.type === 'deposit') {
        db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(
          request.amount,
          request.user_id
        );
        markUserDeposited(request.user_id);
      } else {
        const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(request.user_id);
        if (user.balance < request.amount) {
          return res.status(400).json({ error: 'User has insufficient balance' });
        }
        db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(
          request.amount,
          request.user_id
        );
      }
      const sign = request.type === 'deposit' ? 1 : -1;
      db.prepare(
        `INSERT INTO transactions (id, user_id, type, amount, status, admin_id, note)
         VALUES (?, ?, ?, ?, 'completed', ?, ?)`
      ).run(
        uuid(),
        request.user_id,
        `admin_${request.type}`,
        sign * request.amount,
        req.user.id,
        `Approved ${request.type} request`
      );
    }

    db.prepare(
      'UPDATE currency_requests SET status = ?, admin_id = ? WHERE id = ?'
    ).run(status, req.user.id, req.params.id);

    if (adminReply?.trim()) {
      saveAdminReply(request.id, request.user_id, adminReply);
    }

    if (status === 'approved') {
      const updated = db.prepare('SELECT balance FROM users WHERE id = ?').get(request.user_id);
      io.to(`user:${request.user_id}`).emit('wallet:updated', {
        type: request.type,
        amount: request.amount,
        balance: updated?.balance,
        status: 'approved',
      });
    } else {
      io.to(`user:${request.user_id}`).emit('wallet:updated', {
        type: request.type,
        amount: request.amount,
        status: 'rejected',
      });
    }

    res.json({ ok: true });
  });

  router.get('/admin/transactions', authMiddleware, adminMiddleware, (req, res) => {
    const transactions = db
      .prepare(
        `SELECT t.*, u.username
         FROM transactions t
         LEFT JOIN users u ON u.id = t.user_id
         ORDER BY t.created_at DESC LIMIT 200`
      )
      .all();
    res.json({ transactions });
  });

  router.get('/admin/settings', authMiddleware, adminMiddleware, (req, res) => {
    const rows = db.prepare('SELECT key, value FROM game_settings').all();
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json({ settings });
  });

  router.patch('/admin/settings', authMiddleware, adminMiddleware, (req, res) => {
    const allowed = [
      'min_bet',
      'max_bet',
      'max_multiplier',
      'house_edge',
      'betting_seconds',
      'daily_reward',
      'starting_balance',
      'deposit_account_type',
      'deposit_account_name',
      'deposit_account_number',
      'referral_commission_percent',
      'referral_win_chance_percent',
    ];
    const upsert = db.prepare(
      'INSERT INTO game_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    );
    for (const [key, value] of Object.entries(req.body.settings || {})) {
      if (allowed.includes(key)) upsert.run(key, String(value));
    }
    const rows = db.prepare('SELECT key, value FROM game_settings').all();
    res.json({ settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
  });

  router.get('/admin/chat', authMiddleware, adminMiddleware, (req, res) => {
    const messages = db
      .prepare(
        `SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 100`
      )
      .all();
    res.json({ messages });
  });

  router.delete('/admin/chat/:id', authMiddleware, adminMiddleware, (req, res) => {
    db.prepare('UPDATE chat_messages SET is_deleted = 1 WHERE id = ?').run(req.params.id);
    io.emit('chat:deleted', { id: req.params.id });
    res.json({ ok: true });
  });

  return router;
}
