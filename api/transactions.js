import { authMiddleware } from '../_lib/auth.js';
import { supabase } from '../_lib/db.js';

export default authMiddleware(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  res.json(data || []);
});
