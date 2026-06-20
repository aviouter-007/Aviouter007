import { authMiddleware } from '../_lib/auth.js';
import { supabase } from '../_lib/db.js';
import { v4 as uuidv4 } from 'uuid';

export default authMiddleware(async function handler(req, res) {
  if (req.method === 'POST') {
    const { type, amount, depositorName, senderNumber, transactionId, accountName, accountNumber, accountType } = req.body;
    const userId = req.user.id;

    const id = uuidv4();
    const { error } = await supabase.from('currency_requests').insert({
      id,
      user_id: userId,
      type: type || 'deposit',
      amount: amount || 0,
      status: 'pending',
      depositor_name: depositorName || null,
      sender_number: senderNumber || null,
      transaction_id: transactionId || null,
      account_name: accountName || null,
      account_number: accountNumber || null,
      account_type: accountType || null
    });

    if (error) {
      console.error('Currency request error:', error);
      return res.status(500).json({ error: 'Failed to submit request' });
    }

    return res.json({ ok: true, id });
  }

  return res.status(405).send('Method not allowed');
});
