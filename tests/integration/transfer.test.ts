/**
 * Integration Tests for Transfer Flow
 *
 * These tests validate end-to-end transfer behavior by mocking:
 *   - The account-service HTTP endpoints (via axios mock)
 *   - The PostgreSQL database (via pg Pool mock)
 *
 * Test cases:
 *   1. Insufficient funds → 422, balances unchanged
 *   2. Happy-path transfer → both balances updated atomically
 */
import express from 'express';
import request from 'supertest';

// ─── Shared Mock Variables ───────────────────────────────────
let fromBalance = 1000;
let toBalance = 500;
const fromAccountId = '11111111-1111-1111-1111-111111111111';
const toAccountId   = '22222222-2222-2222-2222-222222222222';

// ─── Mock axios BEFORE importing routes ──────────────────────
jest.mock('axios', () => {
  return {
    create: jest.fn().mockReturnValue({
      patch: jest.fn().mockImplementation(async (url: string, body: any) => {
        const amount = body.amount;

        if (url.includes(fromAccountId) && url.includes('/debit')) {
          if (fromBalance - amount < 0) {
            throw {
              response: { status: 422, data: { success: false, error: 'Insufficient funds' } },
            };
          }
          fromBalance -= amount;
          return { data: { success: true, data: { id: fromAccountId, balance: fromBalance } } };
        }

        if (url.includes(toAccountId) && url.includes('/credit')) {
          toBalance += amount;
          return { data: { success: true, data: { id: toAccountId, balance: toBalance } } };
        }

        if (url.includes(fromAccountId) && url.includes('/credit')) {
          fromBalance += amount;
          return { data: { success: true, data: { id: fromAccountId, balance: fromBalance } } };
        }

        throw new Error(`Unexpected URL: ${url}`);
      })
    }),
    patch: jest.fn(),
  };
});

// ─── Mock the transfer-service DB pool ───────────────────────
jest.mock('../../services/transfer-service/src/db', () => {
  const mockQuery = jest.fn();
  return {
    __esModule: true,
    default: { query: mockQuery },
  };
});

import transferRouter from '../../services/transfer-service/src/routes';

const mockPool = require('../../services/transfer-service/src/db').default;

// Build a test Express app
const app = express();
app.use(express.json());
app.use(transferRouter);

describe('Transfer Integration Tests', () => {
  // Simulated account balances
  beforeEach(() => {
    jest.clearAllMocks();
    fromBalance = 1000;
    toBalance = 500;


    // Mock DB: INSERT and UPDATE for transfers
    mockPool.query.mockImplementation((sql: string, params?: any[]) => {
      if (sql.includes('INSERT INTO transfers')) {
        return {
          rows: [{
            id: 'transfer-int-001',
            from_account_id: params?.[0],
            to_account_id: params?.[1],
            amount: params?.[2],
            status: 'initiated',
            saga_state: JSON.parse(params?.[3] as string),
            error_message: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }],
        };
      }

      if (sql.includes('UPDATE transfers')) {
        return {
          rows: [{
            id: params?.[3],
            from_account_id: fromAccountId,
            to_account_id: toAccountId,
            amount: 0,
            status: params?.[0],
            saga_state: JSON.parse(params?.[1] as string),
            error_message: params?.[2],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }],
        };
      }

      if (sql.includes('SELECT 1')) {
        return { rows: [{ '?column?': 1 }] };
      }

      return { rows: [] };
    });
  });

  // ─── Test 1: Insufficient Funds ─────────────────────────────
  test('insufficient funds returns 422, balances unchanged', async () => {
    const initialFrom = fromBalance;
    const initialTo = toBalance;

    const res = await request(app)
      .post('/v1/transfers')
      .send({
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount: 5000, // more than fromBalance (1000)
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Insufficient funds');

    // Balances should be unchanged
    expect(fromBalance).toBe(initialFrom);
    expect(toBalance).toBe(initialTo);
  });

  // ─── Test 2: Happy-Path Transfer ────────────────────────────
  test('happy-path transfer updates both balances atomically', async () => {
    const transferAmount = 200;

    const res = await request(app)
      .post('/v1/transfers')
      .send({
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount: transferAmount,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.saga_state.debit_completed).toBe(true);
    expect(res.body.data.saga_state.credit_completed).toBe(true);

    // Balances should be updated
    expect(fromBalance).toBe(800);   // 1000 - 200
    expect(toBalance).toBe(700);     // 500 + 200
  });

  // ─── Test 3: Self-transfer rejected ─────────────────────────
  test('transfer to same account returns 400', async () => {
    const res = await request(app)
      .post('/v1/transfers')
      .send({
        from_account_id: fromAccountId,
        to_account_id: fromAccountId,
        amount: 100,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
