import { adminMiddleware } from '../../../_lib/auth.js';
import { supabase } from '../../../_lib/db.js';

export default adminMiddleware(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const userId = req.query.id;
  const { amount, type } = req.body;

  const { data: user } = await supabase.from('users').select('balance').eq('id', userId).single();
  if (!user) return res.status(404).json({ error: 'User not found' });

  const newBalance = type === 'add' ? user.balance + amount : user.balance - amount;
  await supabase.from('users').update({ balance: Math.max(0, newBalance) }).eq('id', userId);

  res.json({ ok: true, newBalance: Math.max(0, newBalance) });
});
