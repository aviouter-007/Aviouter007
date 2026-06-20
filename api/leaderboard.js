import { supabase } from '../_lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const period = req.query?.period || 'all';

  let query = supabase
    .from('users')
    .select('id, username, avatar_id, total_won, best_multiplier')
    .order('total_won', { ascending: false })
    .limit(20);

  res.json(await query.then(r => r.data || []));
}
