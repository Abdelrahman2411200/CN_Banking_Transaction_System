// src/index.js
const express = require('express');
const { PORT, SERVICES } = require('./config');
const { logger, requestLogger } = require('./logger');
const { metricsMiddleware, metricsHandler } = require('./metrics');

const securityHeaders  = require('./middleware/securityHeaders');
const authMiddleware   = require('./middleware/auth');
const {
  globalLimiter,
  accountLimiter,
  transferLimiter,
  sensitiveLimiter,
} = require('./middleware/rateLimiter');
const idempotency      = require('./middleware/idempotency');
const authRoutes       = require('./routes/auth');
const {
  accountProxy, transferProxy, ledgerProxy, fraudProxy, notificationProxy,
} = require('./proxy');

const app = express();


// 1. Security headers + request ID on every response
app.use(securityHeaders);
app.use(requestLogger);
app.use(metricsMiddleware);
app.get('/metrics', metricsHandler);

// 2. Global IP rate limiter
app.use(globalLimiter);

// 3. Health — no auth
async function healthHandler(req, res) {
  const checks = await Promise.allSettled(
    Object.entries(SERVICES).map(([name, url]) =>
      fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) })
        .then((r) => ({ name, status: r.ok ? 'ok' : 'degraded' }))
        .catch(() => ({ name, status: 'unreachable' }))
    )
  );

  const services = Object.fromEntries(
    checks.map((c) => [c.value.name, c.value.status])
  );

  const allOk = Object.values(services).every((s) => s === 'ok');

  res.status(allOk ? 200 : 207).json({
    status: allOk ? 'ok' : 'degraded',
    services,
  });
}

app.get('/health', healthHandler);

// 4. Auth routes — no JWT auth required here
app.use('/v1/auth', express.json(), authRoutes);

// 5. Role guard helper
const adminOnly = (req, res, next) =>
  req.user?.role === 'admin'
    ? next()
    : res.status(403).json({ error: 'forbidden' });

// 6. Proxied routes — auth required on all
app.post('/v1/accounts/:id/freeze', authMiddleware, sensitiveLimiter, accountProxy);
app.use('/v1/accounts', authMiddleware, accountLimiter, accountProxy);

// Transfers: idempotency + per-user rate limit on POST only
app.post('/v1/transfers', authMiddleware, transferLimiter, idempotency, transferProxy);
app.use('/v1/transfers',  authMiddleware, transferProxy);

// Ledger: admin-only for /stats, open to any authenticated user otherwise
app.use('/v1/ledger/stats', authMiddleware, adminOnly, ledgerProxy);
app.use('/v1/ledger',       authMiddleware, ledgerProxy);

// Admin-only routes
app.use('/v1/fraud',         authMiddleware, adminOnly, sensitiveLimiter, fraudProxy);
app.use('/v1/notifications', authMiddleware, adminOnly, sensitiveLimiter, notificationProxy);

// 7. 404 fallback
app.use((req, res) => res.status(404).json({ error: 'not_found' }));

app.listen(PORT, () => logger.info('gateway listening', { port: PORT }));
