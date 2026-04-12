import { Router } from 'express';
import type { Request, Response } from 'express';
import { isAxiosError } from 'axios';
import { z } from 'zod';
import { logger } from './logger';
import { TransferSaga } from './saga';
import { CreateTransferSchema } from '@cn-banking/shared-types';
import type {
  CreateTransferResponse,
  ErrorResponse,
  Transfer,
} from '@cn-banking/shared-types';

const router = Router();
const saga = new TransferSaga();
const TransferIdParamSchema = z.object({ id: z.string().uuid() });

const sendError = (res: Response, status: number, code: string, message: string): Response =>
  res.status(status).json({
    success: false,
    error: { code, message },
  } as ErrorResponse);

const parseTransferId = (req: Request, res: Response): string | null => {
  const validation = TransferIdParamSchema.safeParse(req.params);
  if (!validation.success) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Invalid transfer id');
    return null;
  }

  return validation.data.id;
};

// POST /transfers - Create transfer
router.post('/transfers', async (req: Request, res: Response) => {
  const validation = CreateTransferSchema.safeParse(req.body);
  if (!validation.success) {
    return sendError(res, 400, 'VALIDATION_ERROR', validation.error.message);
  }

  try {
    const { from_account_id, to_account_id, amount } = validation.data;

    const transfer = await saga.execute(
      from_account_id,
      to_account_id,
      amount,
      res.locals.requestId as string | undefined
    );

    const response: CreateTransferResponse = {
      success: true,
      data: transfer,
    };
    return res.status(201).json(response);
  } catch (error: unknown) {
    logger.error('error creating transfer', { error: error instanceof Error ? error.message : String(error) });

    if (isAxiosError(error)) {
      if (error.response?.status === 422) {
        return sendError(res, 422, 'INSUFFICIENT_FUNDS', 'Insufficient funds for transfer');
      }

      if (error.response?.status === 423) {
        return sendError(res, 423, 'ACCOUNT_FROZEN', 'Transfer blocked because an account is frozen');
      }

      if (error.response?.status === 404) {
        return sendError(res, 404, 'NOT_FOUND', 'One or more accounts were not found');
      }
    }

    return sendError(res, 500, 'TRANSFER_FAILED', 'Internal server error');
  }
});

// GET /transfers/:id - Get transfer by ID
router.get('/transfers/:id', async (req: Request, res: Response) => {
  const id = parseTransferId(req, res);
  if (!id) {
    return;
  }

  try {
    const transfer = await saga.getTransferById(id);

    if (!transfer) {
      return sendError(res, 404, 'NOT_FOUND', 'Transfer not found');
    }

    return res.status(200).json({
      success: true,
      data: transfer,
    } satisfies { success: true; data: Transfer });
  } catch (error: unknown) {
    logger.error('error getting transfer', { error: error instanceof Error ? error.message : String(error) });
    return sendError(res, 500, 'DATABASE_ERROR', 'Internal server error');
  }
});

export { router };
