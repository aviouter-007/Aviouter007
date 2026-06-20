import { authMiddleware } from '../_lib/auth.js';
import { supabase } from '../_lib/db.js';

export default authMiddleware(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  const { data: existing } = await supabase
    .from('daily_claims')
    .select('*')
    .eq('user_id', userId)
    .eq('claim_date', today)
    .single();

  if (existing) return res.status(400).json({ error: 'Already claimed today' });

  // Get daily reward amount from settings
  const { data: settings } = await supabase.from('game_settings').select('value').eq('key', 'daily_reward').single();
  const reward = settings ? parseInt(settings.value) : 500;

  // Add reward to balance
  const { data: user } = await supabase.from('users').select('balance').eq('id', userId).single();
  await supabase.from('users').update({ balance: user.balance + reward }).eq('id', userId);

  // Record claim
  await supabase.from('daily_claims').insert({ user_id: userId, claim_date: today });

  res.json({ ok: true, amount: reward, newBalance: user.balance + reward });
});
