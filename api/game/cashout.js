import { supabase } from '../_lib/db.js';
import { authMiddleware } from '../_lib/auth.js';

export default authMiddleware(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const userId = req.user.id;

  try {
    const { data: rounds } = await supabase
      .from('rounds')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    const round = rounds && rounds.length > 0 ? rounds[0] : null;

    if (!round || round.status !== 'flying') {
      return res.status(400).json({ error: 'Cannot cashout right now' });
    }

    const { data: bet } = await supabase
      .from('bets')
      .select('*')
      .eq('round_id', round.id)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (!bet) return res.status(400).json({ error: 'No active bet found' });

    // Calculate exact multiplier based on current server time
    const elapsedSec = (new Date().getTime() - new Date(round.started_at).getTime()) / 1000;
    const currentMultiplier = Math.round((1 + elapsedSec * 0.15 + Math.pow(elapsedSec, 1.6) * 0.08) * 100) / 100;

    // Is it too late? (Did the plane already crash in reality?)
    if (currentMultiplier >= round.crash_point) {
      // User lost
      await supabase.from('bets').update({ status: 'lost' }).eq('id', bet.id);
      return res.status(400).json({ error: 'Plane already flew away!' });
    }

    const winAmount = Math.floor(bet.amount * currentMultiplier);

    // Update bet
    await supabase.from('bets').update({
      status: 'cashed_out',
      cashout_multiplier: currentMultiplier,
      win_amount: winAmount
    }).eq('id', bet.id);

    // Add winnings to balance
    const { data: user } = await supabase.from('users').select('balance').eq('id', userId).single();
    await supabase.from('users').update({ balance: user.balance + winAmount }).eq('id', userId);

    res.json({ ok: true, multiplier: currentMultiplier, winAmount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
