import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { KafkaTopics } from '@cn-banking/shared-types';
import { startNotificationConsumer, stopNotificationConsumer } from './consumer';

const app = express();
const PORT = Number(process.env.NOTIFICATION_SERVICE_PORT || 3005);

app.use(express.json({ limit: '100kb' }));
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = req.header('x-request-id') || randomUUID();
  res.setHeader('x-request-id', requestId);
  next();
});

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
    console.log(`Notification Service listening on port ${PORT}`);
  });

const shutdown = (server: Server, signal: string): void => {
  console.log(`${signal} received, shutting down notification-service`);
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
      console.error('Failed to bootstrap notification-service', error);
      process.exit(1);
    });
}

export { app, startServer };
