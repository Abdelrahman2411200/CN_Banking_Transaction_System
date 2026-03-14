import axios, { AxiosInstance } from 'axios';
import pool from './db';
import type { Transfer, SagaState, ApiResponse, Account } from '@cn-bank/types';

const ACCOUNT_SERVICE_URL = process.env.ACCOUNT_SERVICE_URL || 'http://localhost:3001';

/**
 * SAGA State Machine for bank transfers.
 *
 * States: INITIATED → DEBITED → COMPLETED
 *                  ↘ FAILED (with compensation if needed)
 *
 * Steps:
 *   1. Create transfer record (status: initiated)
 *   2. Debit source account via account-service
 *   3. Credit target account via account-service
 *   4. If credit fails after debit → compensate (reverse debit)
 */
export class TransferSaga {
  private httpClient: AxiosInstance;

  constructor(httpClient?: AxiosInstance) {
    this.httpClient = httpClient || axios.create({
      baseURL: ACCOUNT_SERVICE_URL,
      timeout: 10000,
    });
  }

  /**
   * Execute the full transfer SAGA.
   */
  async execute(
    fromAccountId: string,
    toAccountId: string,
    amount: number,
  ): Promise<Transfer> {
    // Step 0: Create the transfer record
    let transfer = await this.createTransfer(fromAccountId, toAccountId, amount);

    try {
      // Step 1: Debit source account
      await this.debitAccount(fromAccountId, amount);
      transfer = await this.updateTransferState(transfer.id, 'debited', {
        current_step: 'credit',
        debit_completed: true,
        credit_completed: false,
      });

      // Step 2: Credit target account
      await this.creditAccount(toAccountId, amount);
      transfer = await this.updateTransferState(transfer.id, 'completed', {
        current_step: 'done',
        debit_completed: true,
        credit_completed: true,
      });

      return transfer;
    } catch (error: any) {
      return this.handleFailure(transfer, error);
    }
  }

  /**
   * Handle SAGA failure — run compensation if debit already happened.
   */
  private async handleFailure(transfer: Transfer, error: any): Promise<Transfer> {
    const currentState = transfer.saga_state;
    const errorMessage = error.response?.data?.error || error.message || 'Unknown error';

    // If debit was completed, we need to compensate (reverse the debit)
    if (currentState.debit_completed) {
      try {
        await this.creditAccount(transfer.from_account_id, transfer.amount);

        return await this.updateTransferState(transfer.id, 'failed', {
          current_step: 'done',
          debit_completed: true,
          credit_completed: false,
          compensation_completed: true,
          error: errorMessage,
        }, errorMessage);
      } catch (compensationError: any) {
        // Compensation itself failed — critical issue, log it
        const compErrorMsg = compensationError.response?.data?.error || compensationError.message;
        console.error(
          `[transfer-service] CRITICAL: Compensation failed for transfer ${transfer.id}:`,
          compErrorMsg,
        );

        return await this.updateTransferState(transfer.id, 'failed', {
          current_step: 'done',
          debit_completed: true,
          credit_completed: false,
          compensation_completed: false,
          error: `${errorMessage}; Compensation also failed: ${compErrorMsg}`,
        }, `${errorMessage}; Compensation also failed: ${compErrorMsg}`);
      }
    }

    // Debit never happened, just mark as failed
    return await this.updateTransferState(transfer.id, 'failed', {
      current_step: 'done',
      debit_completed: false,
      credit_completed: false,
      error: errorMessage,
    }, errorMessage);
  }

  // ─── Private helpers ─────────────────────────────────────────

  private async createTransfer(
    fromAccountId: string,
    toAccountId: string,
    amount: number,
  ): Promise<Transfer> {
    const initialState: SagaState = {
      current_step: 'debit',
      debit_completed: false,
      credit_completed: false,
    };

    const result = await pool.query<Transfer>(
      `INSERT INTO transfers (from_account_id, to_account_id, amount, status, saga_state)
       VALUES ($1, $2, $3, 'initiated', $4)
       RETURNING *`,
      [fromAccountId, toAccountId, amount, JSON.stringify(initialState)],
    );

    return result.rows[0];
  }

  private async updateTransferState(
    transferId: string,
    status: string,
    sagaState: SagaState,
    errorMessage?: string,
  ): Promise<Transfer> {
    const result = await pool.query<Transfer>(
      `UPDATE transfers
       SET status = $1, saga_state = $2, error_message = $3
       WHERE id = $4
       RETURNING *`,
      [status, JSON.stringify(sagaState), errorMessage || null, transferId],
    );

    return result.rows[0];
  }

  private async debitAccount(accountId: string, amount: number): Promise<void> {
    const response = await this.httpClient.patch<ApiResponse<Account>>(
      `/v1/accounts/${accountId}/debit`,
      { amount },
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Debit failed');
    }
  }

  private async creditAccount(accountId: string, amount: number): Promise<void> {
    const response = await this.httpClient.patch<ApiResponse<Account>>(
      `/v1/accounts/${accountId}/credit`,
      { amount },
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Credit failed');
    }
  }
}

export default TransferSaga;
