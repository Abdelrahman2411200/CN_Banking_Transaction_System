// src/middleware/rateLimiter.js
const rateLimit  = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const redis      = require('../redis');

const rateLimitHandler = (req, res, options) => {
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
  windowMs:       60_000,
  max:            200,
  keyGenerator:   (req) => req.ip,
  handler:        rateLimitHandler,
  standardHeaders: true,
  legacyHeaders:  false,
  store:          makeStore('ratelimit:global:'),
});

const loginLimiter = rateLimit({
  windowMs:       60_000,
  max:            10,
  keyGenerator:   (req) => req.ip,
  handler:        rateLimitHandler,
  standardHeaders: true,
  legacyHeaders:  false,
  store:          makeStore('ratelimit:login:'),
});

const transferLimiter = rateLimit({
  windowMs:       60_000,
  max:            20,
  keyGenerator:   (req) => req.user?.sub || req.ip,
  handler:        rateLimitHandler,
  standardHeaders: true,
  legacyHeaders:  false,
  store:          makeStore('ratelimit:transfer:'),
});

const accountLimiter = rateLimit({
  windowMs:       60_000,
  max:            50,
  keyGenerator:   (req) => req.user?.sub || req.ip,
  handler:        rateLimitHandler,
  standardHeaders: true,
  legacyHeaders:  false,
  store:          makeStore('ratelimit:account:'),
});

module.exports = { globalLimiter, loginLimiter, transferLimiter, accountLimiter };
