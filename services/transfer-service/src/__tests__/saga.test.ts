import type { Pool, PoolClient } from 'pg';
import { TransferSaga } from '../saga';
import { enqueueOutboxEvent } from '../outbox';
import { KafkaTopics, SagaStep, TransferStatus } from '@cn-banking/shared-types';
import type { Transfer } from '@cn-banking/shared-types';

jest.mock('../outbox', () => ({
  enqueueOutboxEvent: jest.fn(),
  startOutboxPublisher: jest.fn(),
  stopOutboxPublisher: jest.fn(),
}));

describe('TransferSaga', () => {
  const fromAccountId = '123e4567-e89b-12d3-a456-426614174001';
  const toAccountId = '123e4567-e89b-12d3-a456-426614174002';
  const amount = '100.00';

  const buildPool = () => {
    const clientQuery = jest.fn();
    const client = {
      query: clientQuery,
      release: jest.fn(),
    } as unknown as PoolClient;

    const db = {
      connect: jest.fn().mockResolvedValue(client),
      query: jest.fn().mockResolvedValue(undefined),
    } as unknown as Pool;

    const httpClient = { patch: jest.fn() };
    const saga = new TransferSaga(db, httpClient);

    return { saga, db, client, clientQuery, httpClient };
  };

  const wireTransactionalQueries = (clientQuery: jest.Mock, updates: Transfer[]): void => {
    let updateIndex = 0;

    clientQuery.mockImplementation(async (queryText: string) => {
      if (queryText === 'BEGIN' || queryText === 'COMMIT' || queryText === 'ROLLBACK') {
        return undefined;
      }

      if (queryText.includes('INSERT INTO transfers')) {
        return { rows: [{ id: 'transfer-123' }] };
      }

      if (queryText.includes('RETURNING id, from_account_id')) {
        const next = updates[updateIndex];
        updateIndex += 1;
        return { rows: next ? [next] : [] };
      }

      return { rows: [] };
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queues a transfer initiated event when the saga starts', async () => {
    const { saga, client, clientQuery, httpClient } = buildPool();
    wireTransactionalQueries(clientQuery, [buildCompletedTransfer()]);
    httpClient.patch.mockResolvedValue({ status: 200, data: {} });

    await saga.execute(fromAccountId, toAccountId, amount);

    expect(enqueueOutboxEvent).toHaveBeenCalledWith(
      client,
      KafkaTopics.transferInitiated,
      'transfer-123',
      expect.objectContaining({
        transferId: 'transfer-123',
        fromAccountId,
        toAccountId,
        amount,
      })
    );
  });

  it('queues a transfer completed event after a successful saga', async () => {
    const { saga, client, clientQuery, httpClient } = buildPool();
    wireTransactionalQueries(clientQuery, [buildCompletedTransfer()]);
    httpClient.patch.mockResolvedValue({ status: 200, data: {} });

    const transfer = await saga.execute(fromAccountId, toAccountId, amount);

    expect(transfer.status).toBe(TransferStatus.COMPLETED);
    expect(enqueueOutboxEvent).toHaveBeenLastCalledWith(
      client,
      KafkaTopics.transferCompleted,
      'transfer-123',
      expect.objectContaining({
        transferId: 'transfer-123',
        completedAt: expect.any(String),
      })
    );
  });

  it('queues a failed event when debit fails', async () => {
    const { saga, client, clientQuery, httpClient } = buildPool();
    wireTransactionalQueries(clientQuery, [buildFailedTransfer('Insufficient funds', false)]);
    const debitError = Object.assign(new Error('Insufficient funds'), {
      response: { status: 422 },
    });
    httpClient.patch.mockRejectedValue(debitError);

    await expect(saga.execute(fromAccountId, toAccountId, amount)).rejects.toThrow('Insufficient funds');

    expect(enqueueOutboxEvent).toHaveBeenLastCalledWith(
      client,
      KafkaTopics.transferFailed,
      'transfer-123',
      expect.objectContaining({
        reason: 'Insufficient funds',
      })
    );
  });

  it('queues a failed event after compensation succeeds', async () => {
    const { saga, client, clientQuery, httpClient } = buildPool();
    wireTransactionalQueries(clientQuery, [
      buildCompensatingTransfer(),
      buildFailedTransfer('Credit failed', true),
    ]);

    httpClient.patch
      .mockResolvedValueOnce({ status: 200, data: {} })
      .mockRejectedValueOnce(new Error('Credit failed'))
      .mockResolvedValueOnce({ status: 200, data: {} });

    await expect(saga.execute(fromAccountId, toAccountId, amount)).rejects.toThrow('Credit failed');

    expect(enqueueOutboxEvent).toHaveBeenLastCalledWith(
      client,
      KafkaTopics.transferFailed,
      'transfer-123',
      expect.objectContaining({
        reason: 'Credit failed',
      })
    );
  });

  it('queues a failed event with combined error when compensation fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { saga, client, clientQuery, httpClient } = buildPool();
    wireTransactionalQueries(clientQuery, [
      buildCompensatingTransfer(),
      buildCompensationFailedTransfer(),
    ]);

    httpClient.patch
      .mockResolvedValueOnce({ status: 200, data: {} })
      .mockRejectedValueOnce(new Error('Credit failed'))
      .mockRejectedValueOnce(new Error('Compensation failed'));

    await expect(saga.execute(fromAccountId, toAccountId, amount)).rejects.toThrow('Credit failed');

    expect(enqueueOutboxEvent).toHaveBeenLastCalledWith(
      client,
      KafkaTopics.transferFailed,
      'transfer-123',
      expect.objectContaining({
        reason: 'Credit failed: Credit failed; compensation failed: Compensation failed',
      })
    );

    consoleSpy.mockRestore();
  });
});

const baseTransfer = (): Omit<Transfer, 'status' | 'saga_state' | 'error_message'> => ({
  id: 'transfer-123',
  from_account_id: '123e4567-e89b-12d3-a456-426614174001',
  to_account_id: '123e4567-e89b-12d3-a456-426614174002',
  amount: '100.00',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
});

const buildCompletedTransfer = (): Transfer => ({
  ...baseTransfer(),
  status: TransferStatus.COMPLETED,
  saga_state: {
    current_step: SagaStep.COMPLETED,
    debit_completed: true,
    credit_completed: true,
    compensation_completed: false,
    error: null,
  },
  error_message: null,
});

const buildCompensatingTransfer = (): Transfer => ({
  ...baseTransfer(),
  status: TransferStatus.COMPENSATING,
  saga_state: {
    current_step: SagaStep.COMPENSATION,
    debit_completed: true,
    credit_completed: false,
    compensation_completed: false,
    error: 'Credit failed',
  },
  error_message: 'Credit failed',
});

const buildFailedTransfer = (reason: string, compensated: boolean): Transfer => ({
  ...baseTransfer(),
  status: TransferStatus.FAILED,
  saga_state: {
    current_step: compensated ? SagaStep.COMPENSATION : SagaStep.DEBIT,
    debit_completed: compensated,
    credit_completed: false,
    compensation_completed: compensated,
    error: reason,
  },
  error_message: reason,
});

const buildCompensationFailedTransfer = (): Transfer => ({
  ...baseTransfer(),
  status: TransferStatus.COMPENSATION_FAILED,
  saga_state: {
    current_step: SagaStep.COMPENSATION,
    debit_completed: true,
    credit_completed: false,
    compensation_completed: false,
    error: 'Credit failed: Credit failed; compensation failed: Compensation failed',
  },
  error_message: 'Credit failed: Credit failed; compensation failed: Compensation failed',
});
