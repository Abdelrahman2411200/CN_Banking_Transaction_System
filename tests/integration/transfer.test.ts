import http from 'node:http';
import https from 'node:https';
import axios, { AxiosError } from 'axios';
import { Pool } from 'pg';
import type { Transfer } from '@cn-banking/shared-types';
import { resolveServiceUrl } from './phase2.helpers';

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
const apiClient = axios.create({
  httpAgent,
  httpsAgent,
});

const cleanupData = async (): Promise<void> => {
  await transfersPool.query('TRUNCATE transfers CASCADE');
  await accountsPool.query('TRUNCATE accounts CASCADE');
};

const createEmail = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@test.com`;

async function createAccount(name: string, email: string, balance: string): Promise<{ id: string }> {
  const response = await apiClient.post(`${ACCOUNT_SERVICE_URL}/v1/accounts`, {
    name,
    email,
    initial_balance: balance,
  });

  return response.data.data;
}

async function getAccountBalance(accountId: string): Promise<string> {
  const response = await apiClient.get(`${ACCOUNT_SERVICE_URL}/v1/accounts/${accountId}/balance`);
  return response.data.data.balance;
}

async function createTransfer(fromId: string, toId: string, amountValue: string): Promise<Transfer> {
  const response = await apiClient.post(`${TRANSFER_SERVICE_URL}/v1/transfers`, {
    from_account_id: fromId,
    to_account_id: toId,
    amount: amountValue,
  });

  return response.data.data;
}

beforeAll(async () => {
  await cleanupData();
});

afterAll(async () => {
  await cleanupData();
  await accountsPool.end();
  await transfersPool.end();
  httpAgent.destroy();
  httpsAgent.destroy();
});

describe('Transfer Integration Tests', () => {
  it('returns 422 when from_account has insufficient funds', async () => {
    const fromAccount = await createAccount('Sender', createEmail('sender'), '50.00');
    const toAccount = await createAccount('Receiver', createEmail('receiver'), '100.00');

    const initialFromBalance = await getAccountBalance(fromAccount.id);
    const initialToBalance = await getAccountBalance(toAccount.id);

    let statusCode = 0;

    try {
      await createTransfer(fromAccount.id, toAccount.id, '100.00');
    } catch (error: unknown) {
      statusCode = (error as AxiosError).response?.status || 0;
    }

    expect(statusCode).toBe(422);
    await expect(getAccountBalance(fromAccount.id)).resolves.toBe(initialFromBalance);
    await expect(getAccountBalance(toAccount.id)).resolves.toBe(initialToBalance);
  });

  it('successfully transfers funds and updates both balances', async () => {
    const fromAccount = await createAccount('Sender', createEmail('sender'), '1000.00');
    const toAccount = await createAccount('Receiver', createEmail('receiver'), '500.00');

    const transfer = await createTransfer(fromAccount.id, toAccount.id, '100.00');

    expect(transfer.status).toBe('completed');
    expect(transfer.from_account_id).toBe(fromAccount.id);
    expect(transfer.to_account_id).toBe(toAccount.id);
    expect(transfer.amount).toBe('100.00');

    await expect(getAccountBalance(fromAccount.id)).resolves.toBe('900.00');
    await expect(getAccountBalance(toAccount.id)).resolves.toBe('600.00');
  });

  it('tracks saga state on a completed transfer', async () => {
    const fromAccount = await createAccount('Sender', createEmail('sender'), '1000.00');
    const toAccount = await createAccount('Receiver', createEmail('receiver'), '500.00');

    const transfer = await createTransfer(fromAccount.id, toAccount.id, '50.00');

    expect(transfer.saga_state.current_step).toBe('completed');
    expect(transfer.saga_state.debit_completed).toBe(true);
    expect(transfer.saga_state.credit_completed).toBe(true);
    expect(transfer.saga_state.compensation_completed).toBe(false);
    expect(transfer.saga_state.error).toBeNull();
  });

  it('retrieves a transfer by id', async () => {
    const fromAccount = await createAccount('Sender', createEmail('sender'), '1000.00');
    const toAccount = await createAccount('Receiver', createEmail('receiver'), '500.00');
    const transfer = await createTransfer(fromAccount.id, toAccount.id, '75.00');

    const response = await apiClient.get(`${TRANSFER_SERVICE_URL}/v1/transfers/${transfer.id}`);

    expect(response.data.data.id).toBe(transfer.id);
    expect(response.data.data.status).toBe('completed');
    expect(response.data.data.amount).toBe('75.00');
  });

  it('returns 400 for invalid UUIDs', async () => {
    let statusCode = 0;

    try {
      await apiClient.post(`${TRANSFER_SERVICE_URL}/v1/transfers`, {
        from_account_id: 'invalid-uuid',
        to_account_id: 'also-invalid',
        amount: '100.00',
      });
    } catch (error: unknown) {
      statusCode = (error as AxiosError).response?.status || 0;
    }

    expect(statusCode).toBe(400);
  });

  it('returns 400 when source and destination are the same account', async () => {
    const account = await createAccount('Test', createEmail('same-account'), '1000.00');
    let statusCode = 0;

    try {
      await apiClient.post(`${TRANSFER_SERVICE_URL}/v1/transfers`, {
        from_account_id: account.id,
        to_account_id: account.id,
        amount: '100.00',
      });
    } catch (error: unknown) {
      statusCode = (error as AxiosError).response?.status || 0;
    }

    expect(statusCode).toBe(400);
  });
});


