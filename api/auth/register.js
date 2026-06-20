import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { supabase, makeUsernameFromEmail } from '../_lib/db.js';
import { signToken } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const { email, password, username, referralCode } = req.body;
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Valid email and 6+ char password required' });
  }

  try {
    const finalUsername = username || makeUsernameFromEmail(email);
    const hash = bcrypt.hashSync(password, 10);
    const id = uuidv4();

    let referredBy = null;
    if (referralCode) {
      const { data: refUser } = await supabase
        .from('users')
        .select('id')
        .eq('referral_code', referralCode)
        .single();
      if (refUser) referredBy = refUser.id;
    }

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        id,
        email,
        password_hash: hash,
        username: finalUsername,
        referred_by: referredBy,
        referral_code: uuidv4().slice(0, 8),
        balance: 0
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Email or username already exists' });
      }
      throw error;
    }

    const token = signToken(user);
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
