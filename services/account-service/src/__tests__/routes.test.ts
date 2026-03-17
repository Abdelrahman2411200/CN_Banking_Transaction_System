import request from 'supertest';
import { app } from '../index';
import { pool } from '../db';

// Mock database for tests
jest.mock('../db', () => ({
  pool: {
    query: jest.fn(),
    on: jest.fn(),
  },
}));

describe('Account Service Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return 200 with success status', async () => {
      const response = await request(app).get('/v1/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ok');
    });
  });

  describe('POST /accounts', () => {
    it('should create a new account with valid data', async () => {
      const mockAccount = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com',
        balance: '1000.00',
        kyc_status: 'pending',
        status: 'active',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      (pool.query as jest.Mock).mockResolvedValue({ rows: [mockAccount] });

      const response = await request(app)
        .post('/v1/accounts')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          initial_balance: '1000.00',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('John Doe');
      expect(response.body.data.email).toBe('john@example.com');
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/v1/accounts')
        .send({
          name: 'John Doe',
          email: 'invalid-email',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for missing name', async () => {
      const response = await request(app)
        .post('/v1/accounts')
        .send({
          email: 'john@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /accounts/:id', () => {
    it('should return account when found', async () => {
      const mockAccount = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com',
        balance: '1000.00',
        kyc_status: 'pending',
        status: 'active',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      (pool.query as jest.Mock).mockResolvedValue({ rows: [mockAccount] });

      const response = await request(app).get(
        '/v1/accounts/123e4567-e89b-12d3-a456-426614174000'
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should return 404 when account not found', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

      const response = await request(app).get(
        '/v1/accounts/123e4567-e89b-12d3-a456-426614174000'
      );

      expect(response.status).toBe(404);
      expect(response.body.data).toBeNull();
    });
  });

  describe('GET /accounts/:id/balance', () => {
    it('should return balance when account found', async () => {
      const mockResult = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        balance: '500.00',
      };

      (pool.query as jest.Mock).mockResolvedValue({ rows: [mockResult] });

      const response = await request(app).get(
        '/v1/accounts/123e4567-e89b-12d3-a456-426614174000/balance'
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.balance).toBe('500.00');
    });

    it('should return 404 when account not found', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

      const response = await request(app).get(
        '/v1/accounts/123e4567-e89b-12d3-a456-426614174000/balance'
      );

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /accounts/:id/kyc', () => {
    it('should update KYC status when account found', async () => {
      const mockAccount = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com',
        balance: '1000.00',
        kyc_status: 'verified',
        status: 'active',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      (pool.query as jest.Mock).mockResolvedValue({ rows: [mockAccount] });

      const response = await request(app)
        .patch('/v1/accounts/123e4567-e89b-12d3-a456-426614174000/kyc')
        .send({ kyc_status: 'verified' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.kyc_status).toBe('verified');
    });

    it('should return 400 for invalid KYC status', async () => {
      const response = await request(app)
        .patch('/v1/accounts/123e4567-e89b-12d3-a456-426614174000/kyc')
        .send({ kyc_status: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 when account not found', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

      const response = await request(app)
        .patch('/v1/accounts/123e4567-e89b-12d3-a456-426614174000/kyc')
        .send({ kyc_status: 'verified' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /accounts/:id/debit', () => {
    it('should debit account when sufficient funds', async () => {
      const mockAccount = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com',
        balance: '900.00',
        kyc_status: 'pending',
        status: 'active',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      (pool.query as jest.Mock).mockResolvedValue({ rows: [mockAccount] });

      const response = await request(app)
        .patch('/v1/accounts/123e4567-e89b-12d3-a456-426614174000/debit')
        .send({ amount: '100.00' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.balance).toBe('900.00');
    });

    it('should return 422 when insufficient funds', async () => {
      // Simulate insufficient funds by returning empty rows from UPDATE
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // UPDATE returns no rows
        .mockResolvedValueOnce({ rows: [{ id: '123e4567-e89b-12d3-a456-426614174000' }] }); // SELECT returns account

      const response = await request(app)
        .patch('/v1/accounts/123e4567-e89b-12d3-a456-426614174000/debit')
        .send({ amount: '1000.00' });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 when account not found', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // UPDATE returns no rows
        .mockResolvedValueOnce({ rows: [] }); // SELECT returns no account

      const response = await request(app)
        .patch('/v1/accounts/123e4567-e89b-12d3-a456-426614174000/debit')
        .send({ amount: '100.00' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid amount', async () => {
      const response = await request(app)
        .patch('/v1/accounts/123e4567-e89b-12d3-a456-426614174000/debit')
        .send({ amount: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /accounts/:id/credit', () => {
    it('should credit account', async () => {
      const mockAccount = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com',
        balance: '1100.00',
        kyc_status: 'pending',
        status: 'active',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      (pool.query as jest.Mock).mockResolvedValue({ rows: [mockAccount] });

      const response = await request(app)
        .patch('/v1/accounts/123e4567-e89b-12d3-a456-426614174000/credit')
        .send({ amount: '100.00' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.balance).toBe('1100.00');
    });

    it('should return 404 when account not found', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

      const response = await request(app)
        .patch('/v1/accounts/123e4567-e89b-12d3-a456-426614174000/credit')
        .send({ amount: '100.00' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid amount', async () => {
      const response = await request(app)
        .patch('/v1/accounts/123e4567-e89b-12d3-a456-426614174000/credit')
        .send({ amount: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
