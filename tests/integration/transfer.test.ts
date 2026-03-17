/**
 * Integration tests for transfer service
 * Tests the SAGA pattern and account service interactions
 */

import axios, { AxiosError } from 'axios';
import { Pool } from 'pg';

const ACCOUNT_SERVICE_URL = process.env.ACCOUNT_SERVICE_URL || 'http://localhost:3001';
const TRANSFER_SERVICE_URL = process.env.TRANSFER_SERVICE_URL || 'http://localhost:3002';

// Clean test data between runs
beforeAll(async () => {
  const accountsPool = new Pool({
    host: process.env.ACCOUNTS_DB_HOST || 'localhost',
    port: Number(process.env.ACCOUNTS_DB_HOST_PORT || 5433),
    database: process.env.ACCOUNTS_DB_NAME || 'accounts_db',
    user: process.env.ACCOUNTS_DB_USER || 'accounts_user',
    password: process.env.ACCOUNTS_DB_PASSWORD || 'accounts_pass',
  });
  const transfersPool = new Pool({
    host: process.env.TRANSFERS_DB_HOST || 'localhost',
    port: Number(process.env.TRANSFERS_DB_HOST_PORT || 5434),
    database: process.env.TRANSFERS_DB_NAME || 'transfers_db',
    user: process.env.TRANSFERS_DB_USER || 'transfers_user',
    password: process.env.TRANSFERS_DB_PASSWORD || 'transfers_pass',
  });
  await transfersPool.query('TRUNCATE transfers CASCADE');
  await accountsPool.query('TRUNCATE accounts CASCADE');
  await accountsPool.end();
  await transfersPool.end();
});

// Helper to create an account
async function createAccount(name: string, email: string, balance: string) {
  const response = await axios.post(`${ACCOUNT_SERVICE_URL}/v1/accounts`, {
    name,
    email,
    initial_balance: balance,
  });
  return response.data.data;
}

// Helper to get account balance
async function getAccountBalance(accountId: string) {
  const response = await axios.get(
    `${ACCOUNT_SERVICE_URL}/v1/accounts/${accountId}/balance`
  );
  return response.data.data.balance;
}

// Helper to create a transfer
async function createTransfer(fromId: string, toId: string, amount: string) {
  try {
    const response = await axios.post(`${TRANSFER_SERVICE_URL}/v1/transfers`, {
      from_account_id: fromId,
      to_account_id: toId,
      amount,
    });
    return response.data.data;
  } catch (error: any) {
    throw error;
  }
}

describe('Transfer Integration Tests', () => {
  describe('T089 (FR-028): Insufficient funds returns 422 and balances unchanged', () => {
    it('should return 422 when from_account has insufficient funds', async () => {
      // Create two accounts
      const fromAccount = await createAccount('Sender', 'sender@test.com', '50.00');
      const toAccount = await createAccount('Receiver', 'receiver@test.com', '100.00');

      const initialFromBalance = await getAccountBalance(fromAccount.id);
      const initialToBalance = await getAccountBalance(toAccount.id);

      // Attempt transfer of more than available
      let transferFailed = false;
      let statusCode = 0;

      try {
        await createTransfer(fromAccount.id, toAccount.id, '100.00');
      } catch (error: any) {
        transferFailed = true;
        statusCode = (error as AxiosError)?.response?.status || 0;
      }

      expect(transferFailed).toBe(true);
      expect(statusCode).toBe(422);

      // Verify balances are unchanged
      const finalFromBalance = await getAccountBalance(fromAccount.id);
      const finalToBalance = await getAccountBalance(toAccount.id);

      expect(finalFromBalance).toBe(initialFromBalance);
      expect(finalToBalance).toBe(initialToBalance);
    });
  });

  describe('T090 (FR-029): Happy path transfer updates both balances atomically', () => {
    it('should successfully transfer funds and update both account balances', async () => {
      // Create two accounts
      const fromAccount = await createAccount('Sender', 'sender2@test.com', '1000.00');
      const toAccount = await createAccount('Receiver', 'receiver2@test.com', '500.00');

      // Transfer funds
      const transfer = await createTransfer(fromAccount.id, toAccount.id, '100.00');

      // Verify transfer completed
      expect(transfer.status).toBe('completed');
      expect(transfer.from_account_id).toBe(fromAccount.id);
      expect(transfer.to_account_id).toBe(toAccount.id);
      expect(transfer.amount).toBe('100.00');

      // Verify final balances
      const finalFromBalance = await getAccountBalance(fromAccount.id);
      const finalToBalance = await getAccountBalance(toAccount.id);

      expect(finalFromBalance).toBe('900.00');
      expect(finalToBalance).toBe('600.00');
    });
  });

  describe('T091: Transfer SAGA state is correctly tracked', () => {
    it('should track all SAGA states in completed transfer', async () => {
      const fromAccount = await createAccount('Sender', 'sender3@test.com', '1000.00');
      const toAccount = await createAccount('Receiver', 'receiver3@test.com', '500.00');

      const transfer = await createTransfer(fromAccount.id, toAccount.id, '50.00');

      const sagaState = transfer.saga_state;

      expect(sagaState.current_step).toBe('completed');
      expect(sagaState.debit_completed).toBe(true);
      expect(sagaState.credit_completed).toBe(true);
      expect(sagaState.compensation_completed).toBe(false);
      expect(sagaState.error).toBeNull();
    });
  });

  describe('T092: GET transfer retrieves correct state', () => {
    it('should retrieve transfer with correct saga state', async () => {
      const fromAccount = await createAccount('Sender', 'sender4@test.com', '1000.00');
      const toAccount = await createAccount('Receiver', 'receiver4@test.com', '500.00');

      const transfer = await createTransfer(fromAccount.id, toAccount.id, '75.00');

      // Retrieve the transfer
      const response = await axios.get(
        `${TRANSFER_SERVICE_URL}/v1/transfers/${transfer.id}`
      );

      const retrievedTransfer = response.data.data;

      expect(retrievedTransfer.id).toBe(transfer.id);
      expect(retrievedTransfer.status).toBe('completed');
      expect(retrievedTransfer.amount).toBe('75.00');
    });
  });

  describe('T093: Invalid transfer request returns 400', () => {
    it('should return 400 for invalid UUIDs', async () => {
      let error: any;

      try {
        await axios.post(`${TRANSFER_SERVICE_URL}/v1/transfers`, {
          from_account_id: 'invalid-uuid',
          to_account_id: 'also-invalid',
          amount: '100.00',
        });
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect((error as AxiosError)?.response?.status).toBe(400);
    });

    it('should return 400 when from and to are the same', async () => {
      const account = await createAccount('Test', 'test@test.com', '1000.00');

      let error: any;

      try {
        await axios.post(`${TRANSFER_SERVICE_URL}/v1/transfers`, {
          from_account_id: account.id,
          to_account_id: account.id,
          amount: '100.00',
        });
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect((error as AxiosError)?.response?.status).toBe(400);
    });
  });
});
