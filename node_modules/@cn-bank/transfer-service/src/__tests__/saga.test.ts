/**
 * Unit Tests for TransferSaga — SAGA compensation logic.
 *
 * These tests mock:
 *   - axios (inter-service HTTP calls to account-service)
 *   - pg Pool (database queries)
 *
 * Key test: compensation fires correctly when credit step throws.
 */
import axios from 'axios';
import { TransferSaga } from '../saga';

// ─── Mocks ──────────────────────────────────────────────────
jest.mock('axios');
jest.mock('../db', () => {
  const mockQuery = jest.fn();
  return {
    __esModule: true,
    default: { query: mockQuery },
  };
});

const mockPool = require('../db').default;
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TransferSaga', () => {
  let saga: TransferSaga;
  let mockHttpClient: any;

  const fromAccountId = '11111111-1111-1111-1111-111111111111';
  const toAccountId   = '22222222-2222-2222-2222-222222222222';
  const amount = 100;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a mock HTTP client (injectable AxiosInstance)
    mockHttpClient = {
      patch: jest.fn(),
    };

    // Create a mock axios.create that returns our mockHttpClient
    mockedAxios.create.mockReturnValue(mockHttpClient as any);

    saga = new TransferSaga(mockHttpClient);

    // Default: createTransfer returns a transfer record
    mockPool.query.mockImplementation((sql: string, params?: any[]) => {
      if (sql.includes('INSERT INTO transfers')) {
        return {
          rows: [{
            id: 'transfer-001',
            from_account_id: fromAccountId,
            to_account_id: toAccountId,
            amount,
            status: 'initiated',
            saga_state: {
              current_step: 'debit',
              debit_completed: false,
              credit_completed: false,
            },
            error_message: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }],
        };
      }
      if (sql.includes('UPDATE transfers')) {
        const status = params?.[0];
        const sagaState = JSON.parse(params?.[1] as string);
        const errorMessage = params?.[2];
        return {
          rows: [{
            id: params?.[3],
            from_account_id: fromAccountId,
            to_account_id: toAccountId,
            amount,
            status,
            saga_state: sagaState,
            error_message: errorMessage,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }],
        };
      }
      return { rows: [] };
    });
  });

  // ─── Happy Path ─────────────────────────────────────────────
  test('happy-path: debit + credit succeed → status "completed"', async () => {
    // Both debit and credit succeed
    mockHttpClient.patch
      .mockResolvedValueOnce({ data: { success: true, data: { balance: 900 } } })  // debit
      .mockResolvedValueOnce({ data: { success: true, data: { balance: 1100 } } }); // credit

    const result = await saga.execute(fromAccountId, toAccountId, amount);

    expect(result.status).toBe('completed');
    expect(result.saga_state.debit_completed).toBe(true);
    expect(result.saga_state.credit_completed).toBe(true);
    expect(result.error_message).toBeNull();

    // Verify debit was called first, then credit
    expect(mockHttpClient.patch).toHaveBeenCalledTimes(2);
    expect(mockHttpClient.patch).toHaveBeenNthCalledWith(1, `/v1/accounts/${fromAccountId}/debit`, { amount });
    expect(mockHttpClient.patch).toHaveBeenNthCalledWith(2, `/v1/accounts/${toAccountId}/credit`, { amount });
  });

  // ─── Compensation Test (KEY requirement) ────────────────────
  test('compensation fires correctly when credit step throws', async () => {
    // Debit succeeds
    mockHttpClient.patch.mockResolvedValueOnce({
      data: { success: true, data: { balance: 900 } },
    });

    // Credit fails
    mockHttpClient.patch.mockRejectedValueOnce({
      response: { data: { error: 'Target account not found' } },
    });

    // Compensation (credit back to source) succeeds
    mockHttpClient.patch.mockResolvedValueOnce({
      data: { success: true, data: { balance: 1000 } },
    });

    const result = await saga.execute(fromAccountId, toAccountId, amount);

    // Transfer should be marked as failed
    expect(result.status).toBe('failed');
    expect(result.saga_state.debit_completed).toBe(true);
    expect(result.saga_state.credit_completed).toBe(false);
    expect(result.saga_state.compensation_completed).toBe(true);
    expect(result.error_message).toContain('Target account not found');

    // Verify 3 HTTP calls: debit, credit (failed), compensation (credit reversal)
    expect(mockHttpClient.patch).toHaveBeenCalledTimes(3);
    // 1st call: debit the source
    expect(mockHttpClient.patch).toHaveBeenNthCalledWith(1, `/v1/accounts/${fromAccountId}/debit`, { amount });
    // 2nd call: credit the target (this fails)
    expect(mockHttpClient.patch).toHaveBeenNthCalledWith(2, `/v1/accounts/${toAccountId}/credit`, { amount });
    // 3rd call: COMPENSATION — credit back to source account
    expect(mockHttpClient.patch).toHaveBeenNthCalledWith(3, `/v1/accounts/${fromAccountId}/credit`, { amount });
  });

  // ─── Debit Failure (no compensation needed) ─────────────────
  test('debit failure: insufficient funds → status "failed", no compensation', async () => {
    // Debit fails with insufficient funds
    mockHttpClient.patch.mockRejectedValueOnce({
      response: { data: { error: 'Insufficient funds' } },
    });

    const result = await saga.execute(fromAccountId, toAccountId, amount);

    expect(result.status).toBe('failed');
    expect(result.saga_state.debit_completed).toBe(false);
    expect(result.saga_state.credit_completed).toBe(false);
    expect(result.saga_state.compensation_completed).toBeUndefined();
    expect(result.error_message).toContain('Insufficient funds');

    // Only 1 HTTP call — no compensation needed
    expect(mockHttpClient.patch).toHaveBeenCalledTimes(1);
  });

  // ─── Compensation Failure ───────────────────────────────────
  test('compensation failure: both credit and reversal fail → records both errors', async () => {
    // Debit succeeds
    mockHttpClient.patch.mockResolvedValueOnce({
      data: { success: true, data: { balance: 900 } },
    });

    // Credit fails
    mockHttpClient.patch.mockRejectedValueOnce({
      response: { data: { error: 'Credit service down' } },
    });

    // Compensation also fails
    mockHttpClient.patch.mockRejectedValueOnce({
      response: { data: { error: 'Compensation service down' } },
    });

    const result = await saga.execute(fromAccountId, toAccountId, amount);

    expect(result.status).toBe('failed');
    expect(result.saga_state.debit_completed).toBe(true);
    expect(result.saga_state.compensation_completed).toBe(false);
    expect(result.error_message).toContain('Credit service down');
    expect(result.error_message).toContain('Compensation also failed');
  });
});
