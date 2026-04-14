import { readStoredSession, type AuthSession } from "../../app/auth/session";
import { getApiBaseUrl } from "../env";
import { refreshAccessTokenForRetry } from "./auth";
import { requestJson, type ApiRequestInit, type ApiResult } from "./client";

export type LedgerEntryType = "debit" | "credit";
export type LedgerEntryStatus = "completed" | "failed" | "reversed";

export interface LedgerEntry {
  entryId: string;
  transferId: string;
  accountId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  entryType: LedgerEntryType;
  status: LedgerEntryStatus;
  sourceEvent: string;
  createdAt: string;
}

export interface LedgerStats {
  totalDebits: number;
  totalCredits: number;
  net: number;
  entryCount: number;
}

export interface LedgerApiOptions {
  baseUrl?: string;
  session?: AuthSession | null;
}

interface GatewayEnvelope<T> {
  success?: boolean;
  data?: T;
}

interface DecimalJson {
  $numberDecimal?: string;
}

interface GatewayLedgerEntry {
  entryId?: string;
  entry_id?: string;
  transferId?: string;
  transfer_id?: string;
  accountId?: string;
  account_id?: string;
  fromAccountId?: string;
  from_account_id?: string;
  toAccountId?: string;
  to_account_id?: string;
  amount?: string | number | DecimalJson;
  entryType?: LedgerEntryType;
  entry_type?: LedgerEntryType;
  status?: LedgerEntryStatus;
  sourceEvent?: string;
  source_event?: string;
  createdAt?: string;
  created_at?: string;
}

interface GatewayLedgerStats extends Partial<LedgerStats> {
  data?: Partial<LedgerStats>;
}

const ledgerUrl = (path: string, baseUrl = getApiBaseUrl()): string => `${baseUrl}/v1/ledger${path}`;

const authInit = (options: LedgerApiOptions): ApiRequestInit => ({
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

const toAmountString = (amount: GatewayLedgerEntry["amount"]): string => {
  if (amount && typeof amount === "object" && "$numberDecimal" in amount) {
    return amount.$numberDecimal ?? "0.00";
  }

  if (typeof amount === "number" || typeof amount === "string") {
    return String(amount);
  }

  return "0.00";
};

const toLedgerEntry = (entry: GatewayLedgerEntry): LedgerEntry => ({
  entryId: entry.entryId ?? entry.entry_id ?? "",
  transferId: entry.transferId ?? entry.transfer_id ?? "",
  accountId: entry.accountId ?? entry.account_id ?? "",
  fromAccountId: entry.fromAccountId ?? entry.from_account_id ?? "",
  toAccountId: entry.toAccountId ?? entry.to_account_id ?? "",
  amount: toAmountString(entry.amount),
  entryType: entry.entryType ?? entry.entry_type ?? "debit",
  status: entry.status ?? "completed",
  sourceEvent: entry.sourceEvent ?? entry.source_event ?? "",
  createdAt: entry.createdAt ?? entry.created_at ?? ""
});

const toLedgerEntries = (entries: GatewayLedgerEntry[]): LedgerEntry[] =>
  entries.map(toLedgerEntry);

const toLedgerStats = (stats: GatewayLedgerStats): LedgerStats => {
  const payload = stats.data ?? stats;

  return {
    totalDebits: Number(payload.totalDebits ?? 0),
    totalCredits: Number(payload.totalCredits ?? 0),
    net: Number(payload.net ?? 0),
    entryCount: Number(payload.entryCount ?? 0)
  };
};

export const getAccountLedger = async (
  accountId: string,
  options: LedgerApiOptions = {}
): Promise<ApiResult<LedgerEntry[]>> => {
  const result = await requestJson<GatewayEnvelope<GatewayLedgerEntry[]> | GatewayLedgerEntry[]>(
    ledgerUrl(`/${accountId}`, options.baseUrl),
    authInit(options)
  );

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    status: result.status,
    data: toLedgerEntries(unwrapData(result.data)),
    requestId: result.requestId
  };
};

export const getTransferLedger = async (
  transferId: string,
  options: LedgerApiOptions = {}
): Promise<ApiResult<LedgerEntry[]>> => {
  const result = await requestJson<GatewayEnvelope<GatewayLedgerEntry[]> | GatewayLedgerEntry[]>(
    ledgerUrl(`/transfer/${transferId}`, options.baseUrl),
    authInit(options)
  );

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    status: result.status,
    data: toLedgerEntries(unwrapData(result.data)),
    requestId: result.requestId
  };
};

export const getLedgerStats = async (
  accountId: string,
  options: LedgerApiOptions = {}
): Promise<ApiResult<LedgerStats>> => {
  const result = await requestJson<GatewayLedgerStats>(
    ledgerUrl(`/stats/${accountId}`, options.baseUrl),
    authInit(options)
  );

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    status: result.status,
    data: toLedgerStats(result.data),
    requestId: result.requestId
  };
};
