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

export const ledgerEntriesWrittenTotal = new Counter({
  name: 'ledger_entries_written_total',
  help: 'Ledger entries written by entry type',
  labelNames: ['entry_type'] as const,
  registers: [registry],
});

export const kafkaConsumerLag = new Gauge({
  name: 'kafka_consumer_lag',
  help: 'Kafka consumer lag by topic and partition',
  labelNames: ['topic', 'partition'] as const,
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
