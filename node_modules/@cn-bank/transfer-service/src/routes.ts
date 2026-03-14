import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from './db';
import { TransferSaga } from './saga';
import type { Transfer, ApiResponse } from '@cn-bank/types';

const router = Router();
const saga = new TransferSaga();

// ─── Validation Schemas ──────────────────────────────────────
const createTransferSchema = z.object({
  from_account_id: z.string().uuid(),
  to_account_id: z.string().uuid(),
  amount: z.number().positive(),
}).refine(data => data.from_account_id !== data.to_account_id, {
  message: 'Cannot transfer to the same account',
});

const uuidSchema = z.string().uuid();

// ─── Health Check ────────────────────────────────────────────
router.get('/health', async (_req: Request, res: Response) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'healthy', service: 'transfer-service' });
  } catch {
    res.status(503).json({ status: 'unhealthy', service: 'transfer-service' });
  }
});

// ─── POST /v1/transfers — Initiate Transfer ──────────────────
router.post('/v1/transfers', async (req: Request, res: Response) => {
  try {
    const parsed = createTransferSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.errors.map(e => e.message).join(', '),
      } as ApiResponse);
    }

    const { from_account_id, to_account_id, amount } = parsed.data;

    const transfer = await saga.execute(from_account_id, to_account_id, amount);

    if (transfer.status === 'failed') {
      // Determine appropriate status code
      const isInsufficientFunds = transfer.error_message?.includes('Insufficient funds');
      const statusCode = isInsufficientFunds ? 422 : 500;

      return res.status(statusCode).json({
        success: false,
        data: transfer,
        error: transfer.error_message || 'Transfer failed',
      } as ApiResponse<Transfer>);
    }

    return res.status(201).json({
      success: true,
      data: transfer,
      message: 'Transfer completed successfully',
    } as ApiResponse<Transfer>);
  } catch (err: any) {
    console.error('[transfer-service] Transfer error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ─── GET /v1/transfers/:id — Get Transfer Status ─────────────
router.get('/v1/transfers/:id', async (req: Request, res: Response) => {
  try {
    const idParse = uuidSchema.safeParse(req.params.id);
    if (!idParse.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid transfer ID format',
      } as ApiResponse);
    }

    const result = await pool.query<Transfer>(
      'SELECT * FROM transfers WHERE id = $1',
      [req.params.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Transfer not found',
      } as ApiResponse);
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    } as ApiResponse<Transfer>);
  } catch (err) {
    console.error('[transfer-service] Get transfer error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

export default router;
