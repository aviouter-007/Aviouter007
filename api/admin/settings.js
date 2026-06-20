import { adminMiddleware } from '../_lib/auth.js';

export default adminMiddleware(async function handler(req, res) {
  if (req.method === 'GET') {
    return res.json({
      settings: {
        siteName: "Aviouter",
        maintenance: false,
        minDeposit: 10,
        minWithdraw: 50
      }
    });
  }

  if (req.method === 'PATCH') {
    // Mock save settings success
    return res.json({ ok: true });
  }

  return res.status(405).send('Method not allowed');
});
