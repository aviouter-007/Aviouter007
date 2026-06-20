import { authMiddleware } from '../_lib/auth.js';
import { supabase } from '../_lib/db.js';

export default authMiddleware(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const userId = req.user.id;

  const { data, error } = await supabase
    .from('currency_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Fetch requests error:', error);
    return res.status(500).json({ error: 'Server error' });
  }

  res.json(data || []);
});
