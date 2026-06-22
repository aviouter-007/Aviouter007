import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// ─── Supabase ───────────────────────────────────────────────────────────────
const supabase = createClient(
  'https://ueycuefilgpkjuojpwnv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVleWN1ZWZpbGdwa2p1b2pwd252Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTYyOTk1MywiZXhwIjoyMDk3MjA1OTUzfQ.zNy1rlcJNah6z4keF0zYIxpZ5LoT2IE58pQLfJTtpeg'
);
const JWT_SECRET = 'aviouter-prod-secret-987';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}

async function getUser(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    const { data } = await supabase.from('users').select('*').eq('id', payload.id).single();
    return data || null;
  } catch { return null; }
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    balance: user.balance,
    avatarId: user.avatar_id,
    planeSkin: user.plane_skin,
    isBlocked: !!user.is_blocked,
    totalWon: Number(user.total_won || 0),
    bestMultiplier: Number(user.best_multiplier || 0),
    hasDeposited: !!user.has_deposited,
    reference: user.reference,
    referralCode: user.referral_code,
    referredBy: user.referred_by,
    referralEarnings: Number(user.referral_earnings || 0),
    createdAt: user.created_at
  };
}

function parsePath(req) {
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  return { parts, query: Object.fromEntries(url.searchParams) };
}

async function getSettings() {
  const { data } = await supabase.from('game_settings').select('*');
  const s = {};
  (data || []).forEach(r => {
    let v = r.value;
    if (v === 'true') v = true; else if (v === 'false') v = false;
    else if (!isNaN(v) && v.trim() !== '') v = Number(v);
    s[r.key] = v;
  });
  return s;
}

// ─── Deterministic Seeded PRNG ──────────────────────────────────────────────
function seedRandom(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// ─── Fake Player Generation ──────────────────────────────────────────────────
function getFakeBetsForRound(round, multiplier) {
  const rand = seedRandom(round.id);
  const count = 10 + Math.floor(rand() * 12);
  const used = new Set();
  const FAKE_NAMES = [
    'PilotRavi', 'SkyKing92', 'JetFlyer', 'AceWing', 'TurboBird',
    'CloudRider', 'NightHawk', 'StarPilot', 'RedWing', 'BlueJet',
    'LuckyFly', 'ProAviator', 'MoonPlane', 'FastWing', 'GoldJet',
    'ShadowAce', 'FireBird', 'IcePilot', 'StormFly', 'NeoWing',
    'MaxFlyer', 'ZenPilot', 'BoltJet', 'CyberWing', 'EliteFly',
    'RocketX', 'AlphaJet', 'OmegaFly', 'DeltaWing', 'ViperAir',
  ];
  const BET_AMOUNTS = [10, 20, 50, 100, 200, 500, 1000, 2500];
  
  const bets = [];
  for (let i = 0; i < count; i++) {
    const namePool = FAKE_NAMES.filter(n => !used.has(n));
    const name = namePool.length ? namePool[Math.floor(rand() * namePool.length)] : FAKE_NAMES[0];
    used.add(name);
    
    const amount = BET_AMOUNTS[Math.floor(rand() * BET_AMOUNTS.length)];
    const cashoutPoint = rand() < 0.35 ? 1.15 + rand() * 3.5 : null;
    
    let status = 'active';
    let cashoutMultiplier = null;
    
    if (round.status === 'crashed') {
      if (cashoutPoint && cashoutPoint < round.crash_point) {
        status = 'cashed_out';
        cashoutMultiplier = Math.round(cashoutPoint * 100) / 100;
      } else {
        status = 'lost';
      }
    } else if (round.status === 'flying') {
      if (cashoutPoint && cashoutPoint <= multiplier) {
        status = 'cashed_out';
        cashoutMultiplier = Math.round(cashoutPoint * 100) / 100;
      }
    }
    
    bets.push({
      id: `fake-${round.id}-${i}`,
      username: name,
      amount,
      cashoutMultiplier,
      status,
      isFake: true
    });
  }
  return bets;
}

// ─── Username & Referral Helpers ─────────────────────────────────────────────
async function makeUsernameFromEmail(email) {
  const base = (email.split('@')[0] || 'player')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 15) || 'player';
  let username = base;
  let n = 0;
  while (true) {
    const { data } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
    if (!data) return username;
    n += 1;
    username = `${base}${n}`;
  }
}

async function generateReferralCode() {
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  let attempts = 0;
  do {
    code = 'AV' + Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
    attempts += 1;
    const { data } = await supabase.from('users').select('id').eq('referral_code', code).maybeSingle();
    if (!data) return code;
  } while (attempts < 50);
  return code;
}

async function creditReferrerOnWin(userId, profit) {
  if (!profit || profit <= 0) return;
  const { data: user } = await supabase.from('users').select('referred_by').eq('id', userId).maybeSingle();
  if (!user?.referred_by) return;
  
  const settings = await getSettings();
  const winChance = parseFloat(settings.referral_win_chance_percent || '10');
  if (winChance <= 0) return;
  if (Math.random() * 100 >= winChance) return;
  
  const commissionPercent = parseFloat(settings.referral_commission_percent || '2');
  if (commissionPercent <= 0) return;
  
  const commission = Math.floor((profit * commissionPercent) / 100);
  if (commission <= 0) return;
  
  const { data: referrer } = await supabase.from('users').select('balance, referral_earnings').eq('id', user.referred_by).maybeSingle();
  if (referrer) {
    await supabase.from('users').update({
      balance: referrer.balance + commission,
      referral_earnings: (referrer.referral_earnings || 0) + commission
    }).eq('id', user.referred_by);
    
    await supabase.from('transactions').insert({
      id: uuidv4(),
      user_id: user.referred_by,
      type: 'referral_commission',
      amount: commission,
      status: 'completed',
      note: `Referral bonus ${commissionPercent}% (${winChance}% win chance) from team`
    });
  }
}

// ─── Game Engine ─────────────────────────────────────────────────────────────
function calcMultiplier(startedAt) {
  const elapsedSec = (Date.now() - new Date(startedAt).getTime()) / 1000;
  return Math.round((1 + elapsedSec * 0.15 + Math.pow(elapsedSec, 1.6) * 0.08) * 100) / 100;
}

function computeBiasedCrashPoint(min, max) {
  const lo = Math.max(1.01, min);
  const hi = Math.max(lo, max);
  const r = Math.pow(Math.random(), 1.4);
  return Math.round((lo + r * (hi - lo)) * 100) / 100;
}

async function advanceRound() {
  const { data: rounds } = await supabase.from('rounds').select('*').order('created_at', { ascending: false }).limit(1);
  const round = rounds?.[0];
  const settings = await getSettings();
  const bettingSeconds = settings.betting_seconds || 5;

  if (!round || round.status === 'crashed') {
    // Start new round
    const crashPoint = 1.0;
    const seed = uuidv4();
    const hash = uuidv4();
    const id = uuidv4();
    await supabase.from('rounds').insert({ id, crash_point: crashPoint, server_seed: seed, server_seed_hash: hash, client_seed: uuidv4(), status: 'betting', started_at: null });
    
    const activeBets = getFakeBetsForRound({ id, status: 'betting' }, 1);
    const count = 20 + Math.floor(Math.random() * 40);
    return {
      phase: 'betting',
      round: { id, server_seed_hash: hash, status: 'betting', started_at: null },
      multiplier: 1,
      activeBets,
      playersOnline: count,
      settings: {
        minBet: settings.min_bet || 10,
        maxBet: settings.max_bet || 10000,
        bettingSeconds,
        maxMultiplier: settings.max_multiplier || 100
      }
    };
  }

  if (round.status === 'betting') {
    const age = (Date.now() - new Date(round.created_at).getTime()) / 1000;
    if (age >= bettingSeconds) {
      // Check for real bets in this round
      const { count: realBetsCount } = await supabase.from('bets').select('*', { count: 'exact', head: true }).eq('round_id', round.id);
      
      let crashPoint;
      if (!realBetsCount || realBetsCount === 0) {
        // Plane goes very high
        crashPoint = computeBiasedCrashPoint(10.0, 100.0);
      } else {
        // House bias: 90% lose early, 10% medium win
        if (Math.random() < 0.90) {
          crashPoint = computeBiasedCrashPoint(1.00, 1.15);
        } else {
          crashPoint = computeBiasedCrashPoint(1.50, 2.50);
        }
      }
      
      const startedAt = new Date().toISOString();
      await supabase.from('rounds').update({ status: 'flying', started_at: startedAt, crash_point: crashPoint }).eq('id', round.id);
      round.status = 'flying';
      round.started_at = startedAt;
      round.crash_point = crashPoint;
    }
    
    // Fetch active bets
    const { data: realBets } = await supabase.from('bets').select('id, amount, status, cashout_multiplier, users(username)').eq('round_id', round.id);
    const formattedReal = (realBets || []).map(b => ({
      id: b.id,
      username: b.users?.username || 'Player',
      amount: b.amount,
      cashoutMultiplier: b.cashout_multiplier,
      status: b.status,
      isFake: false
    }));
    const fakeBets = getFakeBetsForRound(round, 1);
    const allBets = [...formattedReal, ...fakeBets];
    const online = allBets.length + 15 + Math.floor(Math.random() * 30);
    
    return {
      phase: round.status,
      round: { id: round.id, server_seed_hash: round.server_seed_hash, status: round.status, started_at: round.started_at },
      multiplier: 1,
      activeBets: allBets,
      playersOnline: online,
      settings: {
        minBet: settings.min_bet || 10,
        maxBet: settings.max_bet || 10000,
        bettingSeconds,
        maxMultiplier: settings.max_multiplier || 100
      }
    };
  }

  if (round.status === 'flying') {
    const multi = calcMultiplier(round.started_at);
    
    // Process autocashouts
    const { data: activeBets } = await supabase.from('bets').select('*, users(balance, total_won, best_multiplier)').eq('round_id', round.id).eq('status', 'active');
    for (const bet of (activeBets || [])) {
      if (bet.auto_cashout) {
        const limit = Math.min(multi, round.crash_point);
        if (bet.auto_cashout <= limit) {
          const payout = Math.floor(bet.amount * bet.auto_cashout);
          const profit = payout - bet.amount;
          
          await supabase.from('bets').update({ status: 'cashed_out', cashout_multiplier: bet.auto_cashout, profit }).eq('id', bet.id);
          await supabase.from('users').update({
            balance: bet.users.balance + payout,
            total_won: (bet.users.total_won || 0) + profit,
            best_multiplier: Math.max(bet.users.best_multiplier || 0, bet.auto_cashout)
          }).eq('id', bet.user_id);
          
          await supabase.from('transactions').insert({
            id: uuidv4(),
            user_id: bet.user_id,
            type: 'win',
            amount: payout,
            status: 'completed',
            round_id: round.id,
            note: `Auto cashed out at ${bet.auto_cashout}x`
          });
          
          if (profit > 0) {
            await creditReferrerOnWin(bet.user_id, profit);
          }
        }
      }
    }

    if (multi >= round.crash_point) {
      // Crash!
      await supabase.from('rounds').update({ status: 'crashed', crashed_at: new Date().toISOString() }).eq('id', round.id);
      
      // Update lost bets
      const { data: stillActive } = await supabase.from('bets').select('*').eq('round_id', round.id).eq('status', 'active');
      for (const b of (stillActive || [])) {
        await supabase.from('bets').update({ status: 'lost', profit: -b.amount }).eq('id', b.id);
        await supabase.from('transactions').insert({
          id: uuidv4(),
          user_id: b.user_id,
          type: 'loss',
          amount: -b.amount,
          status: 'completed',
          round_id: round.id,
          note: 'Crashed before cashout'
        });
      }
      
      // Return crashed details
      return { phase: 'crashed', crashPoint: round.crash_point, round };
    }
    
    // Fetch bets
    const { data: realBets } = await supabase.from('bets').select('id, amount, status, cashout_multiplier, users(username)').eq('round_id', round.id);
    const formattedReal = (realBets || []).map(b => ({
      id: b.id,
      username: b.users?.username || 'Player',
      amount: b.amount,
      cashoutMultiplier: b.cashout_multiplier,
      status: b.status,
      isFake: false
    }));
    const fakeBets = getFakeBetsForRound(round, multi);
    const allBets = [...formattedReal, ...fakeBets];
    const online = allBets.length + 15 + Math.floor(Math.random() * 30);
    
    return {
      phase: 'flying',
      round,
      multiplier: multi,
      activeBets: allBets,
      playersOnline: online,
      localStartTime: new Date(round.started_at).getTime()
    };
  }
}

// ─── Main Handler ────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Bypass-Tunnel-Reminder');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { parts, query } = parsePath(req);
  const [p0, p1, p2, p3] = parts;

  // ── AUTH ──────────────────────────────────────────────────────────────────
  if (p0 === 'auth') {
    if (p1 === 'register' && req.method === 'POST') {
      const { email, password, reference } = req.body;
      const normalizedEmail = (email || '').trim().toLowerCase();
      if (!normalizedEmail || !password) return res.status(400).json({ error: 'Missing fields' });
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      
      const { data: existing } = await supabase.from('users').select('id').eq('email', normalizedEmail).maybeSingle();
      if (existing) return res.status(409).json({ error: 'This email is already registered. Please sign in.' });
      
      let referredBy = null;
      const refInput = (reference || '').trim().toUpperCase();
      if (refInput) {
        const { data: referrer } = await supabase.from('users').select('id').eq('referral_code', refInput).maybeSingle();
        if (!referrer) return res.status(400).json({ error: 'Invalid referral code. Leave empty or use a valid code.' });
        referredBy = referrer.id;
      }
      
      const hash = await bcrypt.hash(password, 10);
      const myReferralCode = await generateReferralCode();
      const id = uuidv4();
      const settings = await getSettings();
      const startBal = settings.starting_balance || 0;
      
      const { error } = await supabase.from('users').insert({
        id,
        email: normalizedEmail,
        password_hash: hash,
        username: await makeUsernameFromEmail(normalizedEmail),
        role: 'user',
        balance: startBal,
        referral_code: myReferralCode,
        referred_by: referredBy,
        reference: refInput || null
      });
      if (error) return res.status(400).json({ error: error.message });
      
      const { data: user } = await supabase.from('users').select('*').eq('id', id).single();
      return res.json({ token: signToken(user), user: publicUser(user) });
    }

    if (p1 === 'login' && req.method === 'POST') {
      const { email, password } = req.body;
      const normalizedEmail = (email || '').trim().toLowerCase();
      const { data: user } = await supabase.from('users').select('*').eq('email', normalizedEmail).maybeSingle();
      if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Invalid credentials' });
      if (user.is_blocked) return res.status(403).json({ error: 'Account suspended' });
      return res.json({ token: signToken(user), user: publicUser(user) });
    }

    if (p1 === 'me' && req.method === 'GET') {
      const user = await getUser(req);
      if (!user) return res.status(401).json({ error: 'Authentication required' });
      return res.json({ user: publicUser(user) });
    }

    // Google OAuth — called after Supabase OAuth flow completes
    if (p1 === 'google' && req.method === 'POST') {
      const { access_token } = req.body;
      if (!access_token) return res.status(400).json({ error: 'Missing access_token' });

      // Verify token with Supabase and get user info
      const { data: sbUser, error: sbErr } = await supabase.auth.getUser(access_token);
      if (sbErr || !sbUser?.user) return res.status(401).json({ error: 'Invalid Google token' });

      const googleEmail = sbUser.user.email?.toLowerCase();
      const googleName = sbUser.user.user_metadata?.full_name || sbUser.user.user_metadata?.name || '';
      if (!googleEmail) return res.status(400).json({ error: 'Could not get email from Google' });

      // Find existing user or create new one
      let { data: existing } = await supabase.from('users').select('*').eq('email', googleEmail).maybeSingle();

      if (!existing) {
        // Auto-register new user
        const myReferralCode = await generateReferralCode();
        const id = uuidv4();
        const settings = await getSettings();
        const startBal = settings.starting_balance || 0;
        const username = googleName
          ? googleName.replace(/\s+/g, '').toLowerCase().slice(0, 16) + Math.floor(Math.random() * 999)
          : await makeUsernameFromEmail(googleEmail);

        await supabase.from('users').insert({
          id,
          email: googleEmail,
          password_hash: await bcrypt.hash(uuidv4(), 6), // random password since they use Google
          username,
          role: 'user',
          balance: startBal,
          referral_code: myReferralCode,
        });

        const { data: newUser } = await supabase.from('users').select('*').eq('id', id).single();
        existing = newUser;
      }

      if (existing.is_blocked) return res.status(403).json({ error: 'Account suspended' });
      return res.json({ token: signToken(existing), user: publicUser(existing) });
    }
  }

  // ── GAME ──────────────────────────────────────────────────────────────────
  if (p0 === 'game') {
    if (p1 === 'state' && req.method === 'GET') {
      try { return res.json(await advanceRound()); }
      catch (e) { console.error(e); return res.status(500).json({ error: 'Game error' }); }
    }

    if (p1 === 'history' && req.method === 'GET') {
      const { data } = await supabase.from('rounds').select('id, crash_point, server_seed_hash, client_seed, status, started_at, crashed_at').eq('status', 'crashed').order('created_at', { ascending: false }).limit(20);
      return res.json({ rounds: data || [] });
    }

    if (p1 === 'bet' && req.method === 'POST') {
      const user = await getUser(req);
      if (!user) return res.status(401).json({ error: 'Authentication required' });
      // Allow betting if user has balance (from admin adjustment or deposit approval)
      if (!user.has_deposited && user.balance <= 0) return res.status(400).json({ error: 'Deposit required. Request a deposit in Wallet and wait for admin approval.' });
      
      const { amount, autoCashout } = req.body;
      const { data: rounds } = await supabase.from('rounds').select('*').order('created_at', { ascending: false }).limit(1);
      const round = rounds?.[0];
      if (!round || round.status !== 'betting') return res.status(400).json({ error: 'Betting is closed' });
      
      const { data: existing } = await supabase.from('bets').select('id').eq('round_id', round.id).eq('user_id', user.id).maybeSingle();
      if (existing) return res.status(400).json({ error: 'Already placed a bet' });
      if (user.balance < amount) return res.status(400).json({ error: 'Insufficient coins' });
      
      const settings = await getSettings();
      const minBet = settings.min_bet || 10;
      const maxBet = settings.max_bet || 10000;
      if (amount < minBet || amount > maxBet) return res.status(400).json({ error: `Bet must be between ${minBet} and ${maxBet} coins` });
      
      await supabase.from('users').update({ balance: user.balance - amount }).eq('id', user.id);
      await supabase.from('bets').insert({ id: uuidv4(), user_id: user.id, round_id: round.id, amount, auto_cashout: autoCashout || null, status: 'active' });
      await supabase.from('transactions').insert({
        id: uuidv4(),
        user_id: user.id,
        type: 'bet',
        amount: -amount,
        status: 'completed',
        round_id: round.id,
        note: 'Round bet'
      });
      return res.json({ ok: true });
    }

    if (p1 === 'cashout' && req.method === 'POST') {
      const user = await getUser(req);
      if (!user) return res.status(401).json({ error: 'Authentication required' });
      const { data: rounds } = await supabase.from('rounds').select('*').order('created_at', { ascending: false }).limit(1);
      const round = rounds?.[0];
      if (!round || round.status !== 'flying') return res.status(400).json({ error: 'Cannot cashout now' });
      
      const { data: bet } = await supabase.from('bets').select('*').eq('round_id', round.id).eq('user_id', user.id).eq('status', 'active').maybeSingle();
      if (!bet) return res.status(400).json({ error: 'No active bet' });
      
      const multi = calcMultiplier(round.started_at);
      if (multi >= round.crash_point) {
        await supabase.from('bets').update({ status: 'lost', profit: -bet.amount }).eq('id', bet.id);
        await supabase.from('transactions').insert({
          id: uuidv4(),
          user_id: user.id,
          type: 'loss',
          amount: -bet.amount,
          status: 'completed',
          round_id: round.id,
          note: 'Crashed before cashout'
        });
        return res.status(400).json({ error: 'Plane already crashed' });
      }
      
      const payout = Math.floor(bet.amount * multi);
      const profit = payout - bet.amount;
      
      await supabase.from('bets').update({ status: 'cashed_out', cashout_multiplier: multi, profit }).eq('id', bet.id);
      await supabase.from('users').update({ balance: user.balance + payout, total_won: (user.total_won || 0) + profit, best_multiplier: Math.max(user.best_multiplier || 0, multi) }).eq('id', user.id);
      await supabase.from('transactions').insert({
        id: uuidv4(),
        user_id: user.id,
        type: 'win',
        amount: payout,
        status: 'completed',
        round_id: round.id,
        note: `Cashed out at ${multi}x`
      });
      
      if (profit > 0) {
        await creditReferrerOnWin(user.id, profit);
      }
      return res.json({ ok: true, multiplier: multi, winAmount: payout });
    }
  }

  // ── CURRENCY ─────────────────────────────────────────────────────────────
  if (p0 === 'currency') {
    if (p1 === 'deposit-info' && req.method === 'GET') {
      const settings = await getSettings();
      return res.json({ accountType: settings.deposit_account_type || 'Jazzcash', accountName: settings.deposit_account_name || 'Admin', accountNumber: settings.deposit_account_number || '00000000000' });
    }

    if (p1 === 'request' && req.method === 'POST') {
      const user = await getUser(req);
      if (!user) return res.status(401).json({ error: 'Authentication required' });
      const { type, amount, depositorName, senderNumber, transactionId, accountName, accountNumber, accountType } = req.body;
      
      if (!['deposit', 'withdraw'].includes(type)) return res.status(400).json({ error: 'Type must be deposit or withdraw' });
      const parsedAmount = parseInt(amount, 10);
      if (!parsedAmount || parsedAmount < 10) return res.status(400).json({ error: 'Minimum amount is 10 coins' });
      
      if (type === 'deposit') {
        if (!depositorName?.trim()) return res.status(400).json({ error: 'Your name is required' });
        if (!senderNumber?.trim()) return res.status(400).json({ error: 'Sender number / account is required' });
        if (!transactionId?.trim()) return res.status(400).json({ error: 'Transaction ID is required' });
      } else {
        if (!accountName?.trim()) return res.status(400).json({ error: 'Account holder name is required' });
        if (!accountNumber?.trim()) return res.status(400).json({ error: 'Account number is required' });
        if (!accountType?.trim()) return res.status(400).json({ error: 'Account type is required (e.g. JazzCash)' });
        if (user.balance < parsedAmount) return res.status(400).json({ error: `Insufficient balance. You have ${user.balance} coins but requested ${parsedAmount}.` });
      }
      
      const { data: pending } = await supabase.from('currency_requests').select('id').eq('user_id', user.id).eq('type', type).eq('status', 'pending').maybeSingle();
      if (pending) return res.status(400).json({ error: `You already have a pending ${type} request. Wait for admin approval.` });
      
      const { error } = await supabase.from('currency_requests').insert({
        id: uuidv4(),
        user_id: user.id,
        type,
        amount: parsedAmount,
        status: 'pending',
        depositor_name: type === 'deposit' ? depositorName.trim() : null,
        sender_number: type === 'deposit' ? senderNumber.trim() : null,
        transaction_id: type === 'deposit' ? transactionId.trim() : null,
        account_name: type === 'withdraw' ? accountName.trim() : null,
        account_number: type === 'withdraw' ? accountNumber.trim() : null,
        account_type: type === 'withdraw' ? accountType.trim() : null
      });
      if (error) return res.status(500).json({ error: error.message || 'Failed to submit' });
      return res.json({ ok: true });
    }

    if (p1 === 'requests' && req.method === 'GET') {
      const user = await getUser(req);
      if (!user) return res.status(401).json({ error: 'Authentication required' });
      const { data } = await supabase.from('currency_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
      const mapped = (data || []).map(r => ({
        ...r,
        account_type: r.account_type || (r.type === 'withdraw' ? r.note : null)
      }));
      return res.json({ requests: mapped });
    }
  }

  // ── SUPPORT ───────────────────────────────────────────────────────────────
  if (p0 === 'support') {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    
    if (p1 === 'messages') {
      if (req.method === 'GET') {
        const { data } = await supabase.from('private_chat_messages').select('*').eq('thread_user_id', user.id).order('created_at', { ascending: true }).limit(100);
        return res.json({ messages: data || [] });
      }
      if (req.method === 'POST') {
        const { message } = req.body;
        if (!message?.trim()) return res.status(400).json({ error: 'Message required' });
        const row = {
          id: uuidv4(),
          thread_user_id: user.id,
          sender_role: 'user',
          sender_id: user.id,
          message: message.trim()
        };
        await supabase.from('private_chat_messages').insert(row);
        return res.json({ ok: true, message: row });
      }
    }
  }

  // ── MISC ROUTES ───────────────────────────────────────────────────────────
  if (p0 === 'transactions' && req.method === 'GET') {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const { data } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    return res.json({ transactions: data || [] });
  }

  if (p0 === 'leaderboard' && req.method === 'GET') {
    const period = query.period || 'all';
    const dateLimit = new Date();
    if (period === 'daily') dateLimit.setDate(dateLimit.getDate() - 1);
    else if (period === 'weekly') dateLimit.setDate(dateLimit.getDate() - 7);
    
    let realWins = [];
    if (period === 'all') {
      const { data } = await supabase.from('users').select('username, avatar_id, total_won').gt('total_won', 0).order('total_won', { ascending: false }).limit(20);
      realWins = (data || []).map(u => ({ username: u.username, avatar_id: u.avatar_id, score: u.total_won }));
    } else {
      const { data } = await supabase.from('bets').select('profit, users(username, avatar_id)').eq('status', 'cashed_out').gt('profit', 0).gte('created_at', dateLimit.toISOString());
      const userWins = {};
      for (const b of (data || [])) {
        const username = b.users?.username;
        if (!username) continue;
        if (!userWins[username]) {
          userWins[username] = { username, avatar_id: b.users.avatar_id, score: 0 };
        }
        userWins[username].score += Number(b.profit);
      }
      realWins = Object.values(userWins).sort((a, b) => b.score - a.score).slice(0, 20);
    }
    
    const { data: multData } = await supabase.from('users').select('username, avatar_id, best_multiplier').gt('best_multiplier', 1).order('best_multiplier', { ascending: false }).limit(20);
    const realMult = (multData || []).map(u => ({ username: u.username, avatar_id: u.avatar_id, score: u.best_multiplier }));
    
    // Merge with fake leaderboard
    const AVATARS = ['plane-red','plane-blue','plane-green','plane-gold','plane-purple','plane-neon'];
    const FAKE_NAMES = ['PilotRavi', 'SkyKing92', 'JetFlyer', 'AceWing', 'TurboBird','CloudRider', 'NightHawk', 'StarPilot', 'RedWing', 'BlueJet'];
    const mult = period === 'daily' ? 0.4 : period === 'weekly' ? 0.65 : 1;
    
    const fakeWins = FAKE_NAMES.slice(0, 8).map((username, i) => ({
      username,
      avatar_id: AVATARS[i % AVATARS.length],
      score: Math.floor((1200 + i * 2300) * mult),
      isFake: true
    }));
    
    const fakeMult = FAKE_NAMES.slice(2, 9).map((username, i) => ({
      username,
      avatar_id: AVATARS[i % AVATARS.length],
      score: Math.round((1.5 + i * 0.4) * (period === 'all' ? 1.2 : 1) * 100) / 100,
      isFake: true
    }));
    
    const merge = (real, fake) => {
      const combined = [...real, ...fake];
      return combined.sort((a, b) => b.score - a.score).slice(0, 20);
    };
    
    return res.json({
      period,
      topWins: merge(realWins, fakeWins),
      topMultipliers: merge(realMult, fakeMult)
    });
  }

  if (p0 === 'avatars' && req.method === 'GET') {
    return res.json({
      avatars: [
        { id: 'plane-red', name: 'Crimson Jet', color: '#ef4444' },
        { id: 'plane-blue', name: 'Sky Rider', color: '#3b82f6' },
        { id: 'plane-green', name: 'Emerald Wing', color: '#22c55e' },
        { id: 'plane-gold', name: 'Golden Eagle', color: '#eab308' },
        { id: 'plane-purple', name: 'Violet Storm', color: '#a855f7' },
        { id: 'plane-neon', name: 'Neon Phantom', color: '#06b6d4' }
      ],
      skins: [
        { id: 'classic', name: 'Classic' },
        { id: 'stealth', name: 'Stealth' },
        { id: 'racer', name: 'Racer' },
        { id: 'vintage', name: 'Vintage' }
      ]
    });
  }

  if (p0 === 'profile' && req.method === 'PATCH') {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const { username, avatarId, planeSkin } = req.body;
    const updates = {};
    if (username) {
      const { data: taken } = await supabase.from('users').select('id').eq('username', username).neq('id', user.id).maybeSingle();
      if (taken) return res.status(409).json({ error: 'Username already taken' });
      updates.username = username;
    }
    if (avatarId) updates.avatar_id = avatarId;
    if (planeSkin) updates.plane_skin = planeSkin;
    await supabase.from('users').update(updates).eq('id', user.id);
    
    const { data: updated } = await supabase.from('users').select('*').eq('id', user.id).single();
    return res.json({ user: publicUser(updated) });
  }

  if (p0 === 'daily-reward' && req.method === 'POST') {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    if (!user.has_deposited) return res.status(400).json({ error: 'Complete a deposit and get admin approval before claiming rewards' });
    
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase.from('daily_claims').select('*').eq('user_id', user.id).eq('claim_date', today).maybeSingle();
    if (existing) return res.status(400).json({ error: 'Daily reward already claimed today' });
    
    const settings = await getSettings();
    const reward = settings.daily_reward || 500;
    
    await supabase.from('users').update({ balance: user.balance + reward }).eq('id', user.id);
    await supabase.from('daily_claims').insert({ user_id: user.id, claim_date: today });
    await supabase.from('transactions').insert({
      id: uuidv4(),
      user_id: user.id,
      type: 'daily_reward',
      amount: reward,
      status: 'completed',
      note: 'Daily login reward'
    });
    
    const { data: updated } = await supabase.from('users').select('*').eq('id', user.id).single();
    return res.json({ amount: reward, user: publicUser(updated) });
  }

  if (p0 === 'referral' && req.method === 'GET') {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    
    const settings = await getSettings();
    const percent = settings.referral_commission_percent || 2;
    const winChance = settings.referral_win_chance_percent || 10;
    
    const { data: team } = await supabase.from('users').select('username, total_won, best_multiplier, created_at').eq('referred_by', user.id).order('created_at', { ascending: false });
    
    let referredByCode = null;
    if (user.referred_by) {
      const { data: refUser } = await supabase.from('users').select('referral_code, username').eq('id', user.referred_by).maybeSingle();
      referredByCode = refUser;
    }
    
    return res.json({
      myCode: user.referral_code,
      referralEarnings: Number(user.referral_earnings || 0),
      commissionPercent: percent,
      winChancePercent: winChance,
      teamCount: team?.length || 0,
      team: team || [],
      referredBy: referredByCode ? { code: referredByCode.referral_code, username: referredByCode.username } : null
    });
  }

  if (p0 === 'chat' && req.method === 'GET') {
    return res.json({ messages: [] });
  }

  // ── ADMIN ─────────────────────────────────────────────────────────────────
  if (p0 === 'admin') {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    if (user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    if (p1 === 'stats' && req.method === 'GET') {
      const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
      const { count: betsCount } = await supabase.from('bets').select('*', { count: 'exact', head: true });
      const { count: pendingDeposit } = await supabase.from('currency_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('type', 'deposit');
      const { count: pendingWithdraw } = await supabase.from('currency_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('type', 'withdraw');
      
      const { data: pendingWithdrawals } = await supabase.from('currency_requests').select('*, users(username, email)').eq('status', 'pending').eq('type', 'withdraw').order('created_at', { ascending: false }).limit(20);
      const formattedWithdrawals = (pendingWithdrawals || []).map(r => ({
        ...r,
        account_type: r.account_type || (r.type === 'withdraw' ? r.note : null),
        username: r.users?.username,
        email: r.users?.email,
        users: undefined
      }));
      
      return res.json({
        users: usersCount || 0,
        pendingRequests: (pendingDeposit || 0) + (pendingWithdraw || 0),
        pendingWithdraw: pendingWithdraw || 0,
        pendingDeposit: pendingDeposit || 0,
        totalBets: betsCount || 0,
        pendingWithdrawals: formattedWithdrawals,
        unreadSupport: 0
      });
    }

    if (p1 === 'users') {
      if (req.method === 'GET') {
        const { data } = await supabase.from('users').select('id, email, username, role, balance, is_blocked, created_at, total_won, best_multiplier, reference, referral_code, referral_earnings, referred_by').order('created_at', { ascending: false }).limit(200);
        return res.json({ users: data || [] });
      }
      if (p2 && req.method === 'PATCH') {
        const { role, isBlocked } = req.body;
        const updates = {};
        if (role !== undefined) updates.role = role;
        if (isBlocked !== undefined) updates.is_blocked = isBlocked;
        
        await supabase.from('users').update(updates).eq('id', p2);
        const { data: updated } = await supabase.from('users').select('*').eq('id', p2).single();
        return res.json({ user: publicUser(updated) });
      }
      if (p2 && p3 === 'balance' && req.method === 'POST') {
        const { amount, note } = req.body;
        const { data: target } = await supabase.from('users').select('*').eq('id', p2).single();
        if (!target) return res.status(404).json({ error: 'User not found' });
        
        const newBal = target.balance + amount;
        if (newBal < 0) return res.status(400).json({ error: 'Balance cannot go negative' });
        
        // Also set has_deposited=true so user can place bets
        await supabase.from('users').update({ balance: newBal, has_deposited: true }).eq('id', p2);
        await supabase.from('transactions').insert({
          id: uuidv4(),
          user_id: p2,
          type: 'admin_adjustment',
          amount,
          status: 'completed',
          admin_id: user.id,
          note: note || 'Admin balance adjustment'
        });
        
        const { data: updated } = await supabase.from('users').select('*').eq('id', p2).single();
        return res.json({ user: publicUser(updated) });
      }
    }

    if (p1 === 'settings') {
      if (req.method === 'GET') {
        const settings = await getSettings();
        return res.json({ settings });
      }
      if (req.method === 'PATCH') {
        const newSettings = req.body.settings;
        if (!newSettings) return res.status(400).json({ error: 'Missing settings' });
        const upsertData = Object.keys(newSettings).map(key => {
          let val = newSettings[key];
          if (typeof val === 'boolean') val = val ? 'true' : 'false';
          if (typeof val === 'number') val = val.toString();
          return { key, value: String(val ?? '') };
        });
        await supabase.from('game_settings').upsert(upsertData);
        const settings = await getSettings();
        return res.json({ settings });
      }
    }

    if (p1 === 'requests') {
      if (req.method === 'GET') {
        const { data } = await supabase.from('currency_requests').select('*, users(username, email)').order('created_at', { ascending: false }).limit(200);
        const requests = (data || []).map(r => ({
          ...r,
          // Support both old (note column) and new (account_type column) storage
          account_type: r.account_type || (r.type === 'withdraw' ? r.note : null),
          username: r.users?.username,
          email: r.users?.email,
          users: undefined
        })).sort((a, b) => {
          const getPriority = (req) => {
            if (req.status === 'pending' && req.type === 'withdraw') return 0;
            if (req.status === 'pending' && req.type === 'deposit') return 1;
            if (req.status === 'pending') return 2;
            return 3;
          };
          const pA = getPriority(a);
          const pB = getPriority(b);
          if (pA !== pB) return pA - pB;
          return new Date(b.created_at) - new Date(a.created_at);
        });
        return res.json({ requests });
      }
      
      if (p2 && req.method === 'PATCH') {
        const { status, adminReply } = req.body;
        const { data: cr } = await supabase.from('currency_requests').select('*').eq('id', p2).single();
        if (!cr || cr.status !== 'pending') return res.status(400).json({ error: 'Request not found or already processed' });
        
        if (status === 'approved') {
          const { data: targetUser } = await supabase.from('users').select('balance').eq('id', cr.user_id).single();
          if (cr.type === 'deposit') {
            await supabase.from('users').update({ balance: targetUser.balance + cr.amount, has_deposited: true }).eq('id', cr.user_id);
          } else {
            if (targetUser.balance < cr.amount) return res.status(400).json({ error: 'User has insufficient balance' });
            await supabase.from('users').update({ balance: targetUser.balance - cr.amount }).eq('id', cr.user_id);
          }
          
          const sign = cr.type === 'deposit' ? 1 : -1;
          await supabase.from('transactions').insert({
            id: uuidv4(),
            user_id: cr.user_id,
            type: `admin_${cr.type}`,
            amount: sign * cr.amount,
            status: 'completed',
            admin_id: user.id,
            note: `Approved ${cr.type} request`
          });
        }
        
        const updates = { status, admin_id: user.id };
        if (adminReply?.trim()) {
          updates.admin_reply = adminReply.trim();
          updates.admin_replied_at = new Date().toISOString();
        }
        await supabase.from('currency_requests').update(updates).eq('id', p2);
        return res.json({ ok: true });
      }
      
      if (p2 && p3 === 'reply' && req.method === 'POST') {
        const { message } = req.body;
        await supabase.from('currency_requests').update({ admin_reply: message.trim(), admin_replied_at: new Date().toISOString() }).eq('id', p2);
        return res.json({ ok: true });
      }
    }

    if (p1 === 'transactions' && req.method === 'GET') {
      const { data } = await supabase.from('transactions').select('*, users(username)').order('created_at', { ascending: false }).limit(200);
      const transactions = (data || []).map(t => ({
        ...t,
        username: t.users?.username,
        users: undefined
      }));
      return res.json({ transactions });
    }

    if (p1 === 'chat') {
      if (req.method === 'GET') return res.json({ messages: [] });
      if (p2 && req.method === 'DELETE') return res.json({ ok: true });
    }

    if (p1 === 'support') {
      if (p2 === 'threads' && req.method === 'GET') {
        const { data: distinctThreads } = await supabase.from('private_chat_messages').select('thread_user_id');
        const userIds = [...new Set((distinctThreads || []).map(m => m.thread_user_id))];
        if (userIds.length === 0) return res.json({ threads: [] });
        
        const { data: users } = await supabase.from('users').select('id, username, email').in('id', userIds);
        const { data: allMessages } = await supabase.from('private_chat_messages').select('*').in('thread_user_id', userIds).order('created_at', { ascending: false });
        
        const threadsMap = {};
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        for (const msg of (allMessages || [])) {
          const uid = msg.thread_user_id;
          if (!threadsMap[uid]) {
            threadsMap[uid] = {
              last_message: msg.message,
              last_at: msg.created_at,
              recent_count: 0
            };
          }
          if (msg.sender_role === 'user' && new Date(msg.created_at).getTime() >= oneDayAgo) {
            threadsMap[uid].recent_count += 1;
          }
        }
        
        const threads = (users || []).map(u => ({
          id: u.id,
          username: u.username,
          email: u.email,
          last_message: threadsMap[u.id]?.last_message || '',
          last_at: threadsMap[u.id]?.last_at || '',
          recent_count: threadsMap[u.id]?.recent_count || 0
        })).sort((a, b) => new Date(b.last_at) - new Date(a.last_at));
        
        return res.json({ threads });
      }
      
      if (p2 === 'messages' && p3) {
        if (req.method === 'GET') {
          const { data: messages } = await supabase.from('private_chat_messages').select('*').eq('thread_user_id', p3).order('created_at', { ascending: true }).limit(200);
          const { data: userRow } = await supabase.from('users').select('id, username, email').eq('id', p3).single();
          return res.json({ user: userRow, messages: messages || [] });
        }
        if (req.method === 'POST') {
          const { message } = req.body;
          if (!message?.trim()) return res.status(400).json({ error: 'Message required' });
          const row = {
            id: uuidv4(),
            thread_user_id: p3,
            sender_role: 'admin',
            sender_id: user.id,
            message: message.trim()
          };
          await supabase.from('private_chat_messages').insert(row);
          return res.json({ ok: true, message: row });
        }
      }
    }
  }

  return res.status(404).json({ error: 'Not found' });
}
