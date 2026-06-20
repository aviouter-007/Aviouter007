import { adminMiddleware } from '../../_lib/auth.js';
import { supabase } from '../../_lib/db.js';

export default adminMiddleware(async function handler(req, res) {
  const userId = req.query.id;
  if (!userId) return res.status(400).json({ error: 'Missing user id' });

  if (req.method === 'PATCH') {
    const { role, is_blocked, balance } = req.body;
    const updates = {};
    if (role !== undefined) updates.role = role;
    if (is_blocked !== undefined) updates.is_blocked = is_blocked;
    if (balance !== undefined) updates.balance = balance;

    const { error } = await supabase.from('users').update(updates).eq('id', userId);
    if (error) return res.status(500).json({ error: 'Update failed' });

    return res.json({ ok: true });
  }

  return res.status(405).send('Method not allowed');
});
