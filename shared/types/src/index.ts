// ─── Shared Base Types ──────────────────────────────────────

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string | {
    code: string;
    message: string;
  };
  message?: string;
}

// ─── Account ────────────────────────────────────────────────

export type KycStatus = 'pending' | 'verified' | 'rejected';
export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';

export interface Account {
  id: string;
  name: string;
  email: string;
  balance: number;
  kyc_status: KycStatus;
  status?: AccountStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateAccountDto {
  name: string;
  email: string;
  initial_balance?: number;
}

export interface UpdateKycDto {
  kyc_status: KycStatus;
}

// ─── Transfer ───────────────────────────────────────────────

export type TransferStatus =
  | 'initiated'
  | 'debited'
  | 'completed'
  | 'failed';

export interface Transfer {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  status: TransferStatus;
  saga_state: SagaState;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTransferDto {
  from_account_id: string;
  to_account_id: string;
  amount: number;
}

// ─── SAGA ───────────────────────────────────────────────────

export interface SagaState {
  current_step: 'debit' | 'credit' | 'compensate' | 'done';
  debit_completed: boolean;
  credit_completed: boolean;
  compensation_completed?: boolean;
  error?: string;
}
