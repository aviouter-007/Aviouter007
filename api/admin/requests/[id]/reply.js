import { adminMiddleware } from '../../../../_lib/auth.js';
import { supabase } from '../../../../_lib/db.js';

export default adminMiddleware(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  const requestId = req.query.id;
  const { message } = req.body;

  await supabase.from('currency_requests').update({
    admin_reply: message,
    admin_replied_at: new Date().toISOString()
  }).eq('id', requestId);

  res.json({ ok: true });
});
