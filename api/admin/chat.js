import { adminMiddleware } from '../../_lib/auth.js';
import { supabase } from '../../_lib/db.js';

export default adminMiddleware(async function handler(req, res) {
  if (req.method === 'GET') {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    return res.json(data || []);
  }
  if (req.method === 'DELETE') {
    const id = req.query.id;
    await supabase.from('chat_messages').update({ is_deleted: true }).eq('id', id);
    return res.json({ ok: true });
  }
  return res.status(405).send('Method not allowed');
});
