import { adminMiddleware } from '../_lib/auth.js';
import { supabase } from '../_lib/db.js';

export default adminMiddleware(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, username, role, balance, has_deposited, is_blocked, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (error) throw error;
    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
