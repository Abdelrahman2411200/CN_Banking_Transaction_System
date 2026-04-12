import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from './db';
import { enqueueOutboxEvent } from './outbox';
import { AccountKycStatus, AccountStatus } from '@cn-banking/shared-types';
import type {
  Account,
  AccountCreatedEvent,
  CreateAccountResponse,
  ErrorResponse,
  GetAccountBalanceResponse,
  UpdateAccountResponse,
} from '@cn-banking/shared-types';
import {
  buildBaseEvent,
  CreateAccountSchema,
  CreditAccountSchema,
  DebitAccountSchema,
  KafkaTopics,
  UpdateKycStatusSchema,
} from '@cn-banking/shared-types';
import { logger } from './logger';
import { accountBalanceUsd, accountsCreatedTotal } from './metrics';

const router = Router();
const AccountIdParamSchema = z.object({ id: z.string().uuid() });

const sendError = (res: Response, status: number, code: string, message: string): Response =>
  res.status(status).json({
    success: false,
    error: { code, message },
  } as ErrorResponse);

const parseAccountId = (req: Request, res: Response): string | null => {
  const validation = AccountIdParamSchema.safeParse(req.params);
  if (!validation.success) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Invalid account id');
    return null;
  }

  return validation.data.id;
};

const isPgError = (error: unknown, code?: string): error is { code?: string } => {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }

  if (typeof code === 'undefined') {
    return true;
  }

  return (error as { code?: string }).code === code;
};

const observeBalance = (balance: string): void => {
  accountBalanceUsd.observe(Number(balance));
};

const getExistingAccountStatus = async (id: string): Promise<{ id: string; status: AccountStatus } | null> => {
  const result = await pool.query<{ id: string; status: AccountStatus }>(
    'SELECT id, status FROM accounts WHERE id = $1',
    [id]
  );

  return result.rows[0] ?? null;
};

// POST /accounts - Create new account
router.post('/accounts', async (req: Request, res: Response) => {
  const validation = CreateAccountSchema.safeParse(req.body);
  if (!validation.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', validation.error.message);
  }

  const client = await pool.connect();

  try {
    const { name, email, initial_balance } = validation.data;
    await client.query('BEGIN');

    const query = `
      INSERT INTO accounts (name, email, balance, kyc_status, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, email, balance, kyc_status, status, created_at, updated_at
    `;

    const result = await client.query<Account>(query, [
      name,
      email,
      initial_balance ?? '0.00',
      AccountKycStatus.PENDING,
      AccountStatus.ACTIVE,
    ]);

    const account = result.rows[0];
    const response: CreateAccountResponse = {
      success: true,
      data: account,
    };

    const event: AccountCreatedEvent = {
      ...buildBaseEvent(KafkaTopics.accountCreated),
      accountId: account.id,
      ownerName: account.name,
      email: account.email,
      initialDeposit: account.balance,
    };

    await enqueueOutboxEvent(client, KafkaTopics.accountCreated, account.id, event);
    await client.query('COMMIT');
    accountsCreatedTotal.inc();
    observeBalance(account.balance);
    logger.info('account created', { accountId: account.id });
    return res.status(201).json(response);
  } catch (error: unknown) {
    await client.query('ROLLBACK');

    if (isPgError(error, '23505')) {
      return sendError(res, 409, 'CONFLICT', 'Account with this email already exists');
    }

    logger.error('error creating account', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, 500, 'DATABASE_ERROR', 'Internal server error');
  } finally {
    client.release();
  }
});

// GET /accounts/:id - Get account by ID
router.get('/accounts/:id', async (req: Request, res: Response) => {
  const id = parseAccountId(req, res);
  if (!id) {
    return;
  }

  try {
    const query = `
      SELECT id, name, email, balance, kyc_status, status, created_at, updated_at
      FROM accounts
      WHERE id = $1
    `;

    const result = await pool.query<Account>(query, [id]);
    const account = result.rows[0];

    if (!account) {
      return sendError(res, 404, 'NOT_FOUND', 'Account not found');
    }

    observeBalance(account.balance);
    return res.status(200).json({
      success: true,
      data: account,
    });
  } catch (error: unknown) {
    logger.error('error getting account', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, 500, 'DATABASE_ERROR', 'Internal server error');
  }
});

// GET /accounts/:id/balance - Get account balance
router.get('/accounts/:id/balance', async (req: Request, res: Response) => {
  const id = parseAccountId(req, res);
  if (!id) {
    return;
  }

  try {
    const query = `
      SELECT id, balance
      FROM accounts
      WHERE id = $1
    `;

    const result = await pool.query<{ id: string; balance: string }>(query, [id]);
    const row = result.rows[0];

    if (!row) {
      return sendError(res, 404, 'NOT_FOUND', 'Account not found');
    }

    const response: GetAccountBalanceResponse = {
      success: true,
      data: row,
    };
    observeBalance(row.balance);
    return res.status(200).json(response);
  } catch (error: unknown) {
    logger.error('error getting balance', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, 500, 'DATABASE_ERROR', 'Internal server error');
  }
});

// PATCH /accounts/:id/kyc - Update KYC status
router.patch('/accounts/:id/kyc', async (req: Request, res: Response) => {
  const id = parseAccountId(req, res);
  if (!id) {
    return;
  }

  const validation = UpdateKycStatusSchema.safeParse(req.body);
  if (!validation.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', validation.error.message);
  }

  try {
    const { kyc_status } = validation.data;

    const query = `
      UPDATE accounts
      SET kyc_status = $1
      WHERE id = $2
      RETURNING id, name, email, balance, kyc_status, status, created_at, updated_at
    `;

    const result = await pool.query<Account>(query, [kyc_status, id]);
    const account = result.rows[0];

    if (!account) {
      return sendError(res, 404, 'NOT_FOUND', 'Account not found');
    }

    const response: UpdateAccountResponse = {
      success: true,
      data: account,
    };
    observeBalance(account.balance);
    return res.status(200).json(response);
  } catch (error: unknown) {
    logger.error('error updating KYC status', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, 500, 'DATABASE_ERROR', 'Internal server error');
  }
});

// PATCH /accounts/:id/debit - Debit account
router.patch('/accounts/:id/debit', async (req: Request, res: Response) => {
  const id = parseAccountId(req, res);
  if (!id) {
    return;
  }

  const validation = DebitAccountSchema.safeParse(req.body);
  if (!validation.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', validation.error.message);
  }

  try {
    const { amount } = validation.data;

    const query = `
      UPDATE accounts
      SET balance = balance - $1
      WHERE id = $2 AND status <> $3 AND balance >= $1
      RETURNING id, name, email, balance, kyc_status, status, created_at, updated_at
    `;

    const result = await pool.query<Account>(query, [amount, id, AccountStatus.SUSPENDED]);
    const account = result.rows[0];

    if (!account) {
      const existingAccount = await getExistingAccountStatus(id);
      if (!existingAccount) {
        return sendError(res, 404, 'NOT_FOUND', 'Account not found');
      }

      if (existingAccount.status === AccountStatus.SUSPENDED) {
        return sendError(res, 423, 'ACCOUNT_FROZEN', 'Account is frozen');
      }

      return sendError(res, 422, 'INSUFFICIENT_FUNDS', 'Insufficient funds for debit');
    }

    const response: UpdateAccountResponse = {
      success: true,
      data: account,
    };
    observeBalance(account.balance);
    return res.status(200).json(response);
  } catch (error: unknown) {
    logger.error('error debiting account', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, 500, 'DATABASE_ERROR', 'Internal server error');
  }
});

// PATCH /accounts/:id/credit - Credit account
router.patch('/accounts/:id/credit', async (req: Request, res: Response) => {
  const id = parseAccountId(req, res);
  if (!id) {
    return;
  }

  const validation = CreditAccountSchema.safeParse(req.body);
  if (!validation.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', validation.error.message);
  }

  try {
    const { amount } = validation.data;

    const query = `
      UPDATE accounts
      SET balance = balance + $1
      WHERE id = $2 AND status <> $3
      RETURNING id, name, email, balance, kyc_status, status, created_at, updated_at
    `;

    const result = await pool.query<Account>(query, [amount, id, AccountStatus.SUSPENDED]);
    const account = result.rows[0];

    if (!account) {
      const existingAccount = await getExistingAccountStatus(id);
      if (existingAccount?.status === AccountStatus.SUSPENDED) {
        return sendError(res, 423, 'ACCOUNT_FROZEN', 'Account is frozen');
      }

      return sendError(res, 404, 'NOT_FOUND', 'Account not found');
    }

    const response: UpdateAccountResponse = {
      success: true,
      data: account,
    };
    observeBalance(account.balance);
    return res.status(200).json(response);
  } catch (error: unknown) {
    logger.error('error crediting account', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, 500, 'DATABASE_ERROR', 'Internal server error');
  }
});

// POST /accounts/:id/freeze - Freeze account
router.post('/accounts/:id/freeze', async (req: Request, res: Response) => {
  const id = parseAccountId(req, res);
  if (!id) {
    return;
  }

  try {
    const result = await pool.query<Account>(
      `
        UPDATE accounts
        SET status = $1
        WHERE id = $2
        RETURNING id, name, email, balance, kyc_status, status, created_at, updated_at
      `,
      [AccountStatus.SUSPENDED, id]
    );

    const account = result.rows[0];
    if (!account) {
      return sendError(res, 404, 'NOT_FOUND', 'Account not found');
    }

    const response: UpdateAccountResponse = {
      success: true,
      data: account,
    };

    return res.status(200).json(response);
  } catch (error: unknown) {
    logger.error('error freezing account', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, 500, 'DATABASE_ERROR', 'Internal server error');
  }
});

export { router };
