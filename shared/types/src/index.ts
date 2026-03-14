export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export type AccountStatus = "ACTIVE" | "FROZEN" | "CLOSED";

export interface Account {
  id: string;
  customerId: string;
  accountNumber: string;
  currency: string;
  balance: string;
  status: AccountStatus;
  kycVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TransferStatus =
  | "INITIATED"
  | "DEBIT_PENDING"
  | "DEBITED"
  | "CREDIT_PENDING"
  | "COMPLETED"
  | "FAILED"
  | "COMPENSATED";

export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  currency: string;
  status: TransferStatus;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}
