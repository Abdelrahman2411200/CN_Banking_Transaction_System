import express from 'express';
import { KafkaProducer } from '@cn-banking/shared-kafka';
import { FraudConsumer } from './consumer';

const app = express();
const PORT = process.env.FRAUD_SERVICE_PORT || 3004;
const KAFKA_BROKERS = [process.env.KAFKA_BROKERS || 'localhost:9092'];

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ success: true, data: { status: 'ok' } });
});

async function start() {
  const producer = new KafkaProducer('fraud-service-producer', KAFKA_BROKERS);
  await producer.connect();

  const consumer = new FraudConsumer(KAFKA_BROKERS, producer);
  await consumer.connect();
  await consumer.subscribe(['bank.transfer.initiated']);
  await consumer.run();

  app.listen(PORT, () => {
    console.log(`Fraud Service listening on port ${PORT}`);
  });
}

start().catch(console.error);
