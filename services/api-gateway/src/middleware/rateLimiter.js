// src/middleware/rateLimiter.js
const rateLimit  = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const redis      = require('../redis');
const { rateLimitHitsTotal } = require('../metrics');

const rateLimitHandler = (req, res, options) => {
  rateLimitHitsTotal.inc({ limit_type: options.identifier || 'unknown' });
  res.status(429).json({
    error:      'rate_limit_exceeded',
    retryAfter: Math.ceil(options.windowMs / 1000),
    limit:      options.max,
    remaining:  0,
  });
};

const makeStore = (prefix) =>
  new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix,
  });

const globalLimiter = rateLimit({
  identifier:      'global',
  windowMs:       60_000,
  max:            200,
  keyGenerator:   (req) => req.ip,
  handler:        rateLimitHandler,
  standardHeaders: true,
  legacyHeaders:  false,
  store:          makeStore('ratelimit:global:'),
});

const loginLimiter = rateLimit({
  identifier:      'login',
  windowMs:       60_000,
  max:            10,
  keyGenerator:   (req) => req.ip,
  handler:        rateLimitHandler,
  standardHeaders: true,
  legacyHeaders:  false,
  store:          makeStore('ratelimit:login:'),
});

const transferLimiter = rateLimit({
  identifier:      'transfer',
  windowMs:       60_000,
  max:            20,
  keyGenerator:   (req) => req.user?.sub || req.ip,
  handler:        rateLimitHandler,
  standardHeaders: true,
  legacyHeaders:  false,
  store:          makeStore('ratelimit:transfer:'),
});

const sensitiveLimiter = rateLimit({
  identifier:      'sensitive',
  windowMs:       60_000,
  max:            10,
  keyGenerator:   (req) => req.user?.sub || req.ip,
  handler:        rateLimitHandler,
  standardHeaders: true,
  legacyHeaders:  false,
  store:          makeStore('ratelimit:sensitive:'),
});

const accountLimiter = rateLimit({
  identifier:      'account',
  windowMs:       60_000,
  max:            50,
  keyGenerator:   (req) => req.user?.sub || req.ip,
  handler:        rateLimitHandler,
  standardHeaders: true,
  legacyHeaders:  false,
  store:          makeStore('ratelimit:account:'),
});

module.exports = { globalLimiter, loginLimiter, transferLimiter, accountLimiter, sensitiveLimiter };
