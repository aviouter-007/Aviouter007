import { supabase } from '../_lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(50);

  res.json(data || []);
}
