import type { Server } from 'node:http';
import express from 'express';
import type { Request, Response } from 'express';
import { pool } from './db';
import { logger, requestLogger } from './logger';
import { dbPoolActiveConnections, metricsHandler, metricsMiddleware } from './metrics';
import { startOutboxPublisher, stopOutboxPublisher } from './outbox';
import { router } from './routes';
import { initKafka } from './kafka';

void initKafka();

const app = express();
const PORT = Number(process.env.TRANSFER_SERVICE_PORT || 3002);

app.use(express.json({ limit: '100kb' }));
app.use(requestLogger);
app.use(metricsMiddleware);
app.get('/metrics', metricsHandler);

const dbPoolTimer = setInterval(() => {
  dbPoolActiveConnections.set(pool.totalCount - pool.idleCount);
}, 5000);
dbPoolTimer.unref();

app.use('/v1', router);

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: { status: 'ok' },
  });
});

const startServer = (): Server =>
  app.listen(PORT, () => {
    logger.info('transfer-service listening', { port: PORT });
  });

const shutdown = (server: Server, signal: string): void => {
  logger.info('shutdown signal received', { signal });

  server.close(async (closeError?: Error) => {
    if (closeError) {
      logger.error('error closing HTTP server', { error: closeError.message });
      process.exit(1);
      return;
    }

    try {
      await stopOutboxPublisher();
      await pool.end();
      logger.info('HTTP server closed');
      process.exit(0);
    } catch (poolError) {
      logger.error('error closing database pool', { error: poolError instanceof Error ? poolError.message : String(poolError) });
      process.exit(1);
    }
  });
};

if (require.main === module) {
  void startOutboxPublisher(pool)
    .then(() => {
      const server = startServer();
      process.on('SIGTERM', () => {
        void shutdown(server, 'SIGTERM');
      });
      process.on('SIGINT', () => {
        void shutdown(server, 'SIGINT');
      });
    })
    .catch((error: unknown) => {
      logger.error('failed to start transfer-service outbox publisher', {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    });
}

export { app, startServer };
