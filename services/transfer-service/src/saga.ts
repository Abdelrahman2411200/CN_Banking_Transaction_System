import axios from 'axios';
import type { AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { pool } from './db';
import {
  TransferStatus,
  SagaStep,
} from '@cn-banking/shared-types';
import type {
  Transfer,
  SagaState,
} from '@cn-banking/shared-types';

const ACCOUNT_SERVICE_URL = process.env.ACCOUNT_SERVICE_URL || 'http://localhost:3001';

export class TransferSaga {
  async execute(
    fromAccountId: string,
    toAccountId: string,
    amount: string
  ): Promise<Transfer> {
    const transferId = uuidv4();
    const now = new Date().toISOString();

    // Initialize transfer with INITIATED status
    const sagaState: SagaState = {
      current_step: SagaStep.CREATE,
      debit_completed: false,
      credit_completed: false,
      compensation_completed: false,
      error: null,
    };

    const createQuery = `
      INSERT INTO transfers (id, from_account_id, to_account_id, amount, status, saga_state, error_message, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, from_account_id, to_account_id, amount, status, saga_state, error_message, created_at, updated_at
    `;

    await pool.query(createQuery, [
      transferId,
      fromAccountId,
      toAccountId,
      amount,
      TransferStatus.INITIATED,
      JSON.stringify(sagaState),
      null,
      now,
      now,
    ]);

    try {
      // Step 1: Debit from source account
      sagaState.current_step = SagaStep.DEBIT;
      await this.updateSagaState(transferId, sagaState);

      try {
        await axios.patch(`${ACCOUNT_SERVICE_URL}/v1/accounts/${fromAccountId}/debit`, {
          amount,
        });
        sagaState.debit_completed = true;
      } catch (error: any) {
        const statusCode = (error as AxiosError)?.response?.status;
        if (statusCode === 422) {
          sagaState.error = 'Insufficient funds';
        } else {
          sagaState.error = `Debit failed: ${error.message}`;
        }
        throw error;
      }

      // Step 2: Credit to destination account
      sagaState.current_step = SagaStep.CREDIT;
      await this.updateSagaState(transferId, sagaState);

      try {
        await axios.patch(`${ACCOUNT_SERVICE_URL}/v1/accounts/${toAccountId}/credit`, {
          amount,
        });
        sagaState.credit_completed = true;
      } catch (error: any) {
        sagaState.error = `Credit failed: ${error.message}`;
        throw error;
      }

      // Success: Mark transfer as completed
      sagaState.current_step = SagaStep.COMPLETED;
      const updateQuery = `
        UPDATE transfers
        SET status = $1, saga_state = $2, updated_at = $3
        WHERE id = $4
        RETURNING id, from_account_id, to_account_id, amount, status, saga_state, error_message, created_at, updated_at
      `;

      const result = await pool.query(updateQuery, [
        TransferStatus.COMPLETED,
        JSON.stringify(sagaState),
        new Date().toISOString(),
        transferId,
      ]);

      return result.rows[0];
    } catch (originalError: any) {
      // Compensation: Reverse debit if it was completed
      if (sagaState.debit_completed && !sagaState.compensation_completed) {
        sagaState.current_step = SagaStep.COMPENSATION;
        await this.updateSagaState(transferId, sagaState);

        try {
          await axios.patch(`${ACCOUNT_SERVICE_URL}/v1/accounts/${fromAccountId}/credit`, {
            amount,
          });
          sagaState.compensation_completed = true;
        } catch (compensationError: any) {
          console.error('Compensation failed:', compensationError);
          sagaState.error = `Compensation failed: ${compensationError.message}`;
        }
      }

      // Mark transfer as failed
      const updateQuery = `
        UPDATE transfers
        SET status = $1, saga_state = $2, error_message = $3, updated_at = $4
        WHERE id = $5
        RETURNING id, from_account_id, to_account_id, amount, status, saga_state, error_message, created_at, updated_at
      `;

      await pool.query(updateQuery, [
        TransferStatus.FAILED,
        JSON.stringify(sagaState),
        sagaState.error,
        new Date().toISOString(),
        transferId,
      ]);

      // Re-throw so the route can determine the correct HTTP status code
      throw originalError;
    }
  }

  async getTransferById(transferId: string): Promise<Transfer | null> {
    const query = `
      SELECT id, from_account_id, to_account_id, amount, status, saga_state, error_message, created_at, updated_at
      FROM transfers
      WHERE id = $1
    `;

    const result = await pool.query(query, [transferId]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  private async updateSagaState(transferId: string, sagaState: SagaState): Promise<void> {
    const query = `
      UPDATE transfers
      SET saga_state = $1, updated_at = $2
      WHERE id = $3
    `;

    await pool.query(query, [
      JSON.stringify(sagaState),
      new Date().toISOString(),
      transferId,
    ]);
  }
}
