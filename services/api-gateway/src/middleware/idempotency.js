// src/middleware/idempotency.js
const redis = require('../redis');
const { idempotencyCacheHitsTotal } = require('../metrics');

const IDEMPOTENCY_TTL = 24 * 60 * 60; // 24 hours in seconds
const LOCK_TTL = 30; // seconds — max time an in-flight request holds the lock

async function idempotency(req, res, next) {
  const key = req.headers['idempotency-key'];

  if (!key) {
    return res.status(400).json({ error: 'idempotency_key_required' });
  }

  const userId  = req.user?.sub || 'anonymous';
  const redisKey = `idempotency:${userId}:${req.method}:${req.originalUrl}:${key}`;
  const lockKey  = `idempotency:lock:${userId}:${req.method}:${req.originalUrl}:${key}`;

  // Return cached terminal response for already-completed requests
  const cached = await redis.get(redisKey);
  if (cached) {
    const { status, body, contentType } = JSON.parse(cached);
    idempotencyCacheHitsTotal.inc();
    res.set('Idempotency-Status', 'hit');
    if (contentType) res.set('Content-Type', contentType);
    return res.status(status).send(body);
  }

  // Acquire an in-flight lock atomically (SET NX) to prevent concurrent duplicate processing
  const acquired = await redis.set(lockKey, '1', 'NX', 'EX', LOCK_TTL);
  if (!acquired) {
    return res.status(409).json({ error: 'duplicate_request_in_flight' });
  }

  res.set('Idempotency-Status', 'miss');
  req.idempotency = { redisKey, lockKey };

  return next();
}

idempotency.cacheProxyResponse = async function cacheProxyResponse(req, proxyRes, responseBuffer) {
  if (!req.idempotency?.redisKey) {
    return;
  }

  const status = proxyRes.statusCode || 200;
  if (status >= 500) {
    // Release lock on server errors so the caller may retry; don't cache
    if (req.idempotency.lockKey) await redis.del(req.idempotency.lockKey);
    return;
  }

  // Atomically cache the terminal response and release the in-flight lock
  const pipeline = redis.pipeline();
  pipeline.set(
    req.idempotency.redisKey,
    JSON.stringify({
      status,
      contentType: proxyRes.headers['content-type'],
      body: responseBuffer.toString('utf8'),
    }),
    'EX',
    IDEMPOTENCY_TTL
  );
  pipeline.del(req.idempotency.lockKey);
  await pipeline.exec();
};

module.exports = idempotency;
