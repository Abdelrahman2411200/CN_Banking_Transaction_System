/**
 * Unit Tests for Account Service Routes
 *
 * Tests each endpoint handler with mocked DB pool.
 */
import express from 'express';
import request from 'supertest';
import router from '../routes';

// ─── Mock the DB pool ────────────────────────────────────────
jest.mock('../db', () => {
  const mockQuery = jest.fn();
  return {
    __esModule: true,
    default: { query: mockQuery },
  };
});

const mockPool = require('../db').default;

const app = express();
app.use(express.json());
app.use(router);

describe('Account Service Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockAccount = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'John Doe',
    email: 'john@example.com',
    balance: 1000,
    kyc_status: 'pending',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  // ─── Health Check ────────────────────────────────────
  describe('GET /health', () => {
    test('returns 200 when DB is reachable', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    });

    test('returns 503 when DB is unreachable', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Connection refused'));

      const res = await request(app).get('/health');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('unhealthy');
    });
  });

  // ─── POST /v1/accounts ──────────────────────────────
  describe('POST /v1/accounts', () => {
    test('creates account with valid data', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockAccount] });

      const res = await request(app)
        .post('/v1/accounts')
        .send({ name: 'John Doe', email: 'john@example.com', initial_balance: 1000 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('John Doe');
    });

    test('returns 400 for missing name', async () => {
      const res = await request(app)
        .post('/v1/accounts')
        .send({ email: 'john@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('returns 400 for invalid email', async () => {
      const res = await request(app)
        .post('/v1/accounts')
        .send({ name: 'John', email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('returns 409 for duplicate email', async () => {
      mockPool.query.mockRejectedValueOnce({ code: '23505' });

      const res = await request(app)
        .post('/v1/accounts')
        .send({ name: 'John', email: 'john@example.com' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });
  });

  // ─── GET /v1/accounts/:id ───────────────────────────
  describe('GET /v1/accounts/:id', () => {
    test('returns account for valid ID', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockAccount] });

      const res = await request(app).get(`/v1/accounts/${mockAccount.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(mockAccount.id);
    });

    test('returns 404 for non-existent account', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/v1/accounts/11111111-1111-1111-1111-111111111111');
      expect(res.status).toBe(404);
    });

    test('returns 400 for invalid UUID', async () => {
      const res = await request(app).get('/v1/accounts/not-a-uuid');
      expect(res.status).toBe(400);
    });
  });

  // ─── GET /v1/accounts/:id/balance ───────────────────
  describe('GET /v1/accounts/:id/balance', () => {
    test('returns balance for valid ID', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: mockAccount.id, balance: 1000 }] });

      const res = await request(app).get(`/v1/accounts/${mockAccount.id}/balance`);
      expect(res.status).toBe(200);
      expect(res.body.data.balance).toBe(1000);
    });
  });

  // ─── PATCH /v1/accounts/:id/kyc ─────────────────────
  describe('PATCH /v1/accounts/:id/kyc', () => {
    test('updates KYC status', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ ...mockAccount, kyc_status: 'verified' }],
      });

      const res = await request(app)
        .patch(`/v1/accounts/${mockAccount.id}/kyc`)
        .send({ kyc_status: 'verified' });

      expect(res.status).toBe(200);
      expect(res.body.data.kyc_status).toBe('verified');
    });

    test('returns 400 for invalid KYC status', async () => {
      const res = await request(app)
        .patch(`/v1/accounts/${mockAccount.id}/kyc`)
        .send({ kyc_status: 'invalid' });

      expect(res.status).toBe(400);
    });
  });

  // ─── PATCH /v1/accounts/:id/debit ───────────────────
  describe('PATCH /v1/accounts/:id/debit', () => {
    test('debits account successfully', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ ...mockAccount, balance: 900 }],
      });

      const res = await request(app)
        .patch(`/v1/accounts/${mockAccount.id}/debit`)
        .send({ amount: 100 });

      expect(res.status).toBe(200);
      expect(res.body.data.balance).toBe(900);
    });

    test('returns 422 for insufficient funds (CHECK constraint)', async () => {
      mockPool.query.mockRejectedValueOnce({ code: '23514' });

      const res = await request(app)
        .patch(`/v1/accounts/${mockAccount.id}/debit`)
        .send({ amount: 99999 });

      expect(res.status).toBe(422);
      expect(res.body.error).toContain('Insufficient funds');
    });
  });

  // ─── PATCH /v1/accounts/:id/credit ──────────────────
  describe('PATCH /v1/accounts/:id/credit', () => {
    test('credits account successfully', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ ...mockAccount, balance: 1100 }],
      });

      const res = await request(app)
        .patch(`/v1/accounts/${mockAccount.id}/credit`)
        .send({ amount: 100 });

      expect(res.status).toBe(200);
      expect(res.body.data.balance).toBe(1100);
    });
  });
});
