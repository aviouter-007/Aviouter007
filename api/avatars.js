export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const avatars = [
    'plane-red', 'plane-blue', 'plane-green', 'plane-gold',
    'plane-purple', 'plane-orange', 'plane-cyan', 'plane-pink'
  ];

  res.json(avatars.map(id => ({ id, name: id })));
}
