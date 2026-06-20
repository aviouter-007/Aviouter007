import { v4 as uuid } from 'uuid';
import { db } from './db.js';
import {
  computeBiasedCrashPoint,
  generateClientSeed,
  generateServerSeed,
  hashSeed,
} from './fairness.js';
import { createFakeBet, getDisplayPlayerCount } from './fakePlayers.js';
import { userHasDeposited, getDisplayBalance } from './userDeposit.js';
import { creditReferrerOnWin } from './referrals.js';

const PHASE = {
  WAITING: 'waiting',
  BETTING: 'betting',
  FLYING: 'flying',
  CRASHED: 'crashed',
};

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM game_settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export class GameEngine {
  constructor(io) {
    this.io = io;
    this.phase = PHASE.WAITING;
    this.currentRound = null;
    this.multiplier = 1.0;
    this.tickInterval = null;
    this.phaseTimeout = null;
    this.fakeBetTimeouts = [];
    this.activeBets = new Map();
    this.connectedUsers = new Set();
    this.fakeNameUsed = new Set();
  }

  registerViewer(userId) {
    if (userId) this.connectedUsers.add(userId);
  }

  unregisterViewer(userId) {
    if (userId) this.connectedUsers.delete(userId);
  }

  getState() {
    const fakeCount = [...this.activeBets.values()].filter((b) => b.isFake).length;
    return {
      phase: this.phase,
      round: this.publicRound(),
      multiplier: this.multiplier,
      activeBets: this.getActiveBetsPublic(),
      settings: this.getPublicSettings(),
      playersOnline: getDisplayPlayerCount(this.connectedUsers.size, fakeCount),
    };
  }

  getPublicSettings() {
    return {
      minBet: parseInt(getSetting('min_bet', '10'), 10),
      maxBet: parseInt(getSetting('max_bet', '10000'), 10),
      maxMultiplier: parseFloat(getSetting('max_multiplier', '100')),
      bettingSeconds: parseInt(getSetting('betting_seconds', '5'), 10),
      dailyReward: parseInt(getSetting('daily_reward', '500'), 10),
    };
  }

  publicRound() {
    if (!this.currentRound) return null;
    const { server_seed, ...rest } = this.currentRound;
    return rest;
  }

  getActiveBetsPublic() {
    return [...this.activeBets.values()].map((b) => ({
      id: b.id,
      username: b.username,
      amount: b.amount,
      cashoutMultiplier: b.cashoutMultiplier,
      status: b.status,
      isFake: !!b.isFake,
    }));
  }

  getRealBets() {
    return [...this.activeBets.values()].filter((b) => !b.isFake);
  }

  resolveCrashPoint() {
    const realBets = this.getRealBets();

    if (realBets.length === 0) {
      // Watching only: plane goes very high
      return computeBiasedCrashPoint(10.0, 100.0);
    }

    // User placed a bet: almost always lose, very rarely profit
    if (Math.random() < 0.90) {
      return computeBiasedCrashPoint(1.00, 1.15);
    } else {
      return computeBiasedCrashPoint(1.50, 2.50);
    }
  }

  clearFakeTimeouts() {
    for (const t of this.fakeBetTimeouts) clearTimeout(t);
    this.fakeBetTimeouts = [];
  }

  spawnFakeBets() {
    const seconds = parseInt(getSetting('betting_seconds', '5'), 10);
    const count = 10 + Math.floor(Math.random() * 12);
    this.fakeNameUsed = new Set();

    for (let i = 0; i < count; i++) {
      const delay = 150 + Math.random() * (seconds * 1000 - 300);
      const timeout = setTimeout(() => {
        if (this.phase !== PHASE.BETTING) return;
        const bet = createFakeBet(this.fakeNameUsed);
        this.activeBets.set(bet.id, bet);
        this.broadcast('round:bet', this.getState());
      }, delay);
      this.fakeBetTimeouts.push(timeout);
    }
  }

  start() {
    this.scheduleBetting();
  }

  stop() {
    clearInterval(this.tickInterval);
    clearTimeout(this.phaseTimeout);
    this.clearFakeTimeouts();
  }

  scheduleBetting() {
    this.phase = PHASE.BETTING;
    const serverSeed = generateServerSeed();
    const clientSeed = generateClientSeed();

    const roundId = uuid();
    const round = {
      id: roundId,
      crash_point: 1,
      server_seed: serverSeed,
      server_seed_hash: hashSeed(serverSeed),
      client_seed: clientSeed,
      status: 'betting',
      started_at: null,
      crashed_at: null,
    };

    db.prepare(
      `INSERT INTO rounds (id, crash_point, server_seed, server_seed_hash, client_seed, status)
       VALUES (?, 1, ?, ?, ?, 'betting')`
    ).run(roundId, serverSeed, round.server_seed_hash, clientSeed);

    this.currentRound = round;
    this.multiplier = 1.0;
    this.activeBets.clear();
    this.clearFakeTimeouts();
    this.spawnFakeBets();

    const seconds = parseInt(getSetting('betting_seconds', '5'), 10);
    this.broadcast('round:betting', this.getState());

    this.phaseTimeout = setTimeout(() => this.startFlying(), seconds * 1000);
  }

  startFlying() {
    if (!this.currentRound) return;
    this.clearFakeTimeouts();

    const crashPoint = this.resolveCrashPoint();
    this.currentRound.crash_point = crashPoint;

    db.prepare('UPDATE rounds SET crash_point = ? WHERE id = ?').run(
      crashPoint,
      this.currentRound.id
    );

    this.phase = PHASE.FLYING;
    this.multiplier = 1.0;
    this.currentRound.status = 'flying';
    this.currentRound.started_at = new Date().toISOString();

    db.prepare(`UPDATE rounds SET status = 'flying', started_at = ? WHERE id = ?`).run(
      this.currentRound.started_at,
      this.currentRound.id
    );

    this.broadcast('round:flying', this.getState());

    const crashAt = crashPoint;
    const startTime = Date.now();

    this.tickInterval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      this.multiplier = Math.round((1 + elapsed * 0.15 + Math.pow(elapsed, 1.6) * 0.08) * 100) / 100;

      this.processAutoCashouts();
      this.processFakeCashouts();

      if (this.multiplier >= crashAt) {
        this.crash();
        return;
      }

      this.broadcast('round:tick', {
        multiplier: this.multiplier,
        roundId: this.currentRound.id,
      });
    }, 50);
  }

  processFakeCashouts() {
    const crashAt = this.currentRound?.crash_point ?? 2;
    for (const bet of this.activeBets.values()) {
      if (!bet.isFake || bet.status !== 'active') continue;
      if (this.multiplier < 1.15 || this.multiplier >= crashAt - 0.08) continue;

      if (bet.autoCashout && this.multiplier >= bet.autoCashout) {
        bet.status = 'cashed_out';
        bet.cashoutMultiplier = bet.autoCashout;
        this.broadcast('round:cashout', this.getState());
        continue;
      }

      if (Math.random() < 0.018) {
        bet.status = 'cashed_out';
        bet.cashoutMultiplier = this.multiplier;
        this.broadcast('round:cashout', this.getState());
      }
    }
  }

  processAutoCashouts() {
    for (const bet of this.activeBets.values()) {
      if (bet.isFake || bet.status !== 'active') continue;
      if (bet.autoCashout && this.multiplier >= bet.autoCashout) {
        this.cashoutBet(bet.userId, bet.id, bet.autoCashout);
      }
    }
  }

  crash() {
    clearInterval(this.tickInterval);
    this.phase = PHASE.CRASHED;
    this.multiplier = this.currentRound.crash_point;

    const roundId = this.currentRound.id;
    const crashedAt = new Date().toISOString();

    db.prepare(`UPDATE rounds SET status = 'crashed', crashed_at = ? WHERE id = ?`).run(
      crashedAt,
      roundId
    );

    for (const bet of this.activeBets.values()) {
      if (bet.status === 'active') {
        this.loseBet(bet);
      }
    }

    const reveal = {
      ...this.publicRound(),
      server_seed: this.currentRound.server_seed,
      crash_point: this.currentRound.crash_point,
    };

    this.broadcast('round:crashed', {
      ...this.getState(),
      round: reveal,
    });

    this.phaseTimeout = setTimeout(() => this.scheduleBetting(), 3000);
  }

  placeBet(userId, amount, autoCashout = null) {
    if (this.phase !== PHASE.BETTING) {
      return { error: 'Betting is closed for this round' };
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user || user.is_blocked) return { error: 'Account unavailable' };
    if (!userHasDeposited(userId)) {
      return { error: 'Deposit required. Request a deposit in Wallet and wait for admin approval.' };
    }
    if (user.balance < amount) return { error: 'Insufficient coins' };

    const minBet = parseInt(getSetting('min_bet', '10'), 10);
    const maxBet = parseInt(getSetting('max_bet', '10000'), 10);
    if (amount < minBet || amount > maxBet) {
      return { error: `Bet must be between ${minBet} and ${maxBet} coins` };
    }

    const existing = [...this.activeBets.values()].find(
      (b) => b.userId === userId && !b.isFake
    );
    if (existing) return { error: 'You already have a bet this round' };

    const betId = uuid();
    db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(amount, userId);
    db.prepare(
      `INSERT INTO bets (id, user_id, round_id, amount, auto_cashout, status)
       VALUES (?, ?, ?, ?, ?, 'active')`
    ).run(betId, userId, this.currentRound.id, amount, autoCashout);
    db.prepare(
      `INSERT INTO transactions (id, user_id, type, amount, status, round_id, note)
       VALUES (?, ?, 'bet', ?, 'completed', ?, 'Round bet')`
    ).run(uuid(), userId, -amount, this.currentRound.id);

    const bet = {
      id: betId,
      userId,
      username: user.username,
      amount,
      autoCashout,
      cashoutMultiplier: null,
      status: 'active',
      isFake: false,
    };
    this.activeBets.set(betId, bet);

    this.broadcast('round:bet', this.getState());
    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    return { bet, balance: getDisplayBalance(updatedUser) };
  }

  cashout(userId, betId = null) {
    if (this.phase !== PHASE.FLYING) {
      return { error: 'Cannot cash out right now' };
    }
    const bet = betId
      ? this.activeBets.get(betId)
      : [...this.activeBets.values()].find(
          (b) => b.userId === userId && !b.isFake && b.status === 'active'
        );

    if (!bet || bet.isFake || bet.userId !== userId || bet.status !== 'active') {
      return { error: 'No active bet to cash out' };
    }

    return this.cashoutBet(userId, bet.id, this.multiplier);
  }

  cashoutBet(userId, betId, atMultiplier) {
    const bet = this.activeBets.get(betId);
    if (!bet || bet.isFake || bet.status !== 'active') return { error: 'Bet not found' };

    const payout = Math.floor(bet.amount * atMultiplier);
    const profit = payout - bet.amount;

    bet.status = 'cashed_out';
    bet.cashoutMultiplier = atMultiplier;

    db.prepare('UPDATE users SET balance = balance + ?, total_won = total_won + ? WHERE id = ?').run(
      payout,
      profit,
      userId
    );

    const user = db.prepare('SELECT best_multiplier FROM users WHERE id = ?').get(userId);
    if (atMultiplier > user.best_multiplier) {
      db.prepare('UPDATE users SET best_multiplier = ? WHERE id = ?').run(atMultiplier, userId);
    }

    db.prepare(
      `UPDATE bets SET status = 'cashed_out', cashout_multiplier = ?, profit = ? WHERE id = ?`
    ).run(atMultiplier, profit, betId);
    db.prepare(
      `INSERT INTO transactions (id, user_id, type, amount, status, round_id, note)
       VALUES (?, ?, 'win', ?, 'completed', ?, ?)`
    ).run(uuid(), userId, payout, this.currentRound.id, `Cashed out at ${atMultiplier}x`);

    if (profit > 0) {
      creditReferrerOnWin(userId, profit);
    }

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    this.broadcast('round:cashout', this.getState());
    return { payout, profit, multiplier: atMultiplier, balance: getDisplayBalance(updated) };
  }

  loseBet(bet) {
    if (bet.isFake) {
      bet.status = 'lost';
      return;
    }
    bet.status = 'lost';
    db.prepare(`UPDATE bets SET status = 'lost', profit = ? WHERE id = ?`).run(-bet.amount, bet.id);
    db.prepare(
      `INSERT INTO transactions (id, user_id, type, amount, status, round_id, note)
       VALUES (?, ?, 'loss', ?, 'completed', ?, 'Crashed before cashout')`
    ).run(uuid(), bet.userId, -bet.amount, this.currentRound.id);
  }

  broadcast(event, data) {
    this.io.emit(event, data);
  }
}

let engineInstance = null;

export function getGameEngine(io) {
  if (!engineInstance) engineInstance = new GameEngine(io);
  return engineInstance;
}
