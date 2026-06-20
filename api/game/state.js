import { supabase } from '../_lib/db.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

function computeBiasedCrashPoint(min, max) {
  return min + Math.random() * (max - min); // simplified for serverless
}

function resolveCrashPoint() {
  if (Math.random() < 0.90) return computeBiasedCrashPoint(1.00, 1.15);
  return computeBiasedCrashPoint(1.50, 2.50);
}

export default async function handler(req, res) {
  try {
    // 1. Get current active round, or create one if none exists
    const { data: rounds, error } = await supabase
      .from('rounds')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    let round = rounds && rounds.length > 0 ? rounds[0] : null;

    const now = new Date();

    // 2. State Machine Logic
    if (!round || round.status === 'crashed') {
      // Check if it's been > 3 seconds since crash to start betting
      const timeSinceCrash = round ? now.getTime() - new Date(round.crashed_at).getTime() : 10000;
      
      if (timeSinceCrash > 3000) {
        // Create new betting round
        const newRoundId = uuidv4();
        const serverSeed = crypto.randomUUID();
        const serverHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
        
        const { data: newRound } = await supabase
          .from('rounds')
          .insert({
            id: newRoundId,
            status: 'betting',
            crash_point: 1, // temporary
            server_seed: serverSeed,
            server_seed_hash: serverHash,
            client_seed: crypto.randomUUID()
          })
          .select()
          .single();
        round = newRound;
      }
    } else if (round.status === 'betting') {
      // Check if 5 seconds of betting have passed
      const timeSinceStart = now.getTime() - new Date(round.created_at).getTime();
      if (timeSinceStart > 5000) {
        // Transition to flying
        const crashPoint = resolveCrashPoint();
        const { data: updatedRound } = await supabase
          .from('rounds')
          .update({
            status: 'flying',
            crash_point: crashPoint,
            started_at: new Date().toISOString()
          })
          .eq('id', round.id)
          .select()
          .single();
        round = updatedRound;
      }
    } else if (round.status === 'flying') {
      // Check if the plane should crash based on elapsed time
      const elapsedSec = (now.getTime() - new Date(round.started_at).getTime()) / 1000;
      const currentMultiplier = Math.round((1 + elapsedSec * 0.15 + Math.pow(elapsedSec, 1.6) * 0.08) * 100) / 100;

      if (currentMultiplier >= round.crash_point) {
        // Crash the round
        const { data: crashedRound } = await supabase
          .from('rounds')
          .update({
            status: 'crashed',
            crashed_at: new Date().toISOString()
          })
          .eq('id', round.id)
          .select()
          .single();
        
        round = crashedRound;

        // Auto-lose all active bets
        await supabase
          .from('bets')
          .update({ status: 'lost' })
          .eq('round_id', round.id)
          .eq('status', 'active');
      }
    }

    // 3. Fetch active bets for this round
    const { data: activeBets } = await supabase
      .from('bets')
      .select('id, user_id, amount, auto_cashout, cashout_multiplier, status, users (username)')
      .eq('round_id', round.id);

    // Format for client
    const clientBets = activeBets ? activeBets.map(b => ({
      id: b.id,
      username: b.users?.username || 'Player',
      amount: b.amount,
      cashoutMultiplier: b.cashout_multiplier,
      status: b.status,
      isFake: false
    })) : [];

    const publicRound = { ...round };
    if (publicRound.status !== 'crashed') {
      delete publicRound.server_seed;
      delete publicRound.crash_point;
    }

    res.json({
      phase: publicRound.status,
      round: publicRound,
      multiplier: 1.0, // Multiplier calculated locally by client using started_at
      activeBets: clientBets,
      playersOnline: 42 + Math.floor(Math.random() * 10),
      settings: {
        minBet: 10, maxBet: 10000, bettingSeconds: 5, maxMultiplier: 100
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
