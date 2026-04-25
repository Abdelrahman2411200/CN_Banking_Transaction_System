import request from 'supertest';
import { app } from '../index';
import { pool } from '../db';
import { enqueueOutboxEvent } from '../outbox';

jest.mock('../db', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
    on: jest.fn(),
    end: jest.fn(),
  },
}));

jest.mock('../outbox', () => ({
  enqueueOutboxEvent: jest.fn(),
  startOutboxPublisher: jest.fn(),
  stopOutboxPublisher: jest.fn(),
}));

describe('Account Service Routes', () => {
  const accountId = '123e4567-e89b-12d3-a456-426614174000';
  const transactionalClient = {
    query: jest.fn(),
    release: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (pool.connect as jest.Mock).mockResolvedValue(transactionalClient);
  });

  describe('GET /health', () => {
    it('returns 200 with success status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ok');
    });
  });

  describe('POST /accounts', () => {
    it('creates a new account with valid data and queues an outbox event', async () => {
      const mockAccount = {
        id: accountId,
        name: 'John Doe',
        email: 'john@example.com',
        balance: '1000.00',
        kyc_status: 'pending',
        status: 'active',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      transactionalClient.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [mockAccount] })
        .mockResolvedValueOnce(undefined);

      const response = await request(app).post('/v1/accounts').send({
        name: 'John Doe',
        email: 'john@example.com',
        initial_balance: '1000.00',
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(enqueueOutboxEvent).toHaveBeenCalledWith(
        transactionalClient,
        'bank.account.created',
        accountId,
        expect.objectContaining({
          accountId,
          ownerName: 'John Doe',
          email: 'john@example.com',
          initialDeposit: '1000.00',
        })
      );
      expect(transactionalClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(transactionalClient.query).toHaveBeenLastCalledWith('COMMIT');
      expect(transactionalClient.release).toHaveBeenCalled();
    });

    it('returns 400 for invalid initial balance', async () => {
      const response = await request(app).post('/v1/accounts').send({
        name: 'John Doe',
        email: 'john@example.com',
        initial_balance: 'abc',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /accounts/:id', () => {
    it('returns account when found', async () => {
      (pool.query as jest.Mock).mockResolvedValue({
        rows: [
          {
            id: accountId,
            name: 'John Doe',
            email: 'john@example.com',
            balance: '1000.00',
            kyc_status: 'pending',
            status: 'active',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
          },
        ],
      });

      const response = await request(app).get(`/v1/accounts/${accountId}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(accountId);
    });
  });

  describe('PATCH /accounts/:id/debit', () => {
    it('returns 423 when the account is frozen', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: accountId, status: 'suspended' }] });

      const response = await request(app)
        .patch(`/v1/accounts/${accountId}/debit`)
        .send({ amount: '10.00' });

      expect(response.status).toBe(423);
      expect(response.body.error.code).toBe('ACCOUNT_FROZEN');
    });

    it('returns 422 for insufficient funds', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: accountId, status: 'active', kyc_status: 'verified' }] });

      const response = await request(app)
        .patch(`/v1/accounts/${accountId}/debit`)
        .send({ amount: '1000.00' });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('INSUFFICIENT_FUNDS');
    });
  });

  describe('PATCH /accounts/:id/credit', () => {
    it('returns 423 when the account is frozen', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: accountId, status: 'suspended' }] });

      const response = await request(app)
        .patch(`/v1/accounts/${accountId}/credit`)
        .send({ amount: '10.00' });

      expect(response.status).toBe(423);
      expect(response.body.error.code).toBe('ACCOUNT_FROZEN');
    });
  });

  describe('POST /accounts/:id/freeze', () => {
    it('freezes an account', async () => {
      (pool.query as jest.Mock).mockResolvedValue({
        rows: [
          {
            id: accountId,
            name: 'John Doe',
            email: 'john@example.com',
            balance: '1000.00',
            kyc_status: 'pending',
            status: 'suspended',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
          },
        ],
      });

      const response = await request(app).post(`/v1/accounts/${accountId}/freeze`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('suspended');
    });
  });
});
