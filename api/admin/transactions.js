import { adminMiddleware } from '../../_lib/auth.js';

export default adminMiddleware(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  
  res.json({ transactions: [] });
});
