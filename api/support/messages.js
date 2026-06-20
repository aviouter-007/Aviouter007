import { authMiddleware } from '../_lib/auth.js';
import { supabase } from '../_lib/db.js';

export default authMiddleware(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const { data } = await supabase
    .from('private_chat_messages')
    .select('*')
    .eq('thread_user_id', req.user.id)
    .order('created_at', { ascending: true })
    .limit(100);

  res.json(data || []);
});
