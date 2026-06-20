import { adminMiddleware } from '../../_lib/auth.js';
import { supabase } from '../../_lib/db.js';

export default adminMiddleware(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const { data } = await supabase
    .from('private_chat_messages')
    .select('thread_user_id')
    .order('created_at', { ascending: false });

  // Get unique thread users
  const seen = new Set();
  const threads = [];
  for (const msg of (data || [])) {
    if (!seen.has(msg.thread_user_id)) {
      seen.add(msg.thread_user_id);
      threads.push(msg.thread_user_id);
    }
  }

  // Get user info for each thread
  const result = [];
  for (const uid of threads) {
    const { data: user } = await supabase.from('users').select('id, username, email').eq('id', uid).single();
    if (user) result.push(user);
  }

  res.json(result);
});
