import { supabase } from '../_lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  try {
    const { data, error } = await supabase.from('game_settings').select('*');
    if (error) throw error;

    const settings = {};
    if (data) {
      data.forEach(row => { settings[row.key] = row.value; });
    }

    res.json({
      accountType: settings.deposit_account_type || 'Jazzcash',
      accountName: settings.deposit_account_name || 'Admin',
      accountNumber: settings.deposit_account_number || '00000000000'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
