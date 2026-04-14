import { readStoredSession, type AuthSession } from "../../app/auth/session";
import { getApiBaseUrl } from "../env";
import { refreshAccessTokenForRetry } from "./auth";
import { requestJson, type ApiRequestInit, type ApiResult } from "./client";

export type FraudSeverity = "low" | "medium" | "high" | "critical";

export interface FraudAlert {
  alertId: string;
  sourceEventId: string;
  transferId: string;
  fromAccountId: string;
  amount: string;
  ruleTriggered: string;
  severity: FraudSeverity;
  createdAt: string;
}

export interface FraudSeverityCount {
  severity: FraudSeverity;
  count: number;
}

export interface FraudStats {
  today: FraudSeverityCount[];
  thisWeek: FraudSeverityCount[];
}

export interface FraudAlertQuery {
  severity?: FraudSeverity;
  accountId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface FraudApiOptions {
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

interface GatewayFraudAlert {
  alertId?: string;
  alert_id?: string;
  sourceEventId?: string;
  source_event_id?: string;
  transferId?: string;
  transfer_id?: string;
  fromAccountId?: string;
  from_account_id?: string;
  amount?: string | number | DecimalJson;
  ruleTriggered?: string;
  rule_triggered?: string;
  severity?: FraudSeverity;
  createdAt?: string;
  created_at?: string;
}

interface GatewaySeverityCount {
  _id?: FraudSeverity;
  severity?: FraudSeverity;
  count?: number;
}

interface GatewayFraudStats {
  today?: GatewaySeverityCount[];
  thisWeek?: GatewaySeverityCount[];
  data?: {
    today?: GatewaySeverityCount[];
    thisWeek?: GatewaySeverityCount[];
  };
}

const fraudUrl = (path: string, baseUrl = getApiBaseUrl()): string => `${baseUrl}/v1/fraud${path}`;

const authInit = (options: FraudApiOptions): ApiRequestInit => ({
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

const toAmountString = (amount: GatewayFraudAlert["amount"]): string => {
  if (amount && typeof amount === "object" && "$numberDecimal" in amount) {
    return amount.$numberDecimal ?? "0.00";
  }

  if (typeof amount === "number" || typeof amount === "string") {
    return String(amount);
  }

  return "0.00";
};

const toFraudAlert = (alert: GatewayFraudAlert): FraudAlert => ({
  alertId: alert.alertId ?? alert.alert_id ?? "",
  sourceEventId: alert.sourceEventId ?? alert.source_event_id ?? "",
  transferId: alert.transferId ?? alert.transfer_id ?? "",
  fromAccountId: alert.fromAccountId ?? alert.from_account_id ?? "",
  amount: toAmountString(alert.amount),
  ruleTriggered: alert.ruleTriggered ?? alert.rule_triggered ?? "",
  severity: alert.severity ?? "low",
  createdAt: alert.createdAt ?? alert.created_at ?? ""
});

const toSeverityCount = (count: GatewaySeverityCount): FraudSeverityCount => ({
  severity: count.severity ?? count._id ?? "low",
  count: Number(count.count ?? 0)
});

const toFraudStats = (stats: GatewayFraudStats): FraudStats => {
  const payload = stats.data ?? stats;

  return {
    today: (payload.today ?? []).map(toSeverityCount),
    thisWeek: (payload.thisWeek ?? []).map(toSeverityCount)
  };
};

const buildQueryString = (query: FraudAlertQuery = {}): string => {
  const params = new URLSearchParams();

  if (query.severity) {
    params.set("severity", query.severity);
  }

  if (query.accountId) {
    params.set("accountId", query.accountId);
  }

  if (query.from) {
    params.set("from", query.from);
  }

  if (query.to) {
    params.set("to", query.to);
  }

  params.set("page", String(query.page ?? 1));
  params.set("limit", String(query.limit ?? 20));

  const value = params.toString();
  return value ? `?${value}` : "";
};

export const getFraudAlerts = async (
  query: FraudAlertQuery = {},
  options: FraudApiOptions = {}
): Promise<ApiResult<FraudAlert[]>> => {
  const result = await requestJson<GatewayEnvelope<GatewayFraudAlert[]> | GatewayFraudAlert[]>(
    fraudUrl(`/alerts${buildQueryString(query)}`, options.baseUrl),
    authInit(options)
  );

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    status: result.status,
    data: unwrapData(result.data).map(toFraudAlert),
    requestId: result.requestId
  };
};

export const getFraudAlert = async (
  alertId: string,
  options: FraudApiOptions = {}
): Promise<ApiResult<FraudAlert>> => {
  const result = await requestJson<GatewayEnvelope<GatewayFraudAlert>>(
    fraudUrl(`/alerts/${alertId}`, options.baseUrl),
    authInit(options)
  );

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    status: result.status,
    data: toFraudAlert(unwrapData(result.data)),
    requestId: result.requestId
  };
};

export const getFraudStats = async (
  options: FraudApiOptions = {}
): Promise<ApiResult<FraudStats>> => {
  const result = await requestJson<GatewayFraudStats>(
    fraudUrl("/stats", options.baseUrl),
    authInit(options)
  );

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    status: result.status,
    data: toFraudStats(result.data),
    requestId: result.requestId
  };
};
