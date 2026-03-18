import express from 'express';
import { NotificationConsumer } from './consumer';

const app = express();
const PORT = process.env.NOTIFICATION_SERVICE_PORT || 3005;
const KAFKA_BROKERS = [process.env.KAFKA_BROKERS || 'localhost:9092'];

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ success: true, data: { status: 'ok' } });
});

async function start() {
  const consumer = new NotificationConsumer(KAFKA_BROKERS);
  await consumer.connect();
  await consumer.subscribe([
    'bank.account.created',
    'bank.transfer.initiated',
    'bank.transfer.completed',
    'bank.transfer.failed',
    'bank.fraud.alert'
  ]);
  await consumer.run();

  app.listen(PORT, () => {
    console.log(`Notification Service listening on port ${PORT}`);
  });
}

start().catch(console.error);
