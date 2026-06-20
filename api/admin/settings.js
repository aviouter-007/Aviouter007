import { adminMiddleware } from '../_lib/auth.js';
import { supabase } from '../_lib/db.js';

export default adminMiddleware(async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('game_settings').select('*');
    if (error) return res.status(500).json({ error: 'Database error' });

    // Convert from key-value to object
    const settingsObj = {};
    if (data) {
      data.forEach(row => {
        let val = row.value;
        if (val === 'true') val = true;
        if (val === 'false') val = false;
        if (!isNaN(val) && val.trim() !== '') val = Number(val);
        settingsObj[row.key] = val;
      });
    }

    // Default fallback mappings if keys don't exist
    return res.json({
      settings: {
        siteName: settingsObj.siteName || "Aviouter",
        maintenance: settingsObj.maintenance || false,
        minDeposit: settingsObj.minDeposit || 10,
        minWithdraw: settingsObj.minWithdraw || 50,
        deposit_account_type: settingsObj.deposit_account_type || "Jazzcash",
        deposit_account_name: settingsObj.deposit_account_name || "Admin",
        deposit_account_number: settingsObj.deposit_account_number || "00000000000",
        ...settingsObj
      }
    });
  }

  if (req.method === 'PATCH') {
    const newSettings = req.body.settings;
    if (!newSettings) return res.status(400).json({ error: 'Missing settings' });

    // Prepare rows for upsert
    const upsertData = Object.keys(newSettings).map(key => {
      let val = newSettings[key];
      if (typeof val === 'boolean') val = val ? 'true' : 'false';
      if (typeof val === 'number') val = val.toString();
      if (val === null || val === undefined) val = '';
      return { key, value: val };
    });

    const { error } = await supabase.from('game_settings').upsert(upsertData);
    if (error) {
      console.error('Settings update error:', error);
      return res.status(500).json({ error: 'Failed to update settings' });
    }

    return res.json({ ok: true });
  }

  return res.status(405).send('Method not allowed');
});
