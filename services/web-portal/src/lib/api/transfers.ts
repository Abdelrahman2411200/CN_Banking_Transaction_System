import { readStoredSession, type AuthSession } from "../../app/auth/session";
import { getApiBaseUrl } from "../env";
import { refreshAccessTokenForRetry } from "./auth";
import { jsonRequest, requestJson, type ApiRequestInit, type ApiResult } from "./client";

export type TransferStatus = "initiated" | "completed" | "failed" | "compensating" | "compensation_failed";
export type SagaStep = "create" | "debit" | "credit" | "compensation" | "completed";

export interface TransferSagaState {
  currentStep: SagaStep;
  debitCompleted: boolean;
  creditCompleted: boolean;
  compensationCompleted: boolean;
  error: string | null;
}

export interface TransferRecord {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  status: TransferStatus;
  sagaState: TransferSagaState;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
}

export interface TransferApiOptions {
  baseUrl?: string;
  idempotencyKey?: string;
  session?: AuthSession | null;
}

interface GatewayEnvelope<T> {
  success?: boolean;
  data?: T;
}

interface GatewaySagaState {
  current_step?: SagaStep;
  currentStep?: SagaStep;
  debit_completed?: boolean;
  debitCompleted?: boolean;
  credit_completed?: boolean;
  creditCompleted?: boolean;
  compensation_completed?: boolean;
  compensationCompleted?: boolean;
  error?: string | null;
}

interface GatewayTransfer {
  id?: string;
  from_account_id?: string;
  fromAccountId?: string;
  to_account_id?: string;
  toAccountId?: string;
  amount?: string | number;
  status?: TransferStatus;
  saga_state?: GatewaySagaState;
  sagaState?: GatewaySagaState;
  error_message?: string | null;
  errorMessage?: string | null;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

const transferUrl = (path: string, baseUrl = getApiBaseUrl()): string => `${baseUrl}/v1/transfers${path}`;

const authInit = (options: TransferApiOptions): ApiRequestInit => ({
  accessToken: () => options.session?.accessToken ?? readStoredSession()?.accessToken ?? null,
  refreshAccessToken: () => refreshAccessTokenForRetry({ baseUrl: options.baseUrl })
});

const hasDataProperty = (value: unknown): value is { data?: unknown } =>
  Boolean(value && typeof value === "object" && "data" in value);

const unwrapData = <T>(value: GatewayEnvelope<T> | T): T => {
  if (hasDataProperty(value) && value.data !== undefined) {
    return value.data as T;
  }

  return value as T;
};

export const generateIdempotencyKey = (): string => {
  const randomId =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(16).slice(2).padEnd(16, "0");

  return `tx_${randomId.replace(/-/g, "").slice(0, 24)}`;
};

const toSagaState = (state?: GatewaySagaState): TransferSagaState => ({
  currentStep: state?.currentStep ?? state?.current_step ?? "create",
  debitCompleted: state?.debitCompleted ?? state?.debit_completed ?? false,
  creditCompleted: state?.creditCompleted ?? state?.credit_completed ?? false,
  compensationCompleted: state?.compensationCompleted ?? state?.compensation_completed ?? false,
  error: state?.error ?? null
});

const toTransferRecord = (transfer: GatewayTransfer): TransferRecord => ({
  id: transfer.id ?? "",
  fromAccountId: transfer.fromAccountId ?? transfer.from_account_id ?? "",
  toAccountId: transfer.toAccountId ?? transfer.to_account_id ?? "",
  amount: String(transfer.amount ?? "0.00"),
  status: transfer.status ?? "initiated",
  sagaState: toSagaState(transfer.sagaState ?? transfer.saga_state),
  errorMessage: transfer.errorMessage ?? transfer.error_message ?? null,
  createdAt: transfer.createdAt ?? transfer.created_at ?? "",
  updatedAt: transfer.updatedAt ?? transfer.updated_at ?? ""
});

export const createTransfer = async (
  input: CreateTransferInput,
  options: TransferApiOptions = {}
): Promise<ApiResult<TransferRecord>> => {
  const idempotencyKey = options.idempotencyKey ?? generateIdempotencyKey();
  const result = await requestJson<GatewayEnvelope<GatewayTransfer>>(
    transferUrl("", options.baseUrl),
    {
      ...jsonRequest("POST", {
        amount: input.amount,
        from_account_id: input.fromAccountId,
        to_account_id: input.toAccountId
      }),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey
      },
      ...authInit(options)
    }
  );

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    status: result.status,
    data: toTransferRecord(unwrapData(result.data)),
    requestId: result.requestId
  };
};

export const getTransfer = async (
  transferId: string,
  options: TransferApiOptions = {}
): Promise<ApiResult<TransferRecord>> => {
  const result = await requestJson<GatewayEnvelope<GatewayTransfer>>(
    transferUrl(`/${transferId}`, options.baseUrl),
    authInit(options)
  );

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    status: result.status,
    data: toTransferRecord(unwrapData(result.data)),
    requestId: result.requestId
  };
};
