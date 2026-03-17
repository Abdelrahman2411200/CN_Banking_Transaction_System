import axios from 'axios';
import { TransferSaga } from '../saga';
import { pool } from '../db';
import { TransferStatus, SagaStep, Transfer, SagaState } from '@cn-banking/shared-types';

jest.mock('axios');
jest.mock('../db', () => ({
  pool: {
    query: jest.fn(),
    on: jest.fn(),
  },
}));

describe('TransferSaga', () => {
  let saga: TransferSaga;
  const fromAccountId = '123e4567-e89b-12d3-a456-426614174001';
  const toAccountId = '123e4567-e89b-12d3-a456-426614174002';
  const amount = '100.00';

  beforeEach(() => {
    saga = new TransferSaga();
    jest.clearAllMocks();
  });

  describe('T084 (FR-027): Compensation fires when credit fails', () => {
    it('should call compensation when credit fails after debit succeeds', async () => {
      const mockAxios = axios as jest.Mocked<typeof axios>;

      // Mock: debit succeeds (200)
      mockAxios.patch.mockImplementation((url: string) => {
        if (url.includes('debit')) {
          return Promise.resolve({ status: 200, data: {} });
        }
        // credit fails (422)
        if (url.includes('credit')) {
          const error = new Error('Credit failed');
          (error as any).response = { status: 422 };
          return Promise.reject(error);
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      // Mock database queries
      const sagaStateObj: SagaState = {
        current_step: SagaStep.COMPENSATION,
        debit_completed: true,
        credit_completed: false,
        compensation_completed: true,
        error: 'Credit failed: Error: Credit failed',
      };

      const mockTransfer: Transfer = {
        id: 'transfer-123',
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount,
        status: TransferStatus.FAILED,
        saga_state: JSON.stringify(sagaStateObj),
        error_message: 'Credit failed: Error: Credit failed',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      (pool.query as jest.Mock).mockResolvedValue({ rows: [mockTransfer] });

      const result = await saga.execute(fromAccountId, toAccountId, amount);

      // Assertions
      expect(result.status).toBe(TransferStatus.FAILED);

      const sagaState = JSON.parse(result.saga_state);
      expect(sagaState.debit_completed).toBe(true);
      expect(sagaState.credit_completed).toBe(false);
      expect(sagaState.compensation_completed).toBe(true);

      // Verify debit was called
      expect(mockAxios.patch).toHaveBeenCalledWith(
        expect.stringContaining('debit'),
        { amount }
      );

      // Verify credit was called
      expect(mockAxios.patch).toHaveBeenCalledWith(
        expect.stringContaining('credit'),
        { amount }
      );

      // Verify compensation was called
      const patchCalls = (mockAxios.patch as jest.Mock).mock.calls;
      const compensationCall = patchCalls.find((call) => call[0].includes('credit') && patchCalls.indexOf(call) > 0);
      expect(compensationCall).toBeDefined();
    });
  });

  describe('T085: Debit fails immediately - no compensation', () => {
    it('should not call compensation when debit fails', async () => {
      const mockAxios = axios as jest.Mocked<typeof axios>;

      // Mock: debit fails
      mockAxios.patch.mockImplementation((url: string) => {
        if (url.includes('debit')) {
          const error = new Error('Debit failed');
          (error as any).response = { status: 500 };
          return Promise.reject(error);
        }
        return Promise.reject(new Error('Credit should not be called'));
      });

      const sagaStateObj: SagaState = {
        current_step: SagaStep.DEBIT,
        debit_completed: false,
        credit_completed: false,
        compensation_completed: false,
        error: 'Debit failed: Error: Debit failed',
      };

      const mockTransfer: Transfer = {
        id: 'transfer-123',
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount,
        status: TransferStatus.FAILED,
        saga_state: JSON.stringify(sagaStateObj),
        error_message: 'Debit failed: Error: Debit failed',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      (pool.query as jest.Mock).mockResolvedValue({ rows: [mockTransfer] });

      const result = await saga.execute(fromAccountId, toAccountId, amount);

      expect(result.status).toBe(TransferStatus.FAILED);

      const sagaState = JSON.parse(result.saga_state);
      expect(sagaState.debit_completed).toBe(false);
      expect(sagaState.credit_completed).toBe(false);
      expect(sagaState.compensation_completed).toBe(false);

      // Credit should never be called
      const patchCalls = (mockAxios.patch as jest.Mock).mock.calls;
      const creditCalls = patchCalls.filter((call) => call[0].includes('credit'));
      expect(creditCalls.length).toBe(0);
    });
  });

  describe('T086: Happy path - all steps succeed', () => {
    it('should complete transfer successfully when all steps succeed', async () => {
      const mockAxios = axios as jest.Mocked<typeof axios>;

      // Mock: all calls succeed
      mockAxios.patch.mockResolvedValue({ status: 200, data: {} });

      const sagaStateObj: SagaState = {
        current_step: SagaStep.COMPLETED,
        debit_completed: true,
        credit_completed: true,
        compensation_completed: false,
        error: null,
      };

      const mockTransfer: Transfer = {
        id: 'transfer-123',
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount,
        status: TransferStatus.COMPLETED,
        saga_state: JSON.stringify(sagaStateObj),
        error_message: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      (pool.query as jest.Mock).mockResolvedValue({ rows: [mockTransfer] });

      const result = await saga.execute(fromAccountId, toAccountId, amount);

      expect(result.status).toBe(TransferStatus.COMPLETED);

      const sagaState = JSON.parse(result.saga_state);
      expect(sagaState.debit_completed).toBe(true);
      expect(sagaState.credit_completed).toBe(true);
      expect(sagaState.compensation_completed).toBe(false);
      expect(sagaState.error).toBeNull();
    });
  });

  describe('T087: Insufficient funds - debit fails with 422', () => {
    it('should return 422 error when debit fails with insufficient funds', async () => {
      const mockAxios = axios as jest.Mocked<typeof axios>;

      // Mock: debit fails with 422 (insufficient funds)
      mockAxios.patch.mockImplementation((url: string) => {
        if (url.includes('debit')) {
          const error = new Error('Insufficient funds');
          (error as any).response = { status: 422 };
          return Promise.reject(error);
        }
        return Promise.reject(new Error('Credit should not be called'));
      });

      const sagaStateObj: SagaState = {
        current_step: SagaStep.DEBIT,
        debit_completed: false,
        credit_completed: false,
        compensation_completed: false,
        error: 'Insufficient funds',
      };

      const mockTransfer: Transfer = {
        id: 'transfer-123',
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount,
        status: TransferStatus.FAILED,
        saga_state: JSON.stringify(sagaStateObj),
        error_message: 'Insufficient funds',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      (pool.query as jest.Mock).mockResolvedValue({ rows: [mockTransfer] });

      const result = await saga.execute(fromAccountId, toAccountId, amount);

      expect(result.status).toBe(TransferStatus.FAILED);

      const sagaState = JSON.parse(result.saga_state);
      expect(sagaState.error).toBe('Insufficient funds');
      expect(sagaState.debit_completed).toBe(false);
    });
  });

  describe('getTransferById', () => {
    it('should return transfer when found', async () => {
      const sagaStateObj: SagaState = {
        current_step: SagaStep.COMPLETED,
        debit_completed: true,
        credit_completed: true,
        compensation_completed: false,
        error: null,
      };

      const mockTransfer: Transfer = {
        id: 'transfer-123',
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount,
        status: TransferStatus.COMPLETED,
        saga_state: JSON.stringify(sagaStateObj),
        error_message: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      (pool.query as jest.Mock).mockResolvedValue({ rows: [mockTransfer] });

      const result = await saga.getTransferById('transfer-123');

      expect(result).toEqual(mockTransfer);
    });

    it('should return null when transfer not found', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await saga.getTransferById('non-existent-transfer');

      expect(result).toBeNull();
    });
  });
});
