import type { NextFunction, Request, Response } from 'express';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

const registry = new Registry();

collectDefaultMetrics({ register: registry });

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [registry],
});

const httpRequestDurationMs = new Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'route'] as const,
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

export const transfersInitiatedTotal = new Counter({
  name: 'transfers_initiated_total',
  help: 'Transfers by terminal outcome',
  labelNames: ['status'] as const,
  registers: [registry],
});

export const transferAmountUsd = new Histogram({
  name: 'transfer_amount_usd',
  help: 'Observed transfer amounts in USD',
  buckets: [0, 100, 1000, 10000, 100000],
  registers: [registry],
});

export const sagaCompensationsTotal = new Counter({
  name: 'saga_compensations_total',
  help: 'SAGA compensation attempts',
  registers: [registry],
});

export const dbPoolActiveConnections = new Gauge({
  name: 'db_pool_active_connections',
  help: 'Active PostgreSQL pool connections',
  registers: [registry],
});

let expected = Date.now() + 1000;
const eventLoopTimer = setInterval(() => {
  const now = Date.now();
  nodejsEventloopLagMs.set(Math.max(now - expected, 0));
  expected = now + 1000;
}, 1000);
eventLoopTimer.unref();

const routeName = (req: Request): string => {
  const route = req.route as { path?: unknown } | undefined;
  const routePath = typeof route?.path === 'string' ? route.path : req.path;
  return `${req.baseUrl || ''}${routePath || ''}` || req.originalUrl || req.path;
};

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
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

export const metricsHandler = async (_req: Request, res: Response): Promise<void> => {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
};

export { registry };
