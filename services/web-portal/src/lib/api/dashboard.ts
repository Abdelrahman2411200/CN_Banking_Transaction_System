import type { AuthSession, UserRole } from "../../app/auth/session";
import { readStoredSession } from "../../app/auth/session";
import { getApiBaseUrl } from "../env";
import { refreshAccessTokenForRetry } from "./auth";
import { requestJson, type ApiRequestInit, type ApiFailure, type ApiResult } from "./client";
import { getGatewayHealth, type GatewayHealthState } from "./health";

export type DashboardDataSource = "gateway" | "mock-fallback";
export type DashboardHealthStatus = GatewayHealthState["status"];

export interface DashboardAccount {
  id: string;
  name: string;
  email: string;
  balance: string;
  kycStatus: "pending" | "verified" | "rejected";
  status: "active" | "inactive" | "suspended";
  createdAt: string;
  updatedAt: string;
}

export interface DashboardTransfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  status: "initiated" | "completed" | "failed" | "compensating" | "compensation_failed";
  createdAt: string;
  updatedAt: string;
}

export interface DashboardLedgerStats {
  totalDebits: number;
  totalCredits: number;
  net: number;
  entryCount: number;
}

export interface DashboardDataset<T> {
  items: T[];
  source: DashboardDataSource;
  notice?: string;
}

export interface DashboardOverview {
  accounts: DashboardDataset<DashboardAccount>;
  transfers: DashboardDataset<DashboardTransfer>;
  health: GatewayHealthState;
  ledgerStats?: DashboardLedgerStats;
  ledgerStatsNotice?: string;
}

export interface DashboardApiOptions {
  baseUrl?: string;
  session?: AuthSession | null;
}

interface GatewayListEnvelope<T> {
  success?: boolean;
  data?: T[] | { items?: T[]; accounts?: T[]; transfers?: T[] };
  items?: T[];
  accounts?: T[];
  transfers?: T[];
}

interface GatewayAccount {
  id?: string;
  name?: string;
  email?: string;
  balance?: string | number;
  kyc_status?: DashboardAccount["kycStatus"];
  kycStatus?: DashboardAccount["kycStatus"];
  status?: DashboardAccount["status"];
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

interface GatewayTransfer {
  id?: string;
  from_account_id?: string;
  fromAccountId?: string;
  to_account_id?: string;
  toAccountId?: string;
  amount?: string | number;
  status?: DashboardTransfer["status"];
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

interface GatewayLedgerStatsEnvelope extends Partial<DashboardLedgerStats> {
  success?: boolean;
  data?: Partial<DashboardLedgerStats>;
}

const fallbackNotice =
  "Documented mock fallback active because this gateway list endpoint is not available yet.";

const mockAccounts: DashboardAccount[] = [
  {
    id: "acct-dashboard-primary",
    name: "Primary Checking",
    email: "customer.ops@sovereign-ledger.local",
    balance: "422100.00",
    kycStatus: "verified",
    status: "active",
    createdAt: "2026-04-01T10:15:00.000Z",
    updatedAt: "2026-04-13T18:20:00.000Z"
  },
  {
    id: "acct-dashboard-treasury",
    name: "Treasury Reserve",
    email: "treasury.ops@sovereign-ledger.local",
    balance: "826292.44",
    kycStatus: "verified",
    status: "active",
    createdAt: "2026-03-11T09:00:00.000Z",
    updatedAt: "2026-04-13T16:05:00.000Z"
  },
  {
    id: "acct-dashboard-review",
    name: "Exception Review",
    email: "risk.ops@sovereign-ledger.local",
    balance: "0.00",
    kycStatus: "pending",
    status: "suspended",
    createdAt: "2026-04-10T12:40:00.000Z",
    updatedAt: "2026-04-13T19:30:00.000Z"
  }
];

const mockTransfers: DashboardTransfer[] = [
  {
    id: "tr-dashboard-9001",
    fromAccountId: "acct-dashboard-primary",
    toAccountId: "acct-dashboard-treasury",
    amount: "12402.00",
    status: "completed",
    createdAt: "2026-04-13T19:10:00.000Z",
    updatedAt: "2026-04-13T19:12:00.000Z"
  },
  {
    id: "tr-dashboard-9002",
    fromAccountId: "acct-dashboard-primary",
    toAccountId: "acct-dashboard-review",
    amount: "5000.00",
    status: "failed",
    createdAt: "2026-04-13T17:45:00.000Z",
    updatedAt: "2026-04-13T17:46:00.000Z"
  },
  {
    id: "tr-dashboard-9003",
    fromAccountId: "acct-dashboard-treasury",
    toAccountId: "acct-dashboard-primary",
    amount: "3200.50",
    status: "initiated",
    createdAt: "2026-04-13T15:20:00.000Z",
    updatedAt: "2026-04-13T15:20:00.000Z"
  }
];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isUnsupportedListEndpoint = (failure: ApiFailure): boolean =>
  failure.status === 404 || failure.status === 405 || failure.error === "not_found";

const unwrapList = <T>(payload: unknown, keys: Array<"accounts" | "transfers">): T[] | null => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (!isObject(payload)) {
    return null;
  }

  const envelope = payload as GatewayListEnvelope<T>;

  if (Array.isArray(envelope.data)) {
    return envelope.data;
  }

  if (Array.isArray(envelope.items)) {
    return envelope.items;
  }

  for (const key of keys) {
    if (Array.isArray(envelope[key])) {
      return envelope[key];
    }
  }

  if (isObject(envelope.data)) {
    if (Array.isArray(envelope.data.items)) {
      return envelope.data.items;
    }

    for (const key of keys) {
      if (Array.isArray(envelope.data[key])) {
        return envelope.data[key];
      }
    }
  }

  return null;
};

const accountFromGateway = (account: GatewayAccount): DashboardAccount | null => {
  if (!account.id || !account.name || !account.email) {
    return null;
  }

  return {
    id: account.id,
    name: account.name,
    email: account.email,
    balance: String(account.balance ?? "0.00"),
    kycStatus: account.kycStatus ?? account.kyc_status ?? "pending",
    status: account.status ?? "active",
    createdAt: account.createdAt ?? account.created_at ?? "",
    updatedAt: account.updatedAt ?? account.updated_at ?? ""
  };
};

const transferFromGateway = (transfer: GatewayTransfer): DashboardTransfer | null => {
  const fromAccountId = transfer.fromAccountId ?? transfer.from_account_id;
  const toAccountId = transfer.toAccountId ?? transfer.to_account_id;

  if (!transfer.id || !fromAccountId || !toAccountId) {
    return null;
  }

  return {
    id: transfer.id,
    fromAccountId,
    toAccountId,
    amount: String(transfer.amount ?? "0.00"),
    status: transfer.status ?? "initiated",
    createdAt: transfer.createdAt ?? transfer.created_at ?? "",
    updatedAt: transfer.updatedAt ?? transfer.updated_at ?? ""
  };
};

const authInit = (options: DashboardApiOptions): ApiRequestInit => ({
  accessToken: () => options.session?.accessToken ?? readStoredSession()?.accessToken ?? null,
  refreshAccessToken: () => refreshAccessTokenForRetry({ baseUrl: options.baseUrl })
});

const dashboardUrl = (path: string, baseUrl = getApiBaseUrl()): string => `${baseUrl}${path}`;

export const fetchDashboardAccounts = async (
  options: DashboardApiOptions = {}
): Promise<ApiResult<DashboardDataset<DashboardAccount>>> => {
  const result = await requestJson<GatewayListEnvelope<GatewayAccount> | GatewayAccount[]>(
    dashboardUrl("/v1/accounts", options.baseUrl),
    authInit(options)
  );

  if (!result.ok) {
    if (isUnsupportedListEndpoint(result)) {
      return {
        ok: true,
        status: result.status,
        data: { items: mockAccounts, source: "mock-fallback", notice: fallbackNotice },
        requestId: result.requestId
      };
    }

    return result;
  }

  const accounts = unwrapList<GatewayAccount>(result.data, ["accounts"])?.flatMap((account) => {
    const normalized = accountFromGateway(account);
    return normalized ? [normalized] : [];
  });

  return {
    ok: true,
    status: result.status,
    data: { items: accounts ?? [], source: "gateway" },
    requestId: result.requestId
  };
};

export const fetchDashboardTransfers = async (
  options: DashboardApiOptions = {}
): Promise<ApiResult<DashboardDataset<DashboardTransfer>>> => {
  const result = await requestJson<GatewayListEnvelope<GatewayTransfer> | GatewayTransfer[]>(
    dashboardUrl("/v1/transfers", options.baseUrl),
    authInit(options)
  );

  if (!result.ok) {
    if (isUnsupportedListEndpoint(result)) {
      return {
        ok: true,
        status: result.status,
        data: { items: mockTransfers, source: "mock-fallback", notice: fallbackNotice },
        requestId: result.requestId
      };
    }

    return result;
  }

  const transfers = unwrapList<GatewayTransfer>(result.data, ["transfers"])?.flatMap((transfer) => {
    const normalized = transferFromGateway(transfer);
    return normalized ? [normalized] : [];
  });

  return {
    ok: true,
    status: result.status,
    data: { items: transfers ?? [], source: "gateway" },
    requestId: result.requestId
  };
};

export const fetchDashboardLedgerStats = async (
  accountId: string,
  options: DashboardApiOptions = {}
): Promise<ApiResult<DashboardLedgerStats>> => {
  const result = await requestJson<GatewayLedgerStatsEnvelope>(
    dashboardUrl(`/v1/ledger/stats/${accountId}`, options.baseUrl),
    authInit(options)
  );

  if (!result.ok) {
    return result;
  }

  const stats: Partial<DashboardLedgerStats> = result.data.data ?? {
    entryCount: result.data.entryCount,
    net: result.data.net,
    totalCredits: result.data.totalCredits,
    totalDebits: result.data.totalDebits
  };

  return {
    ok: true,
    status: result.status,
    data: {
      totalDebits: Number(stats.totalDebits ?? 0),
      totalCredits: Number(stats.totalCredits ?? 0),
      net: Number(stats.net ?? 0),
      entryCount: Number(stats.entryCount ?? 0)
    },
    requestId: result.requestId
  };
};

const ledgerStatsNoticeFor = (role: UserRole): string | undefined =>
  role === "admin" ? undefined : "Ledger stats are available through the admin gateway boundary.";

export const getDashboardOverview = async (
  role: UserRole,
  options: DashboardApiOptions = {}
): Promise<ApiResult<DashboardOverview>> => {
  const [health, accountsResult, transfersResult] = await Promise.all([
    getGatewayHealth(options.baseUrl),
    fetchDashboardAccounts(options),
    fetchDashboardTransfers(options)
  ]);

  if (!accountsResult.ok) {
    return accountsResult;
  }

  if (!transfersResult.ok) {
    return transfersResult;
  }

  const firstAccount = accountsResult.data.items[0];
  const overview: DashboardOverview = {
    accounts: accountsResult.data,
    transfers: transfersResult.data,
    health,
    ledgerStatsNotice: ledgerStatsNoticeFor(role)
  };

  if (role === "admin" && firstAccount) {
    const statsResult = await fetchDashboardLedgerStats(firstAccount.id, options);

    if (statsResult.ok) {
      overview.ledgerStats = statsResult.data;
    } else {
      overview.ledgerStatsNotice = `Ledger stats unavailable: ${statsResult.error}`;
    }
  }

  return { ok: true, status: 200, data: overview };
};
