import type { Server } from 'node:http';
import express from 'express';
import type { Request, Response } from 'express';
import { KafkaTopics } from '@cn-banking/shared-types';
import { logger, requestLogger } from './logger';
import { metricsHandler, metricsMiddleware } from './metrics';
import { startNotificationConsumer, stopNotificationConsumer } from './consumer';

const app = express();
const PORT = Number(process.env.NOTIFICATION_SERVICE_PORT || 3005);

app.use(express.json({ limit: '100kb' }));
app.use(requestLogger);
app.use(metricsMiddleware);
app.get('/metrics', metricsHandler);

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { status: 'ok' } });
});

app.get('/v1/notifications', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      mode: 'event-consumer',
      persistence: 'none',
      channels: ['email', 'sms'],
      subscribedTopics: [
        KafkaTopics.transferCompleted,
        KafkaTopics.transferFailed,
        KafkaTopics.fraudAlert,
      ],
    },
  });
});

const startServer = (): Server =>
  app.listen(PORT, () => {
    logger.info('notification-service listening', { port: PORT });
  });

const shutdown = (server: Server, signal: string): void => {
  logger.info('shutdown signal received', { signal });
  server.close(async () => {
    await stopNotificationConsumer();
    process.exit(0);
  });
};

if (require.main === module) {
  void startNotificationConsumer()
    .then(() => {
      const server = startServer();
      process.on('SIGTERM', () => shutdown(server, 'SIGTERM'));
      process.on('SIGINT', () => shutdown(server, 'SIGINT'));
    })
    .catch((error: unknown) => {
      logger.error('failed to bootstrap notification-service', {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    });
}

export { app, startServer };
