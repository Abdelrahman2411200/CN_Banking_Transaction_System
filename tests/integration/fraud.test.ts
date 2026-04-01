import { randomUUID } from 'node:crypto';
import axios from 'axios';
import { Kafka } from 'kafkajs';
import { MongoClient } from 'mongodb';
import { KafkaTopics, type FraudAlertEvent, type TransferInitiatedEvent } from '@cn-banking/shared-types';
import { resolveKafkaBrokers, resolveMongoUri, resolveServiceUrl, waitUntil } from './phase2.helpers';

jest.setTimeout(20000);

const brokers = resolveKafkaBrokers(process.env.KAFKA_BROKERS);
const kafka = new Kafka({
  clientId: 'phase2-fraud-tests',
  brokers,
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: `phase2-fraud-tests-${Date.now()}` });
const mongoClient = new MongoClient(resolveMongoUri(process.env.MONGODB_URI));
const accountServiceUrl = resolveServiceUrl(
  process.env.ACCOUNT_SERVICE_URL,
  'http://account-service:3001',
  'http://localhost:3001'
);

let seenAlerts: FraudAlertEvent[] = [];

const createAccount = async (name: string, balance: string): Promise<string> => {
  const response = await axios.post(`${accountServiceUrl}/v1/accounts`, {
    name,
    email: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}@test.com`,
    initial_balance: balance,
  });

  return response.data.data.id as string;
};

const buildTransferEvent = (
  overrides: Partial<TransferInitiatedEvent> = {}
): TransferInitiatedEvent => ({
  eventId: overrides.eventId || randomUUID(),
  eventType: KafkaTopics.transferInitiated,
  timestamp: new Date().toISOString(),
  version: 'v1',
  transferId: overrides.transferId || randomUUID(),
  fromAccountId: overrides.fromAccountId || randomUUID(),
  toAccountId: overrides.toAccountId || randomUUID(),
  amount: overrides.amount || '100.00',
});

beforeAll(async () => {
  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: KafkaTopics.fraudAlert, fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ message }) => {
      const value = message.value?.toString();
      if (!value) {
        return;
      }

      seenAlerts.push(JSON.parse(value) as FraudAlertEvent);
    },
  });
  await mongoClient.connect();
});

afterAll(async () => {
  await producer.disconnect();
  await consumer.disconnect();
  await mongoClient.close();
});

beforeEach(async () => {
  seenAlerts = [];
  await mongoClient.db('banking_events').collection('fraud_events').deleteMany({});
  await mongoClient.db('banking_events').collection('transfer_activity').deleteMany({});
});

describe('fraud integration', () => {
  it('produces a FraudAlertEvent for a large transfer', async () => {
    const fromAccountId = await createAccount('Fraud Sender', '50000.00');

    const event = buildTransferEvent({
      eventId: '123e4567-e89b-12d3-a456-426614174200',
      transferId: '123e4567-e89b-12d3-a456-426614174201',
      fromAccountId,
      toAccountId: '123e4567-e89b-12d3-a456-426614174203',
      amount: '15000.00',
    });

    await producer.send({
      topic: KafkaTopics.transferInitiated,
      messages: [{ key: event.transferId, value: JSON.stringify(event) }],
    });

    await waitUntil(
      async () =>
        seenAlerts.some(
          (alert) => alert.transferId === event.transferId && alert.ruleTriggered === 'large_transfer'
        ),
      8000,
      300
    );

    expect(
      seenAlerts.some(
        (alert) => alert.transferId === event.transferId && alert.ruleTriggered === 'large_transfer'
      )
    ).toBe(true);
  });

  it('freezes the account when the rapid drain rule triggers a critical alert', async () => {
    const fromAccountId = await createAccount('Rapid Drain Sender', '1000.00');

    const event = buildTransferEvent({
      eventId: '123e4567-e89b-12d3-a456-426614174210',
      transferId: '123e4567-e89b-12d3-a456-426614174211',
      fromAccountId,
      toAccountId: '123e4567-e89b-12d3-a456-426614174212',
      amount: '900.00',
    });

    await producer.send({
      topic: KafkaTopics.transferInitiated,
      messages: [{ key: event.transferId, value: JSON.stringify(event) }],
    });

    await waitUntil(
      async () =>
        seenAlerts.some(
          (alert) =>
            alert.transferId === event.transferId &&
            alert.ruleTriggered === 'rapid_drain' &&
            alert.severity === 'critical'
        ),
      8000,
      300
    );

    await waitUntil(async () => {
      const response = await axios.get(`${accountServiceUrl}/v1/accounts/${fromAccountId}`);
      return response.data.data.status === 'suspended';
    }, 8000, 300);

    const accountResponse = await axios.get(`${accountServiceUrl}/v1/accounts/${fromAccountId}`);
    expect(accountResponse.data.data.status).toBe('suspended');
  });
});

