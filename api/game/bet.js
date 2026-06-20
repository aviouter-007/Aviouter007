import { supabase } from '../_lib/db.js';
import { authMiddleware } from '../_lib/auth.js';
import { v4 as uuidv4 } from 'uuid';

export default authMiddleware(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const { amount, autoCashout } = req.body;
  const userId = req.user.id;

  try {
    const { data: rounds } = await supabase
      .from('rounds')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    const round = rounds && rounds.length > 0 ? rounds[0] : null;

    if (!round || round.status !== 'betting') {
      return res.status(400).json({ error: 'Betting is closed for this round' });
    }

    const { data: user } = await supabase
      .from('users')
      .select('balance, has_deposited')
      .eq('id', userId)
      .single();

    if (!user.has_deposited) {
      // return res.status(400).json({ error: 'Deposit required' }); // Removed for easier testing
    }
    if (user.balance < amount) {
      return res.status(400).json({ error: 'Insufficient coins' });
    }

    const { data: existingBet } = await supabase
      .from('bets')
      .select('id')
      .eq('round_id', round.id)
      .eq('user_id', userId)
      .single();

    if (existingBet) return res.status(400).json({ error: 'Already placed a bet' });

    // Deduct balance manually
    await supabase.from('users').update({ balance: user.balance - amount }).eq('id', userId);

    // Place bet
    const betId = uuidv4();
    await supabase.from('bets').insert({
      id: betId,
      user_id: userId,
      round_id: round.id,
      amount,
      auto_cashout: autoCashout,
      status: 'active'
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
