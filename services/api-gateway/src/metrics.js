const { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } = require('prom-client');

const registry = new Registry();

collectDefaultMetrics({ register: registry });

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

const httpRequestDurationMs = new Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'route'],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
  registers: [registry],
});

const httpRequestsInFlight = new Gauge({
  name: 'http_requests_in_flight',
  help: 'HTTP requests currently in flight',
  registers: [registry],
});

const nodejsEventloopLagMs = new Gauge({
  name: 'nodejs_eventloop_lag_ms',
  help: 'Node.js event loop lag in milliseconds',
  registers: [registry],
});

const authAttemptsTotal = new Counter({
  name: 'auth_attempts_total',
  help: 'Authentication attempts by outcome',
  labelNames: ['outcome'],
  registers: [registry],
});

const rateLimitHitsTotal = new Counter({
  name: 'rate_limit_hits_total',
  help: 'Rate limit rejections by limiter type',
  labelNames: ['limit_type'],
  registers: [registry],
});

const idempotencyCacheHitsTotal = new Counter({
  name: 'idempotency_cache_hits_total',
  help: 'Idempotency cache hits served by the gateway',
  registers: [registry],
});

let expected = Date.now() + 1000;
const eventLoopTimer = setInterval(() => {
  const now = Date.now();
  nodejsEventloopLagMs.set(Math.max(now - expected, 0));
  expected = now + 1000;
}, 1000);
eventLoopTimer.unref?.();

const routeName = (req) => {
  const routePath = req.route?.path ? String(req.route.path) : req.path;
  return `${req.baseUrl || ''}${routePath || ''}` || req.originalUrl || req.path;
};

const metricsMiddleware = (req, res, next) => {
  httpRequestsInFlight.inc();
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const route = routeName(req);

    httpRequestsInFlight.dec();
    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: String(res.statusCode),
    });
    httpRequestDurationMs.observe({ method: req.method, route }, durationMs);
  });

  next();
};

const metricsHandler = async (_req, res) => {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
};

module.exports = {
  registry,
  metricsMiddleware,
  metricsHandler,
  authAttemptsTotal,
  rateLimitHitsTotal,
  idempotencyCacheHitsTotal,
};
