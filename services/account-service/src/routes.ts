import { Router } from 'express';
import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from './db';
import { AccountKycStatus, AccountStatus } from '@cn-banking/shared-types';
import type {
  Account,
  HealthResponse,
  CreateAccountResponse,
  GetAccountResponse,
  GetAccountBalanceResponse,
  UpdateAccountResponse,
  ErrorResponse,
} from '@cn-banking/shared-types';
import {
  CreateAccountSchema,
  UpdateKycStatusSchema,
  DebitAccountSchema,
  CreditAccountSchema,
  EVENT_TYPES,
} from '@cn-banking/shared-types';
import { producer } from './kafka';

const router = Router();

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  const response: HealthResponse = {
    success: true,
    data: {
      status: 'ok',
    },
  };
  res.status(200).json(response);
});

// POST /accounts - Create new account
router.post('/accounts', async (req: Request, res: Response) => {
  try {
    const validation = CreateAccountSchema.safeParse(req.body);
    if (!validation.success) {
      const response: ErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.error.message,
        },
      };
      return res.status(400).json(response);
    }

    const { name, email, initial_balance } = validation.data;
    const id = uuidv4();
    const balance = initial_balance || '0.00';
    const now = new Date().toISOString();

    const query = `
      INSERT INTO accounts (id, name, email, balance, kyc_status, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name, email, balance, kyc_status, status, created_at, updated_at
    `;

    const result = await pool.query(query, [
      id,
      name,
      email,
      balance,
      AccountKycStatus.PENDING,
      AccountStatus.ACTIVE,
      now,
      now,
    ]);

    const account: Account = result.rows[0];

    // Phase 2: Emit bank.account.created event
    try {
      await producer.emit(EVENT_TYPES.ACCOUNT_CREATED, account.id, {
        accountId: account.id,
        email: account.email,
        name: account.name,
        initialBalance: parseFloat(account.balance),
        timestamp: now,
      });
    } catch (kafkaError) {
      console.error('Failed to emit account.created event:', kafkaError);
      // We don't fail the request, but we log it
    }

    const response: CreateAccountResponse = {
      success: true,
      data: account,
    };
    res.status(201).json(response);
  } catch (error: any) {
    if (error.code === '23505') {
      const response: ErrorResponse = {
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Account with this email already exists',
        },
      };
      return res.status(409).json(response);
    }
    console.error('Error creating account:', error);
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: error.message || 'Failed to create account',
      },
    };
    res.status(500).json(response);
  }
});

// GET /accounts/:id - Get account by ID
router.get('/accounts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT id, name, email, balance, kyc_status, status, created_at, updated_at
      FROM accounts
      WHERE id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      const response: GetAccountResponse = {
        success: true,
        data: null,
      };
      return res.status(404).json(response);
    }

    const account: Account = result.rows[0];
    const response: GetAccountResponse = {
      success: true,
      data: account,
    };
    res.status(200).json(response);
  } catch (error: any) {
    console.error('Error getting account:', error);
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: error.message || 'Failed to get account',
      },
    };
    res.status(500).json(response);
  }
});

// GET /accounts/:id/balance - Get account balance
router.get('/accounts/:id/balance', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT id, balance
      FROM accounts
      WHERE id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      const response: ErrorResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Account not found',
        },
      };
      return res.status(404).json(response);
    }

    const row = result.rows[0];
    const response: GetAccountBalanceResponse = {
      success: true,
      data: {
        id: row.id,
        balance: row.balance,
      },
    };
    res.status(200).json(response);
  } catch (error: any) {
    console.error('Error getting balance:', error);
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: error.message || 'Failed to get balance',
      },
    };
    res.status(500).json(response);
  }
});

// PATCH /accounts/:id/kyc - Update KYC status
router.patch('/accounts/:id/kyc', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validation = UpdateKycStatusSchema.safeParse(req.body);

    if (!validation.success) {
      const response: ErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.error.message,
        },
      };
      return res.status(400).json(response);
    }

    const { kyc_status } = validation.data;
    const now = new Date().toISOString();

    const query = `
      UPDATE accounts
      SET kyc_status = $1, updated_at = $2
      WHERE id = $3
      RETURNING id, name, email, balance, kyc_status, status, created_at, updated_at
    `;

    const result = await pool.query(query, [kyc_status, now, id]);

    if (result.rows.length === 0) {
      const response: ErrorResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Account not found',
        },
      };
      return res.status(404).json(response);
    }

    const account: Account = result.rows[0];
    const response: UpdateAccountResponse = {
      success: true,
      data: account,
    };
    res.status(200).json(response);
  } catch (error: any) {
    console.error('Error updating KYC status:', error);
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: error.message || 'Failed to update KYC status',
      },
    };
    res.status(500).json(response);
  }
});

// PATCH /accounts/:id/debit - Debit account
router.patch('/accounts/:id/debit', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validation = DebitAccountSchema.safeParse(req.body);

    if (!validation.success) {
      const response: ErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.error.message,
        },
      };
      return res.status(400).json(response);
    }

    const { amount } = validation.data;
    const now = new Date().toISOString();

    const query = `
      UPDATE accounts
      SET balance = balance - $1, updated_at = $2
      WHERE id = $3 AND balance >= $1
      RETURNING id, name, email, balance, kyc_status, status, created_at, updated_at
    `;

    const result = await pool.query(query, [amount, now, id]);

    if (result.rows.length === 0) {
      // Check if account exists but has insufficient funds
      const checkQuery = 'SELECT id FROM accounts WHERE id = $1';
      const checkResult = await pool.query(checkQuery, [id]);

      if (checkResult.rows.length === 0) {
        const response: ErrorResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Account not found',
          },
        };
        return res.status(404).json(response);
      }

      // Account exists but insufficient funds (CHECK violation)
      const response: ErrorResponse = {
        success: false,
        error: {
          code: 'INSUFFICIENT_FUNDS',
          message: 'Insufficient funds for debit',
        },
      };
      return res.status(422).json(response);
    }

    const account: Account = result.rows[0];
    const response: UpdateAccountResponse = {
      success: true,
      data: account,
    };
    res.status(200).json(response);
  } catch (error: any) {
    console.error('Error debiting account:', error);
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: error.message || 'Failed to debit account',
      },
    };
    res.status(500).json(response);
  }
});

// PATCH /accounts/:id/credit - Credit account
router.patch('/accounts/:id/credit', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validation = CreditAccountSchema.safeParse(req.body);

    if (!validation.success) {
      const response: ErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.error.message,
        },
      };
      return res.status(400).json(response);
    }

    const { amount } = validation.data;
    const now = new Date().toISOString();

    const query = `
      UPDATE accounts
      SET balance = balance + $1, updated_at = $2
      WHERE id = $3
      RETURNING id, name, email, balance, kyc_status, status, created_at, updated_at
    `;

    const result = await pool.query(query, [amount, now, id]);

    if (result.rows.length === 0) {
      const response: ErrorResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Account not found',
        },
      };
      return res.status(404).json(response);
    }

    const account: Account = result.rows[0];
    const response: UpdateAccountResponse = {
      success: true,
      data: account,
    };
    res.status(200).json(response);
  } catch (error: any) {
    console.error('Error crediting account:', error);
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: error.message || 'Failed to credit account',
      },
    };
    res.status(500).json(response);
  }
});

// PATCH /accounts/:id/freeze - Freeze account (Phase 2)
router.patch('/accounts/:id/freeze', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const now = new Date().toISOString();

    const query = `
      UPDATE accounts
      SET status = $1, updated_at = $2
      WHERE id = $3
      RETURNING id, name, email, balance, kyc_status, status, created_at, updated_at
    `;

    const result = await pool.query(query, [AccountStatus.SUSPENDED, now, id]);

    if (result.rows.length === 0) {
      const response: ErrorResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Account not found',
        },
      };
      return res.status(404).json(response);
    }

    const account: Account = result.rows[0];
    const response: UpdateAccountResponse = {
      success: true,
      data: account,
    };
    res.status(200).json(response);
  } catch (error: any) {
    console.error('Error freezing account:', error);
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: error.message || 'Failed to freeze account',
      },
    };
    res.status(500).json(response);
  }
});

export { router };
