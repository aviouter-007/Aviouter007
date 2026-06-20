import { adminMiddleware } from '../../../_lib/auth.js';
import { supabase } from '../../../_lib/db.js';

export default adminMiddleware(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  const { data } = await supabase
    .from('private_chat_messages')
    .select('*')
    .eq('thread_user_id', userId)
    .order('created_at', { ascending: true })
    .limit(100);

  res.json(data || []);
});
