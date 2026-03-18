import { z } from 'zod';

export * from './events';

// Enums
export enum AccountKycStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export enum AccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum TransferStatus {
  INITIATED = 'initiated',
  COMPLETED = 'completed',
  FAILED = 'failed',
  COMPENSATING = 'compensating',
}

export enum SagaStep {
  CREATE = 'create',
  DEBIT = 'debit',
  CREDIT = 'credit',
  COMPENSATION = 'compensation',
  COMPLETED = 'completed',
}

// Domain Models
export interface Account {
  id: string;
  name: string;
  email: string;
  balance: string; // NUMERIC 18,2 in DB, represented as string
  kyc_status: AccountKycStatus;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
}

export interface Transfer {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: string; // NUMERIC 18,2 in DB, represented as string
  status: TransferStatus;
  saga_state: string; // JSON stringified SagaState
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface SagaState {
  current_step: SagaStep;
  debit_completed: boolean;
  credit_completed: boolean;
  compensation_completed: boolean;
  error: string | null;
}

// DTOs - Request/Response
export interface CreateAccountRequest {
  name: string;
  email: string;
  initial_balance?: string;
}

export interface CreateAccountResponse {
  success: boolean;
  data: Account;
}

export interface GetAccountResponse {
  success: boolean;
  data: Account | null;
}

export interface GetAccountBalanceResponse {
  success: boolean;
  data: {
    id: string;
    balance: string;
  };
}

export interface UpdateKycStatusRequest {
  kyc_status: AccountKycStatus;
}

export interface UpdateAccountResponse {
  success: boolean;
  data: Account;
}

export interface DebitAccountRequest {
  amount: string;
}

export interface CreditAccountRequest {
  amount: string;
}

export interface CreateTransferRequest {
  from_account_id: string;
  to_account_id: string;
  amount: string;
}

export interface CreateTransferResponse {
  success: boolean;
  data: Transfer;
}

export interface GetTransferResponse {
  success: boolean;
  data: Transfer | null;
}

export interface ErrorResponse {
  success: boolean;
  error: {
    code: string;
    message: string;
  };
}

export interface HealthResponse {
  success: boolean;
  data: {
    status: string;
  };
}

// Zod Schemas for validation
export const CreateAccountSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  initial_balance: z.string().optional(),
});

export const UpdateKycStatusSchema = z.object({
  kyc_status: z.enum(['pending', 'verified', 'rejected']),
});

export const DebitAccountSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export const CreditAccountSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export const CreateTransferSchema = z.object({
  from_account_id: z.string().uuid(),
  to_account_id: z.string().uuid(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
}).refine(
  (data) => data.from_account_id !== data.to_account_id,
  {
    message: 'from_account_id and to_account_id must be different',
    path: ['from_account_id'],
  }
);
