import { adminMiddleware } from '../_lib/auth.js';
import { supabase } from '../_lib/db.js';

export default adminMiddleware(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  try {
    const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: betsCount } = await supabase.from('bets').select('*', { count: 'exact', head: true });
    
    // Simplistic stats for serverless
    res.json({
      totalUsers: usersCount || 0,
      totalBets: betsCount || 0,
      totalWagered: 0,
      totalWon: 0,
      profit: 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
