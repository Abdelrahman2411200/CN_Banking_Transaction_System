import { Router } from 'express';
import type { Request, Response } from 'express';
import { TransferSaga } from './saga';
import { CreateTransferSchema } from '@cn-banking/shared-types';
import type {
  HealthResponse,
  CreateTransferResponse,
  GetTransferResponse,
  ErrorResponse,
} from '@cn-banking/shared-types';

const router = Router();
const saga = new TransferSaga();

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

// POST /transfers - Create transfer
router.post('/transfers', async (req: Request, res: Response) => {
  try {
    const validation = CreateTransferSchema.safeParse(req.body);

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

    const { from_account_id, to_account_id, amount } = validation.data;

    const transfer = await saga.execute(from_account_id, to_account_id, amount);

    const response: CreateTransferResponse = {
      success: true,
      data: transfer,
    };
    res.status(201).json(response);
  } catch (error: any) {
    console.error('Error creating transfer:', error);

    // Check if it's an insufficient funds error (422)
    if (error.response?.status === 422) {
      const response: ErrorResponse = {
        success: false,
        error: {
          code: 'INSUFFICIENT_FUNDS',
          message: 'Insufficient funds for transfer',
        },
      };
      return res.status(422).json(response);
    }

    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'TRANSFER_FAILED',
        message: error.message || 'Failed to create transfer',
      },
    };
    res.status(500).json(response);
  }
});

// GET /transfers/:id - Get transfer by ID
router.get('/transfers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const transfer = await saga.getTransferById(id);

    if (!transfer) {
      const response: GetTransferResponse = {
        success: true,
        data: null,
      };
      return res.status(404).json(response);
    }

    const response: GetTransferResponse = {
      success: true,
      data: transfer,
    };
    res.status(200).json(response);
  } catch (error: any) {
    console.error('Error getting transfer:', error);
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: error.message || 'Failed to get transfer',
      },
    };
    res.status(500).json(response);
  }
});

export { router };
