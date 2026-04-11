import http from 'node:http';
import https from 'node:https';
import axios from 'axios';
import { Kafka } from 'kafkajs';
import { Pool } from 'pg';
import { KafkaTopics } from '@cn-banking/shared-types';
import type {
  AccountCreatedEvent,
  TransferCompletedEvent,
  TransferInitiatedEvent,
} from '@cn-banking/shared-types';
import { resolveKafkaBrokers, resolveServiceUrl, waitUntil } from './phase2.helpers';

jest.setTimeout(30000);

const ACCOUNT_SERVICE_URL = resolveServiceUrl(
  process.env.ACCOUNT_SERVICE_URL,
  'http://account-service:3001',
  'http://localhost:3001'
);
const TRANSFER_SERVICE_URL = resolveServiceUrl(
  process.env.TRANSFER_SERVICE_URL,
  'http://transfer-service:3002',
  'http://localhost:3002'
);

const resolveDbHost = (host: string | undefined, dockerHost: string): string => {
  if (!host || host === dockerHost) {
    return 'localhost';
  }

  return host;
};

const accountsPool = new Pool({
  host: resolveDbHost(process.env.ACCOUNTS_DB_HOST, 'postgres-accounts'),
  port: Number(process.env.ACCOUNTS_DB_HOST_PORT || process.env.ACCOUNTS_DB_PORT || 5433),
  database: process.env.ACCOUNTS_DB_NAME || 'accounts_db',
  user: process.env.ACCOUNTS_DB_USER || 'accounts_user',
  password: process.env.ACCOUNTS_DB_PASSWORD || 'accounts_pass',
});

const transfersPool = new Pool({
  host: resolveDbHost(process.env.TRANSFERS_DB_HOST, 'postgres-transfers'),
  port: Number(process.env.TRANSFERS_DB_HOST_PORT || process.env.TRANSFERS_DB_PORT || 5434),
  database: process.env.TRANSFERS_DB_NAME || 'transfers_db',
  user: process.env.TRANSFERS_DB_USER || 'transfers_user',
  password: process.env.TRANSFERS_DB_PASSWORD || 'transfers_pass',
});

const httpAgent = new http.Agent({ keepAlive: false });
const httpsAgent = new https.Agent({ keepAlive: false });
const apiClient = axios.create({ httpAgent, httpsAgent });

const kafka = new Kafka({
  clientId: `phase2-event-backbone-tests-${Date.now()}`,
  brokers: resolveKafkaBrokers(process.env.KAFKA_BROKERS),
});

const consumer = kafka.consumer({
  groupId: `phase2-event-backbone-tests-${Date.now()}`,
});

let accountCreatedEvents: AccountCreatedEvent[] = [];
let transferInitiatedEvents: TransferInitiatedEvent[] = [];
let transferCompletedEvents: TransferCompletedEvent[] = [];

const cleanupData = async (): Promise<void> => {
  await transfersPool.query('TRUNCATE outbox_events, transfers CASCADE');
  await accountsPool.query('TRUNCATE outbox_events, accounts CASCADE');
};

const createEmail = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@test.com`;

beforeAll(async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: KafkaTopics.accountCreated, fromBeginning: false });
  await consumer.subscribe({ topic: KafkaTopics.transferInitiated, fromBeginning: false });
  await consumer.subscribe({ topic: KafkaTopics.transferCompleted, fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const payload = message.value?.toString();
      if (!payload) {
        return;
      }

      if (topic === KafkaTopics.accountCreated) {
        accountCreatedEvents.push(JSON.parse(payload) as AccountCreatedEvent);
        return;
      }

      if (topic === KafkaTopics.transferInitiated) {
        transferInitiatedEvents.push(JSON.parse(payload) as TransferInitiatedEvent);
        return;
      }

      if (topic === KafkaTopics.transferCompleted) {
        transferCompletedEvents.push(JSON.parse(payload) as TransferCompletedEvent);
      }
    },
  });
});

beforeEach(async () => {
  accountCreatedEvents = [];
  transferInitiatedEvents = [];
  transferCompletedEvents = [];
  await cleanupData();
});

afterAll(async () => {
  await cleanupData();
  await consumer.disconnect();
  await accountsPool.end();
  await transfersPool.end();
  httpAgent.destroy();
  httpsAgent.destroy();
});

describe('Phase 2 event backbone', () => {
  it('publishes bank.account.created after account creation', async () => {
    const email = createEmail('event-backbone-account');
    const response = await apiClient.post(`${ACCOUNT_SERVICE_URL}/v1/accounts`, {
      name: 'Event Backbone Sender',
      email,
      initial_balance: '1000.00',
    });

    const accountId = response.data.data.id as string;

    await waitUntil(
      async () => accountCreatedEvents.some((event) => event.accountId === accountId),
      10000,
      250
    );

    expect(accountCreatedEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: KafkaTopics.accountCreated,
          accountId,
          email,
          version: 'v1',
        }),
      ])
    );
  });

  it('publishes initiated and completed transfer events for a successful transfer', async () => {
    const senderResponse = await apiClient.post(`${ACCOUNT_SERVICE_URL}/v1/accounts`, {
      name: 'Event Backbone Sender',
      email: createEmail('event-backbone-sender'),
      initial_balance: '1000.00',
    });
    const receiverResponse = await apiClient.post(`${ACCOUNT_SERVICE_URL}/v1/accounts`, {
      name: 'Event Backbone Receiver',
      email: createEmail('event-backbone-receiver'),
      initial_balance: '100.00',
    });

    const fromAccountId = senderResponse.data.data.id as string;
    const toAccountId = receiverResponse.data.data.id as string;

    const transferResponse = await apiClient.post(`${TRANSFER_SERVICE_URL}/v1/transfers`, {
      from_account_id: fromAccountId,
      to_account_id: toAccountId,
      amount: '125.00',
    });

    const transferId = transferResponse.data.data.id as string;

    await waitUntil(
      async () =>
        transferInitiatedEvents.some((event) => event.transferId === transferId) &&
        transferCompletedEvents.some((event) => event.transferId === transferId),
      12000,
      250
    );

    expect(transferInitiatedEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: KafkaTopics.transferInitiated,
          transferId,
          fromAccountId,
          toAccountId,
          amount: '125.00',
          version: 'v1',
        }),
      ])
    );
    expect(transferCompletedEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: KafkaTopics.transferCompleted,
          transferId,
          fromAccountId,
          toAccountId,
          amount: '125.00',
          version: 'v1',
        }),
      ])
    );
  });
});
