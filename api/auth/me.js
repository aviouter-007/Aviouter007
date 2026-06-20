import { authMiddleware } from '../../_lib/auth.js';
import { supabase } from '../../_lib/db.js';

export default authMiddleware(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, username, role, balance, has_deposited, is_blocked, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !user) return res.status(404).json({ error: 'User not found' });
    if (user.is_blocked) return res.status(403).json({ error: 'Account suspended' });

    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
