// src/middleware/idempotency.js
const redis = require('../redis');

const IDEMPOTENCY_TTL = 24 * 60 * 60; // 24 hours in seconds

async function idempotency(req, res, next) {
  const key = req.headers['idempotency-key'];

  if (!key) {
    return res.status(400).json({ error: 'idempotency_key_required' });
  }

  const redisKey = `idempotency:${req.user?.sub || 'anonymous'}:${req.method}:${req.originalUrl}:${key}`;
  const cached = await redis.get(redisKey);

  if (cached) {
    const { status, body, contentType } = JSON.parse(cached);
    res.set('Idempotency-Status', 'hit');
    if (contentType) {
      res.set('Content-Type', contentType);
    }
    return res.status(status).send(body);
  }

  res.set('Idempotency-Status', 'miss');
  req.idempotency = { redisKey };

  return next();
}

idempotency.cacheProxyResponse = async function cacheProxyResponse(req, proxyRes, responseBuffer) {
  if (!req.idempotency?.redisKey) {
    return;
  }

  const status = proxyRes.statusCode || 200;
  if (status >= 500) {
    return;
  }

  await redis.set(
    req.idempotency.redisKey,
    JSON.stringify({
      status,
      contentType: proxyRes.headers['content-type'],
      body: responseBuffer.toString('utf8'),
    }),
    'EX',
    IDEMPOTENCY_TTL
  );
};

module.exports = idempotency;
