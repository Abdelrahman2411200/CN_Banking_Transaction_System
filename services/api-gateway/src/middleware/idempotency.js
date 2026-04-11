// src/middleware/idempotency.js
const redis = require('../redis');

const IDEMPOTENCY_TTL = 24 * 60 * 60; // 24 hours in seconds

module.exports = async function idempotency(req, res, next) {
  const key = req.headers['idempotency-key'];

  if (!key)
    return res.status(400).json({ error: 'idempotency_key_required' });

  const redisKey = `idempotency:${key}`;
  const cached   = await redis.get(redisKey);

  if (cached) {
    const { status, body } = JSON.parse(cached);
    res.set('Idempotency-Status', 'hit');
    return res.status(status).json(body);
  }

  // Cache miss — intercept the response from the proxied service
  res.set('Idempotency-Status', 'miss');

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    // Store in Redis before sending to client
    redis.set(
      redisKey,
      JSON.stringify({ status: res.statusCode, body }),
      'EX',
      IDEMPOTENCY_TTL
    ).catch((err) => console.error('[idempotency] redis write error:', err));

    return originalJson(body);
  };

  next();
};
