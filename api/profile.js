import { authMiddleware } from '../_lib/auth.js';
import { supabase } from '../_lib/db.js';

export default authMiddleware(async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).send('Method not allowed');

  const { username, avatar_id, plane_skin } = req.body;
  const updates = {};
  if (username) updates.username = username;
  if (avatar_id) updates.avatar_id = avatar_id;
  if (plane_skin) updates.plane_skin = plane_skin;

  const { error } = await supabase.from('users').update(updates).eq('id', req.user.id);
  if (error) return res.status(500).json({ error: 'Update failed' });

  res.json({ ok: true });
});
