import { authMiddleware } from '../_lib/auth.js';
import { supabase } from '../_lib/db.js';

export default authMiddleware(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const { data: user } = await supabase
    .from('users')
    .select('referral_code, referral_earnings, referred_by')
    .eq('id', req.user.id)
    .single();

  const { count } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('referred_by', user?.referral_code);

  res.json({
    referralCode: user?.referral_code || '',
    referralEarnings: user?.referral_earnings || 0,
    referredCount: count || 0,
    referredBy: user?.referred_by || null
  });
});
