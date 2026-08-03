const jwt = require('jsonwebtoken');

module.exports = function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'admin') throw new Error('not admin');
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
};
