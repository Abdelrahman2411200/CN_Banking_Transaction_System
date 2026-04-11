import http from 'node:http';
import https from 'node:https';
import axios from 'axios';
import { MongoClient } from 'mongodb';
import { Pool } from 'pg';
import { resolveMongoUri, resolveServiceUrl, waitUntil } from './phase2.helpers';

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
const LEDGER_SERVICE_URL = resolveServiceUrl(
  process.env.LEDGER_SERVICE_URL,
  'http://ledger-service:3003',
  'http://localhost:3003'
);
const FRAUD_SERVICE_URL = resolveServiceUrl(
  process.env.FRAUD_SERVICE_URL,
  'http://fraud-service:3004',
  'http://localhost:3004'
);
const NOTIFICATION_SERVICE_URL = resolveServiceUrl(
  process.env.NOTIFICATION_SERVICE_URL,
  'http://notification-service:3005',
  'http://localhost:3005'
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

const mongoClient = new MongoClient(resolveMongoUri(process.env.MONGODB_URI));
const httpAgent = new http.Agent({ keepAlive: false });
const httpsAgent = new https.Agent({ keepAlive: false });
const apiClient = axios.create({ httpAgent, httpsAgent });

const cleanupData = async (): Promise<void> => {
  await transfersPool.query('TRUNCATE outbox_events, transfers CASCADE');
  await accountsPool.query('TRUNCATE outbox_events, accounts CASCADE');
  await mongoClient.db('banking_events').collection('ledger_entries').deleteMany({});
  await mongoClient.db('banking_events').collection('fraud_events').deleteMany({});
  await mongoClient.db('banking_events').collection('transfer_activity').deleteMany({});
};

const createEmail = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@test.com`;

const createAccount = async (
  name: string,
  balance: string
): Promise<{ id: string; email: string }> => {
  const email = createEmail(name.toLowerCase().replace(/\s+/g, '-'));
  const response = await apiClient.post(`${ACCOUNT_SERVICE_URL}/v1/accounts`, {
    name,
    email,
    initial_balance: balance,
  });

  return { id: response.data.data.id as string, email };
};

beforeAll(async () => {
  await mongoClient.connect();
  await cleanupData();
});

beforeEach(async () => {
  await cleanupData();
});

afterAll(async () => {
  await cleanupData();
  await mongoClient.close();
  await accountsPool.end();
  await transfersPool.end();
  httpAgent.destroy();
  httpsAgent.destroy();
});

describe('Phase 2 end-to-end flow', () => {
  it('propagates a completed transfer through ledger, fraud, and notification-ready surfaces', async () => {
    const sender = await createAccount('Phase2 E2E Sender', '5000.00');
    const receiver = await createAccount('Phase2 E2E Receiver', '100.00');

    const transferResponse = await apiClient.post(`${TRANSFER_SERVICE_URL}/v1/transfers`, {
      from_account_id: sender.id,
      to_account_id: receiver.id,
      amount: '1000.00',
    });

    const transferId = transferResponse.data.data.id as string;
    expect(transferResponse.data.data.status).toBe('completed');

    await waitUntil(async () => {
      const response = await apiClient.get(`${LEDGER_SERVICE_URL}/v1/ledger/transfer/${transferId}`);
      return response.data.data.length === 2;
    }, 12000, 300);

    const ledgerResponse = await apiClient.get(`${LEDGER_SERVICE_URL}/v1/ledger/transfer/${transferId}`);
    expect(ledgerResponse.data.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ transferId, accountId: sender.id, entryType: 'debit' }),
        expect.objectContaining({ transferId, accountId: receiver.id, entryType: 'credit' }),
      ])
    );

    await waitUntil(async () => {
      const response = await apiClient.get(`${FRAUD_SERVICE_URL}/v1/fraud/alerts`, {
        params: { accountId: sender.id },
      });

      return response.data.data.some(
        (alert: { transferId: string; ruleTriggered: string; severity: string }) =>
          alert.transferId === transferId &&
          alert.ruleTriggered === 'round_number' &&
          alert.severity === 'low'
      );
    }, 12000, 300);

    const fraudResponse = await apiClient.get(`${FRAUD_SERVICE_URL}/v1/fraud/alerts`, {
      params: { accountId: sender.id },
    });
    expect(fraudResponse.data.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transferId,
          fromAccountId: sender.id,
          ruleTriggered: 'round_number',
          severity: 'low',
        }),
      ])
    );

    await expect(apiClient.get(`${NOTIFICATION_SERVICE_URL}/health`)).resolves.toMatchObject({
      status: 200,
      data: { success: true },
    });
  });
});
