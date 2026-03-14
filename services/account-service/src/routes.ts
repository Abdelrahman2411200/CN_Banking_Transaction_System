import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from './db';
import type { Account, ApiResponse, CreateAccountDto, UpdateKycDto } from '@cn-bank/types';

const router = Router();

// ─── Validation Schemas ──────────────────────────────────────
const createAccountSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  initial_balance: z.number().min(0).optional().default(0),
});

const updateKycSchema = z.object({
  kyc_status: z.enum(['pending', 'verified', 'rejected']),
});

const debitCreditSchema = z.object({
  amount: z.number().positive(),
});

const uuidSchema = z.string().uuid();

// ─── Health Check ────────────────────────────────────────────
router.get('/health', async (_req: Request, res: Response) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'healthy', service: 'account-service' });
  } catch {
    res.status(503).json({ status: 'unhealthy', service: 'account-service' });
  }
});

// ─── POST /v1/accounts — Create Account ─────────────────────
router.post('/v1/accounts', async (req: Request, res: Response) => {
  try {
    const parsed = createAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      const response: ApiResponse = {
        success: false,
        error: parsed.error.errors.map(e => e.message).join(', '),
      };
      return res.status(400).json(response);
    }

    const { name, email, initial_balance } = parsed.data;

    const result = await pool.query<Account>(
      `INSERT INTO accounts (name, email, balance)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, email, initial_balance]
    );

    const response: ApiResponse<Account> = {
      success: true,
      data: result.rows[0],
      message: 'Account created successfully',
    };
    return res.status(201).json(response);
  } catch (err: any) {
    if (err.code === '23505') {
      // unique_violation (duplicate email)
      const response: ApiResponse = {
        success: false,
        error: 'An account with this email already exists',
      };
      return res.status(409).json(response);
    }
    console.error('[account-service] Create account error:', err);
    const response: ApiResponse = { success: false, error: 'Internal server error' };
    return res.status(500).json(response);
  }
});

// ─── GET /v1/accounts/:id — Read Account ────────────────────
router.get('/v1/accounts/:id', async (req: Request, res: Response) => {
  try {
    const idParse = uuidSchema.safeParse(req.params.id);
    if (!idParse.success) {
      return res.status(400).json({ success: false, error: 'Invalid account ID format' } as ApiResponse);
    }

    const result = await pool.query<Account>(
      'SELECT * FROM accounts WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Account not found' } as ApiResponse);
    }

    return res.status(200).json({ success: true, data: result.rows[0] } as ApiResponse<Account>);
  } catch (err) {
    console.error('[account-service] Read account error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' } as ApiResponse);
  }
});

// ─── GET /v1/accounts/:id/balance — Balance Check ───────────
router.get('/v1/accounts/:id/balance', async (req: Request, res: Response) => {
  try {
    const idParse = uuidSchema.safeParse(req.params.id);
    if (!idParse.success) {
      return res.status(400).json({ success: false, error: 'Invalid account ID format' } as ApiResponse);
    }

    const result = await pool.query<{ id: string; balance: number }>(
      'SELECT id, balance FROM accounts WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Account not found' } as ApiResponse);
    }

    return res.status(200).json({
      success: true,
      data: { id: result.rows[0].id, balance: parseFloat(String(result.rows[0].balance)) },
    } as ApiResponse);
  } catch (err) {
    console.error('[account-service] Balance check error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' } as ApiResponse);
  }
});

// ─── PATCH /v1/accounts/:id/kyc — Update KYC Status ─────────
router.patch('/v1/accounts/:id/kyc', async (req: Request, res: Response) => {
  try {
    const idParse = uuidSchema.safeParse(req.params.id);
    if (!idParse.success) {
      return res.status(400).json({ success: false, error: 'Invalid account ID format' } as ApiResponse);
    }

    const parsed = updateKycSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.errors.map(e => e.message).join(', '),
      } as ApiResponse);
    }

    const result = await pool.query<Account>(
      `UPDATE accounts SET kyc_status = $1 WHERE id = $2 RETURNING *`,
      [parsed.data.kyc_status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Account not found' } as ApiResponse);
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
      message: 'KYC status updated',
    } as ApiResponse<Account>);
  } catch (err) {
    console.error('[account-service] KYC update error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' } as ApiResponse);
  }
});

// ─── PATCH /v1/accounts/:id/debit — Internal Debit ──────────
// Called by transfer-service SAGA — debits the account balance.
// Returns 422 if insufficient funds (PostgreSQL CHECK constraint).
router.patch('/v1/accounts/:id/debit', async (req: Request, res: Response) => {
  try {
    const idParse = uuidSchema.safeParse(req.params.id);
    if (!idParse.success) {
      return res.status(400).json({ success: false, error: 'Invalid account ID format' } as ApiResponse);
    }

    const parsed = debitCreditSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.errors.map(e => e.message).join(', '),
      } as ApiResponse);
    }

    const result = await pool.query<Account>(
      `UPDATE accounts
       SET balance = balance - $1
       WHERE id = $2
       RETURNING *`,
      [parsed.data.amount, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Account not found' } as ApiResponse);
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
      message: 'Debit successful',
    } as ApiResponse<Account>);
  } catch (err: any) {
    // PostgreSQL CHECK constraint violation — insufficient funds
    if (err.code === '23514') {
      return res.status(422).json({
        success: false,
        error: 'Insufficient funds',
      } as ApiResponse);
    }
    console.error('[account-service] Debit error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' } as ApiResponse);
  }
});

// ─── PATCH /v1/accounts/:id/credit — Internal Credit ────────
// Called by transfer-service SAGA — credits the account balance.
router.patch('/v1/accounts/:id/credit', async (req: Request, res: Response) => {
  try {
    const idParse = uuidSchema.safeParse(req.params.id);
    if (!idParse.success) {
      return res.status(400).json({ success: false, error: 'Invalid account ID format' } as ApiResponse);
    }

    const parsed = debitCreditSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.errors.map(e => e.message).join(', '),
      } as ApiResponse);
    }

    const result = await pool.query<Account>(
      `UPDATE accounts
       SET balance = balance + $1
       WHERE id = $2
       RETURNING *`,
      [parsed.data.amount, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Account not found' } as ApiResponse);
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
      message: 'Credit successful',
    } as ApiResponse<Account>);
  } catch (err) {
    console.error('[account-service] Credit error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' } as ApiResponse);
  }
});

export default router;
