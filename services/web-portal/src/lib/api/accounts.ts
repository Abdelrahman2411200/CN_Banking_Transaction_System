import { readStoredSession, type AuthSession } from "../../app/auth/session";
import { getApiBaseUrl } from "../env";
import { refreshAccessTokenForRetry } from "./auth";
import { jsonRequest, requestJson, type ApiRequestInit, type ApiResult } from "./client";

export type AccountKycStatus = "pending" | "verified" | "rejected";
export type AccountStatus = "active" | "inactive" | "suspended";

export interface AccountRecord {
  id: string;
  name: string;
  email: string;
  balance: string;
  kycStatus: AccountKycStatus;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AccountBalance {
  id: string;
  balance: string;
}

export interface CreateAccountInput {
  name: string;
  email: string;
  initialBalance: string;
}

export interface UpdateAccountKycInput {
  accountId: string;
  kycStatus: AccountKycStatus;
}

export interface AccountApiOptions {
  baseUrl?: string;
  session?: AuthSession | null;
}

interface GatewayEnvelope<T> {
  success?: boolean;
  data?: T;
}

interface GatewayAccount {
  id?: string;
  name?: string;
  email?: string;
  balance?: string | number;
  kyc_status?: AccountKycStatus;
  kycStatus?: AccountKycStatus;
  status?: AccountStatus;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

interface GatewayBalance {
  id?: string;
  balance?: string | number;
}

const accountUrl = (path: string, baseUrl = getApiBaseUrl()): string => `${baseUrl}/v1/accounts${path}`;

const authInit = (options: AccountApiOptions): ApiRequestInit => ({
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

const toAccountRecord = (account: GatewayAccount): AccountRecord => ({
  id: account.id ?? "",
  name: account.name ?? "",
  email: account.email ?? "",
  balance: String(account.balance ?? "0.00"),
  kycStatus: account.kycStatus ?? account.kyc_status ?? "pending",
  status: account.status ?? "active",
  createdAt: account.createdAt ?? account.created_at ?? "",
  updatedAt: account.updatedAt ?? account.updated_at ?? ""
});

const toAccountBalance = (balance: GatewayBalance): AccountBalance => ({
  id: balance.id ?? "",
  balance: String(balance.balance ?? "0.00")
});

export const createAccount = async (
  input: CreateAccountInput,
  options: AccountApiOptions = {}
): Promise<ApiResult<AccountRecord>> => {
  const result = await requestJson<GatewayEnvelope<GatewayAccount>>(
    accountUrl("", options.baseUrl),
    {
      ...jsonRequest("POST", {
        email: input.email,
        initial_balance: input.initialBalance,
        name: input.name
      }),
      ...authInit(options)
    }
  );

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    status: result.status,
    data: toAccountRecord(unwrapData(result.data)),
    requestId: result.requestId
  };
};

export const getAccount = async (
  accountId: string,
  options: AccountApiOptions = {}
): Promise<ApiResult<AccountRecord>> => {
  const result = await requestJson<GatewayEnvelope<GatewayAccount>>(
    accountUrl(`/${accountId}`, options.baseUrl),
    authInit(options)
  );

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    status: result.status,
    data: toAccountRecord(unwrapData(result.data)),
    requestId: result.requestId
  };
};

export const getAccountBalance = async (
  accountId: string,
  options: AccountApiOptions = {}
): Promise<ApiResult<AccountBalance>> => {
  const result = await requestJson<GatewayEnvelope<GatewayBalance>>(
    accountUrl(`/${accountId}/balance`, options.baseUrl),
    authInit(options)
  );

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    status: result.status,
    data: toAccountBalance(unwrapData(result.data)),
    requestId: result.requestId
  };
};

export const updateAccountKyc = async (
  input: UpdateAccountKycInput,
  options: AccountApiOptions = {}
): Promise<ApiResult<AccountRecord>> => {
  const result = await requestJson<GatewayEnvelope<GatewayAccount>>(
    accountUrl(`/${input.accountId}/kyc`, options.baseUrl),
    {
      ...jsonRequest("PATCH", { kyc_status: input.kycStatus }),
      ...authInit(options)
    }
  );

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    status: result.status,
    data: toAccountRecord(unwrapData(result.data)),
    requestId: result.requestId
  };
};

export const freezeAccount = async (
  accountId: string,
  options: AccountApiOptions = {}
): Promise<ApiResult<AccountRecord>> => {
  const result = await requestJson<GatewayEnvelope<GatewayAccount>>(
    accountUrl(`/${accountId}/freeze`, options.baseUrl),
    {
      ...jsonRequest("POST"),
      ...authInit(options)
    }
  );

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    status: result.status,
    data: toAccountRecord(unwrapData(result.data)),
    requestId: result.requestId
  };
};
