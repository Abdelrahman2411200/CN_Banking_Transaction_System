import express from 'express';
import { initDb, getCollection } from './db';
import { LedgerConsumer } from './consumer';

const app = express();
const PORT = process.env.LEDGER_SERVICE_PORT || 3003;
const KAFKA_BROKERS = [process.env.KAFKA_BROKERS || 'localhost:9092'];

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ success: true, data: { status: 'ok' } });
});

// GET /ledger/account/:id - Get ledger entries for an account
app.get('/v1/ledger/account/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const entries = await getCollection('ledger')
      .find({ accountId: id })
      .sort({ timestamp: -1 })
      .toArray();

    res.status(200).json({ success: true, data: entries });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

async function start() {
  await initDb();
  
  const consumer = new LedgerConsumer(KAFKA_BROKERS);
  await consumer.connect();
  await consumer.subscribe(['bank.account.created', 'bank.transfer.completed']);
  await consumer.run();

  app.listen(PORT, () => {
    console.log(`Ledger Service listening on port ${PORT}`);
  });
}

start().catch(console.error);
