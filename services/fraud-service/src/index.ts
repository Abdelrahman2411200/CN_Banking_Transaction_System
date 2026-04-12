import type { Server } from 'node:http';
import express from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { logger, requestLogger } from './logger';
import { metricsHandler, metricsMiddleware } from './metrics';
import { closeMongo, connectMongo, getDatabase } from './mongo';
import { startFraudConsumer, stopFraudConsumer, type FraudEventDocument } from './consumer';

const app = express();
const PORT = Number(process.env.FRAUD_SERVICE_PORT || 3004);

const alertParamsSchema = z.object({ alertId: z.string().uuid() });
const alertsQuerySchema = z.object({
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  accountId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

app.use(express.json({ limit: '100kb' }));
app.use(requestLogger);
app.use(metricsMiddleware);
app.get('/metrics', metricsHandler);

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { status: 'ok' } });
});

app.get('/v1/fraud/alerts', async (req: Request, res: Response) => {
  const query = alertsQuerySchema.safeParse(req.query);
  if (!query.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid alert query' },
    });
  }

  const { severity, accountId, from, to, page, limit } = query.data;
  const filter: Record<string, unknown> = {};

  if (severity) {
    filter.severity = severity;
  }

  if (accountId) {
    filter.fromAccountId = accountId;
  }

  if (from || to) {
    filter.createdAt = {};
    if (from) {
      (filter.createdAt as Record<string, unknown>).$gte = new Date(from);
    }
    if (to) {
      (filter.createdAt as Record<string, unknown>).$lte = new Date(to);
    }
  }

  const alerts = await getDatabase()
    .collection<FraudEventDocument>('fraud_events')
    .find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  return res.status(200).json({ success: true, data: alerts });
});

app.get('/v1/fraud/alerts/:alertId', async (req: Request, res: Response) => {
  const params = alertParamsSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid alert id' },
    });
  }

  const alert = await getDatabase()
    .collection<FraudEventDocument>('fraud_events')
    .findOne({ alertId: params.data.alertId });

  if (!alert) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Fraud alert not found' },
    });
  }

  return res.status(200).json({ success: true, data: alert });
});

app.get('/v1/fraud/stats', async (_req: Request, res: Response) => {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);

  const [today, thisWeek] = await Promise.all([
    getDatabase()
      .collection<FraudEventDocument>('fraud_events')
      .aggregate([
        { $match: { createdAt: { $gte: todayStart } } },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ])
      .toArray(),
    getDatabase()
      .collection<FraudEventDocument>('fraud_events')
      .aggregate([
        { $match: { createdAt: { $gte: weekStart } } },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ])
      .toArray(),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      today,
      thisWeek,
    },
  });
});

const startServer = (): Server =>
  app.listen(PORT, () => {
    logger.info('fraud-service listening', { port: PORT });
  });

const shutdown = (server: Server, signal: string): void => {
  logger.info('shutdown signal received', { signal });
  server.close(async () => {
    await stopFraudConsumer();
    await closeMongo();
    process.exit(0);
  });
};

if (require.main === module) {
  void connectMongo()
    .then(async () => {
      await startFraudConsumer();
      const server = startServer();
      process.on('SIGTERM', () => shutdown(server, 'SIGTERM'));
      process.on('SIGINT', () => shutdown(server, 'SIGINT'));
    })
    .catch((error: unknown) => {
      logger.error('failed to bootstrap fraud-service', {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    });
}

export { app, startServer };
