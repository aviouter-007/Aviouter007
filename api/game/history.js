import { supabase } from '../_lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const { data, error } = await supabase
    .from('rounds')
    .select('id, crash_point, created_at')
    .eq('status', 'crashed')
    .order('created_at', { ascending: false })
    .limit(20);

  res.json({ rounds: data || [] });
}
