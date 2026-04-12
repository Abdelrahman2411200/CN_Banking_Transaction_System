// src/routes/auth.js
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const { v4: uuidv4 } = require('uuid');
const redis   = require('../redis');
const { JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL } = require('../config');
const { logger } = require('../logger');
const { authAttemptsTotal } = require('../metrics');
const { loginLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Helper: SHA-256 hash of a token string
const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

// Helper: generate access token
const generateAccessToken = ({ userId, email, role }) =>
  jwt.sign({ sub: userId, email, role }, JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_TTL,
  });

// Helper: generate refresh token
const generateRefreshToken = (userId) =>
  jwt.sign({ sub: userId }, JWT_REFRESH_SECRET, {
    algorithm: 'HS256',
    expiresIn: REFRESH_TOKEN_TTL,
  });

// POST /v1/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, role = 'customer' } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'email_and_password_required' });

    if (!['customer', 'admin'].includes(role))
      return res.status(400).json({ error: 'invalid_role' });

    // Check for duplicate email
    const existingId = await redis.get(`auth:email:${email}`);
    if (existingId)
      return res.status(409).json({ error: 'email_already_registered' });

    const userId       = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);

    await redis.set(`auth:user:${userId}`, JSON.stringify({ userId, email, passwordHash, role }));
    await redis.set(`auth:email:${email}`, userId);

    return res.status(201).json({ userId, email, role });
  } catch (err) {
    logger.error('register failed', { error: err instanceof Error ? err.message : String(err) });
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /v1/auth/login  (rate-limited)
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    const userId = await redis.get(`auth:email:${email}`);
    if (!userId) {
      authAttemptsTotal.inc({ outcome: 'failure' });
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    const raw  = await redis.get(`auth:user:${userId}`);
    const user = JSON.parse(raw);

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      authAttemptsTotal.inc({ outcome: 'failure' });
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user.userId);

    // Store refresh token hash with TTL
    await redis.set(
      `auth:refresh:${hashToken(refreshToken)}`,
      user.userId,
      'EX',
      REFRESH_TOKEN_TTL
    );

    authAttemptsTotal.inc({ outcome: 'success' });
    return res.status(200).json({ accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL });
  } catch (err) {
    logger.error('login failed', { error: err instanceof Error ? err.message : String(err) });
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /v1/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(400).json({ error: 'refresh_token_required' });

    // Check Redis first
    const userId = await redis.get(`auth:refresh:${hashToken(refreshToken)}`);
    if (!userId) {
      authAttemptsTotal.inc({ outcome: 'failure' });
      return res.status(401).json({ error: 'invalid_refresh_token' });
    }

    // Verify signature
    jwt.verify(refreshToken, JWT_REFRESH_SECRET);

    const raw  = await redis.get(`auth:user:${userId}`);
    const user = JSON.parse(raw);

    const accessToken = generateAccessToken(user);
    authAttemptsTotal.inc({ outcome: 'success' });
    return res.status(200).json({ accessToken, expiresIn: ACCESS_TOKEN_TTL });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      authAttemptsTotal.inc({ outcome: err.name === 'TokenExpiredError' ? 'expired' : 'failure' });
      return res.status(401).json({ error: 'invalid_refresh_token' });
    }
    logger.error('refresh failed', { error: err instanceof Error ? err.message : String(err) });
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /v1/auth/logout
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const authHeader = req.headers['authorization'] || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (refreshToken)
      await redis.del(`auth:refresh:${hashToken(refreshToken)}`);

    if (accessToken) {
      // Calculate remaining TTL from token exp claim
      const decoded = jwt.decode(accessToken);
      if (decoded?.exp) {
        const remainingTtl = Math.max(decoded.exp - Math.floor(Date.now() / 1000), 1);
        await redis.set(`auth:blacklist:${hashToken(accessToken)}`, '1', 'EX', remainingTtl);
      }
    }

    return res.status(204).send();
  } catch (err) {
    logger.error('logout failed', { error: err instanceof Error ? err.message : String(err) });
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
