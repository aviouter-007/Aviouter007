import { adminMiddleware } from '../../../_lib/auth.js';
import { supabase } from '../../../_lib/db.js';

export default adminMiddleware(async function handler(req, res) {
  const requestId = req.query.id;

  if (req.method === 'PATCH') {
    const { status } = req.body;
    const { error } = await supabase.from('currency_requests').update({ status, admin_id: req.user.id }).eq('id', requestId);
    if (error) return res.status(500).json({ error: 'Update failed' });

    if (status === 'approved') {
      const { data: cr } = await supabase.from('currency_requests').select('*').eq('id', requestId).single();
      if (cr && cr.type === 'deposit') {
        const { data: user } = await supabase.from('users').select('balance').eq('id', cr.user_id).single();
        await supabase.from('users').update({ balance: user.balance + cr.amount, has_deposited: true }).eq('id', cr.user_id);
      }
      if (cr && cr.type === 'withdraw') {
        const { data: user } = await supabase.from('users').select('balance').eq('id', cr.user_id).single();
        await supabase.from('users').update({ balance: Math.max(0, user.balance - cr.amount) }).eq('id', cr.user_id);
      }
    }
    return res.json({ ok: true });
  }

  return res.status(405).send('Method not allowed');
});
