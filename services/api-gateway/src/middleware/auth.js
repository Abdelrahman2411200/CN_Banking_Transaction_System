// src/middleware/auth.js
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const redis  = require('../redis');
const { JWT_ACCESS_SECRET } = require('../config');

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

module.exports = async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader)
    return res.status(401).json({ error: 'missing_token' });

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const token = authHeader.slice(7);

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_ACCESS_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'token_expired' });
    return res.status(401).json({ error: 'invalid_token' });
  }

  // Check blacklist
  const blacklisted = await redis.exists(`auth:blacklist:${hashToken(token)}`);
  if (blacklisted)
    return res.status(401).json({ error: 'token_revoked' });

  // Attach user + forward headers
  req.user = decoded;
  req.headers['x-user-id']   = decoded.sub;
  req.headers['x-user-role'] = decoded.role;

  next();
};
