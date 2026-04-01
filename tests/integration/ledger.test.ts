import { Buffer } from 'node:buffer';
import { Kafka } from 'kafkajs';
import { MongoClient } from 'mongodb';
import { connectMongo, closeMongo, getDatabase } from '../../services/ledger-service/src/mongo';
import { ensureLedgerIndexes, processLedgerEvent } from '../../services/ledger-service/src/consumer';
import { KafkaTopics, type TransferCompletedEvent } from '@cn-banking/shared-types';
import { resolveKafkaBrokers, resolveMongoUri, waitUntil } from './phase2.helpers';

jest.setTimeout(20000);

const kafka = new Kafka({
  clientId: 'phase2-ledger-tests',
  brokers: resolveKafkaBrokers(process.env.KAFKA_BROKERS),
});

const producer = kafka.producer();
const mongoUri = resolveMongoUri(process.env.MONGODB_URI);
const mongoClient = new MongoClient(mongoUri);

const buildCompletedEvent = (transferId: string): TransferCompletedEvent => ({
  eventId: '123e4567-e89b-12d3-a456-426614174100',
  eventType: KafkaTopics.transferCompleted,
  timestamp: '2025-01-01T00:00:00.000Z',
  version: 'v1',
  transferId,
  fromAccountId: '123e4567-e89b-12d3-a456-426614174101',
  toAccountId: '123e4567-e89b-12d3-a456-426614174102',
  amount: '250.00',
  completedAt: '2025-01-01T00:00:01.000Z',
});

beforeAll(async () => {
  await producer.connect();
  await mongoClient.connect();
  await connectMongo();
  await ensureLedgerIndexes();
});

afterAll(async () => {
  await producer.disconnect();
  await mongoClient.close();
  await closeMongo();
});

beforeEach(async () => {
  await mongoClient.db('banking_events').collection('ledger_entries').deleteMany({});
  await getDatabase().collection('ledger_entries').deleteMany({});
});

describe('ledger integration', () => {
  it('creates two ledger entries for a completed transfer event', async () => {
    const transferId = '123e4567-e89b-12d3-a456-426614174110';
    const event = buildCompletedEvent(transferId);

    await producer.send({
      topic: KafkaTopics.transferCompleted,
      messages: [{ key: transferId, value: JSON.stringify(event) }],
    });

    const collection = mongoClient.db('banking_events').collection('ledger_entries');

    await waitUntil(async () => (await collection.countDocuments({ transferId })) === 2, 8000, 300);

    const entries = await collection.find({ transferId }).sort({ entryType: 1 }).toArray();

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.entryType).sort()).toEqual(['credit', 'debit']);
    expect(entries.every((entry) => entry.amount.toString() === '250.00')).toBe(true);
  });

  it('keeps only one pair of entries when the same ledger message is processed twice', async () => {
    const collection = getDatabase().collection('ledger_entries');
    const transferId = '123e4567-e89b-12d3-a456-426614174120';
    const event = buildCompletedEvent(transferId);

    const payload = {
      topic: KafkaTopics.transferCompleted,
      partition: 0,
      message: {
        offset: '99',
        value: Buffer.from(JSON.stringify(event)),
      },
    };

    await processLedgerEvent(payload as never);
    await processLedgerEvent(payload as never);

    expect(await collection.countDocuments({ transferId })).toBe(2);
  });
});
