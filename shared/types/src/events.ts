/**
 * Phase 2 Asynchronous Event Contracts
 * Namespace: bank.*
 */

export interface BankEvent<T> {
  specversion: string;
  type: string;
  source: string;
  id: string;
  time: string;
  datacontenttype: string;
  data: T;
}

export interface AccountCreatedData {
  accountId: string;
  email: string;
  name: string;
  initialBalance: number;
  timestamp: string;
}

export interface TransferInitiatedData {
  transferId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  timestamp: string;
}

export interface TransferCompletedData {
  transferId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  timestamp: string;
}

export interface TransferFailedData {
  transferId: string;
  error: string;
  reason: string;
  timestamp: string;
}

export interface FraudAlertData {
  alertId: string;
  transferId: string;
  accountId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  ruleTriggered: string;
  timestamp: string;
}

// Event Types Map
export const EVENT_TYPES = {
  ACCOUNT_CREATED: 'bank.account.created',
  TRANSFER_INITIATED: 'bank.transfer.initiated',
  TRANSFER_COMPLETED: 'bank.transfer.completed',
  TRANSFER_FAILED: 'bank.transfer.failed',
  FRAUD_ALERT: 'bank.fraud.alert',
} as const;
