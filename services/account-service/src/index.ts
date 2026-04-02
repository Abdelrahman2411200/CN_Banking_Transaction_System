import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { pool } from './db';
import { startOutboxPublisher, stopOutboxPublisher } from './outbox';
import { router } from './routes';
import { initKafka } from './kafka';

initKafka();

const app = express();
const PORT = Number(process.env.ACCOUNT_SERVICE_PORT || 3001);

app.use(express.json({ limit: '100kb' }));

app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = req.header('x-request-id') || randomUUID();
  const startedAt = Date.now();

  res.setHeader('x-request-id', requestId);
  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    console.info(`[account-service] ${requestId} ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
  });

  next();
});

app.use('/v1', router);

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: { status: 'ok' },
  });
});

const startServer = (): Server =>
  app.listen(PORT, () => {
    console.log(`Account Service listening on port ${PORT}`);
  });

const shutdown = (server: Server, signal: string): void => {
  console.log(`${signal} signal received: closing HTTP server`);

  server.close(async (closeError?: Error) => {
    if (closeError) {
      console.error('Error closing HTTP server', closeError);
      process.exit(1);
      return;
    }

    try {
      await stopOutboxPublisher();
      await pool.end();
      console.log('HTTP server closed');
      process.exit(0);
    } catch (poolError) {
      console.error('Error closing database pool', poolError);
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
      console.error('Failed to start account-service outbox publisher', error);
      process.exit(1);
    });
}

export { app, startServer };
