import axios from 'axios';
import { MongoServerError } from 'mongodb';
import { processLedgerEvent } from '../consumer';
import { getDatabase } from '../mongo';
import { KafkaTopics, SagaStep, TransferStatus } from '@cn-banking/shared-types';
import type { Transfer } from '@cn-banking/shared-types';

jest.mock('axios');
jest.mock('../mongo', () => ({
  getDatabase: jest.fn(),
}));

describe('ledger consumer', () => {
  const mockAxios = axios as jest.Mocked<typeof axios>;
  const mockCollection = {
    updateOne: jest.fn(),
    createIndex: jest.fn(),
  };
  const mockDb = {
    collection: jest.fn().mockReturnValue(mockCollection),
  };

  const buildCompletedPayload = () => ({
    topic: KafkaTopics.transferCompleted,
    partition: 0,
    message: {
      offset: '10',
      value: Buffer.from(
        JSON.stringify({
          eventId: '123e4567-e89b-12d3-a456-426614174300',
          eventType: KafkaTopics.transferCompleted,
          timestamp: '2025-01-01T00:00:00.000Z',
          version: 'v1',
          transferId: '123e4567-e89b-12d3-a456-426614174301',
          fromAccountId: '123e4567-e89b-12d3-a456-426614174302',
          toAccountId: '123e4567-e89b-12d3-a456-426614174303',
          amount: '250.00',
          completedAt: '2025-01-01T00:00:01.000Z',
        })
      ),
    },
  });

  const buildFailedPayload = () => ({
    topic: KafkaTopics.transferFailed,
    partition: 1,
    message: {
      offset: '20',
      value: Buffer.from(
        JSON.stringify({
          eventId: '123e4567-e89b-12d3-a456-426614174310',
          eventType: KafkaTopics.transferFailed,
          timestamp: '2025-01-01T00:00:00.000Z',
          version: 'v1',
          transferId: '123e4567-e89b-12d3-a456-426614174311',
          fromAccountId: '123e4567-e89b-12d3-a456-426614174312',
          toAccountId: '123e4567-e89b-12d3-a456-426614174313',
          amount: '75.00',
          reason: 'Credit failed',
        })
      ),
    },
  });

  const buildTransfer = (
    overrides: Partial<Transfer> = {}
  ): Transfer => ({
    id: '123e4567-e89b-12d3-a456-426614174311',
    from_account_id: '123e4567-e89b-12d3-a456-426614174312',
    to_account_id: '123e4567-e89b-12d3-a456-426614174313',
    amount: '75.00',
    status: TransferStatus.FAILED,
    saga_state: {
      current_step: SagaStep.COMPENSATION,
      debit_completed: true,
      credit_completed: false,
      compensation_completed: true,
      error: 'Credit failed',
    },
    error_message: 'Credit failed',
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    mockCollection.updateOne.mockResolvedValue(undefined);
  });

  it('creates debit and credit entries for completed transfer events', async () => {
    await processLedgerEvent(buildCompletedPayload() as never);

    expect(mockCollection.updateOne).toHaveBeenCalledTimes(2);
    expect(mockCollection.updateOne).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ entryId: expect.any(String) }),
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          entryType: 'debit',
          status: 'completed',
          transferId: '123e4567-e89b-12d3-a456-426614174301',
        }),
      }),
      { upsert: true }
    );
    expect(mockCollection.updateOne).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ entryId: expect.any(String) }),
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          entryType: 'credit',
          status: 'completed',
          transferId: '123e4567-e89b-12d3-a456-426614174301',
        }),
      }),
      { upsert: true }
    );
  });

  it('creates reversed entries for failed transfers when debit completed', async () => {
    mockAxios.get.mockResolvedValue({ data: { data: buildTransfer() } });

    await processLedgerEvent(buildFailedPayload() as never);

    expect(mockCollection.updateOne).toHaveBeenCalledTimes(2);
    expect(mockCollection.updateOne).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          entryType: 'debit',
          status: 'reversed',
        }),
      }),
      { upsert: true }
    );
    expect(mockCollection.updateOne).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          entryType: 'credit',
          status: 'reversed',
        }),
      }),
      { upsert: true }
    );
  });

  it('skips failed transfers when debit never completed', async () => {
    mockAxios.get.mockResolvedValue({
      data: {
        data: buildTransfer({
          saga_state: {
            current_step: SagaStep.DEBIT,
            debit_completed: false,
            credit_completed: false,
            compensation_completed: false,
            error: 'Insufficient funds',
          },
          status: TransferStatus.FAILED,
          error_message: 'Insufficient funds',
        }),
      },
    });

    await processLedgerEvent(buildFailedPayload() as never);

    expect(mockCollection.updateOne).not.toHaveBeenCalled();
  });

  it('silently skips duplicate entry ids', async () => {
    mockCollection.updateOne
      .mockRejectedValueOnce(
        new MongoServerError({ message: 'duplicate', errmsg: 'duplicate', code: 11000 } as never)
      )
      .mockResolvedValueOnce(undefined);

    await expect(processLedgerEvent(buildCompletedPayload() as never)).resolves.toBeUndefined();
    expect(mockCollection.updateOne).toHaveBeenCalledTimes(2);
  });
});

