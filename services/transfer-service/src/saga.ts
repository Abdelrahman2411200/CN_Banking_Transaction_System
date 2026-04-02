import axios, { isAxiosError } from 'axios';
import type { Pool } from 'pg';
import { pool } from './db';
import { enqueueOutboxEvent } from './outbox';
import { KafkaTopics, SagaStep, TransferStatus } from '@cn-banking/shared-types';
import type {
  SupportedEvent,
  SagaState,
  Transfer,
  TransferCompletedEvent,
  TransferFailedEvent,
  TransferInitiatedEvent,
} from '@cn-banking/shared-types';
import { buildBaseEvent } from '@cn-banking/shared-types';

const ACCOUNT_SERVICE_URL = process.env.ACCOUNT_SERVICE_URL || 'http://localhost:3001';

type HttpClient = Pick<typeof axios, 'patch'>;

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
};

export class TransferSaga {
  constructor(
    private readonly db: Pool = pool,
    private readonly httpClient: HttpClient = axios
  ) {}

  async execute(
    fromAccountId: string,
    toAccountId: string,
    amount: string
  ): Promise<Transfer> {
    const sagaState: SagaState = {
      current_step: SagaStep.CREATE,
      debit_completed: false,
      credit_completed: false,
      compensation_completed: false,
      error: null,
    };

    const transferId = await this.createTransferRecord(fromAccountId, toAccountId, amount, sagaState);

    try {
      sagaState.current_step = SagaStep.DEBIT;
      await this.updateSagaState(transferId, sagaState);

      await this.httpClient.patch(`${ACCOUNT_SERVICE_URL}/v1/accounts/${fromAccountId}/debit`, {
        amount,
      });
      sagaState.debit_completed = true;

      sagaState.current_step = SagaStep.CREDIT;
      await this.updateSagaState(transferId, sagaState);

      await this.httpClient.patch(`${ACCOUNT_SERVICE_URL}/v1/accounts/${toAccountId}/credit`, {
        amount,
      });
      sagaState.credit_completed = true;
      sagaState.current_step = SagaStep.COMPLETED;

      const completedAt = new Date().toISOString();
      const completedEvent: TransferCompletedEvent = {
        ...buildBaseEvent(KafkaTopics.transferCompleted),
        transferId,
        fromAccountId,
        toAccountId,
        amount,
        completedAt,
      };

      const completedTransfer = await this.updateTransferState(
        transferId,
        TransferStatus.COMPLETED,
        sagaState,
        null,
        completedEvent
      );

      if (!completedTransfer) {
        throw new Error('Failed to persist completed transfer state');
      }

      return completedTransfer;
    } catch (error: unknown) {
      const originalErrorMessage = isAxiosError(error) && error.response?.status === 422
        ? 'Insufficient funds'
        : getErrorMessage(error);

      sagaState.error = originalErrorMessage;

      if (!sagaState.debit_completed) {
        const failedEvent = this.buildFailedEvent(
          transferId,
          fromAccountId,
          toAccountId,
          amount,
          originalErrorMessage
        );

        await this.updateTransferState(
          transferId,
          TransferStatus.FAILED,
          sagaState,
          originalErrorMessage,
          failedEvent
        );
        throw error;
      }

      sagaState.current_step = SagaStep.COMPENSATION;
      await this.updateTransferState(
        transferId,
        TransferStatus.COMPENSATING,
        sagaState,
        originalErrorMessage
      );

      try {
        await this.httpClient.patch(`${ACCOUNT_SERVICE_URL}/v1/accounts/${fromAccountId}/credit`, {
          amount,
        });
        sagaState.compensation_completed = true;

        const failedEvent = this.buildFailedEvent(
          transferId,
          fromAccountId,
          toAccountId,
          amount,
          originalErrorMessage
        );

        await this.updateTransferState(
          transferId,
          TransferStatus.FAILED,
          sagaState,
          originalErrorMessage,
          failedEvent
        );
      } catch (compensationError: unknown) {
        const combinedErrorMessage =
          `Credit failed: ${originalErrorMessage}; compensation failed: ${getErrorMessage(compensationError)}`;

        console.error('Compensation failed:', compensationError);
        sagaState.error = combinedErrorMessage;

        const failedEvent = this.buildFailedEvent(
          transferId,
          fromAccountId,
          toAccountId,
          amount,
          combinedErrorMessage
        );

        await this.updateTransferState(
          transferId,
          TransferStatus.COMPENSATION_FAILED,
          sagaState,
          combinedErrorMessage,
          failedEvent
        );
      }

      throw error;
    }
  }

  async getTransferById(transferId: string): Promise<Transfer | null> {
    const result = await this.db.query<Transfer>(
      `
        SELECT id, from_account_id, to_account_id, amount, status, saga_state, error_message, created_at, updated_at
        FROM transfers
        WHERE id = $1
      `,
      [transferId]
    );

    return result.rows[0] ?? null;
  }

  private async createTransferRecord(
    fromAccountId: string,
    toAccountId: string,
    amount: string,
    sagaState: SagaState
  ): Promise<string> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const createResult = await client.query<{ id: string }>(
        `
          INSERT INTO transfers (from_account_id, to_account_id, amount, status, saga_state, error_message)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `,
        [
          fromAccountId,
          toAccountId,
          amount,
          TransferStatus.INITIATED,
          JSON.stringify(sagaState),
          null,
        ]
      );

      const createdTransfer = createResult.rows[0];
      if (!createdTransfer) {
        throw new Error('Failed to create transfer record');
      }

      const initiatedEvent: TransferInitiatedEvent = {
        ...buildBaseEvent(KafkaTopics.transferInitiated),
        transferId: createdTransfer.id,
        fromAccountId,
        toAccountId,
        amount,
      };

      await enqueueOutboxEvent(
        client,
        KafkaTopics.transferInitiated,
        createdTransfer.id,
        initiatedEvent
      );

      await client.query('COMMIT');
      return createdTransfer.id;
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private buildFailedEvent(
    transferId: string,
    fromAccountId: string,
    toAccountId: string,
    amount: string,
    reason: string
  ): TransferFailedEvent {
    return {
      ...buildBaseEvent(KafkaTopics.transferFailed),
      transferId,
      fromAccountId,
      toAccountId,
      amount,
      reason,
    };
  }

  private async updateSagaState(transferId: string, sagaState: SagaState): Promise<void> {
    await this.db.query(
      `
        UPDATE transfers
        SET saga_state = $1
        WHERE id = $2
      `,
      [JSON.stringify(sagaState), transferId]
    );
  }

  private async updateTransferState(
    transferId: string,
    status: TransferStatus,
    sagaState: SagaState,
    errorMessage: string | null,
    event?: SupportedEvent
  ): Promise<Transfer | null> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query<Transfer>(
        `
          UPDATE transfers
          SET status = $1, saga_state = $2, error_message = $3
          WHERE id = $4
          RETURNING id, from_account_id, to_account_id, amount, status, saga_state, error_message, created_at, updated_at
        `,
        [status, JSON.stringify(sagaState), errorMessage, transferId]
      );

      const transfer = result.rows[0] ?? null;

      if (transfer && event) {
        const topic = event.eventType;
        await enqueueOutboxEvent(client, topic, transferId, event);
      }

      await client.query('COMMIT');
      return transfer;
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
