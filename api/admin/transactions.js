import { adminMiddleware } from '../../_lib/auth.js';
import { supabase } from '../../_lib/db.js';

export default adminMiddleware(async function handler(req, res) {
  if (req.method === 'GET') {
    const { data } = await supabase
      .from('transactions')
      .select('*, users(username)')
      .order('created_at', { ascending: false })
      .limit(50);
    return res.json({ transactions: data || [] });
  }
  return res.status(405).send('Method not allowed');
});
