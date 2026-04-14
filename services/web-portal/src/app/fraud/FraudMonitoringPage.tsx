import type { FormEvent, ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ContentGrid, PageHeader } from "../../components/layout";
import { Button, DataTable, EmptyState, Input, MetricCard, Select, Skeleton, StatusChip } from "../../components/primitives";
import type { ApiResult } from "../../lib/api/client";
import {
  getFraudAlert,
  getFraudAlerts,
  getFraudStats,
  type FraudAlert,
  type FraudAlertQuery,
  type FraudSeverity,
  type FraudSeverityCount,
  type FraudStats
} from "../../lib/api/fraud";
import type { AuthSession } from "../auth/session";
import { readStoredSession } from "../auth/session";

export interface FraudClient {
  getAlerts: (query: FraudAlertQuery, session: AuthSession | null) => Promise<ApiResult<FraudAlert[]>>;
  getAlert: (alertId: string, session: AuthSession | null) => Promise<ApiResult<FraudAlert>>;
  getStats: (session: AuthSession | null) => Promise<ApiResult<FraudStats>>;
}

export interface FraudMonitoringPageProps {
  fraudClient?: FraudClient;
  getSession?: () => AuthSession | null;
}

interface FilterFields {
  severity: "all" | FraudSeverity;
  accountId: string;
  transferId: string;
  fromDate: string;
  toDate: string;
}

interface FilterErrors {
  accountId?: string;
  transferId?: string;
  dateRange?: string;
}

type ListState =
  | { status: "loading" }
  | { status: "ready"; alerts: FraudAlert[]; stats?: FraudStats; statsError?: Notice }
  | { status: "error"; message: string };

type DetailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; alert: FraudAlert }
  | { status: "error"; message: string };

type Notice = { status: "success" | "warning" | "error" | "info"; title: string; message: string };
type MetricStatus = "success" | "warning" | "error" | "info" | "neutral";

interface FraudMetric {
  label: string;
  value: string;
  status: MetricStatus;
}

const defaultFraudClient: FraudClient = {
  getAlert: (alertId, session) => getFraudAlert(alertId, { session }),
  getAlerts: (query, session) => getFraudAlerts(query, { session }),
  getStats: (session) => getFraudStats({ session })
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const moneyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency"
});

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  year: "numeric"
});

const severityOrder: FraudSeverity[] = ["critical", "high", "medium", "low"];

const severityTone = (severity: FraudSeverity): MetricStatus => {
  if (severity === "critical") {
    return "error";
  }

  if (severity === "high") {
    return "warning";
  }

  if (severity === "medium") {
    return "info";
  }

  return "neutral";
};

const formatMoney = (value: string): string => moneyFormatter.format(Number(value || 0));

const formatTimestamp = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Pending timestamp" : timestampFormatter.format(date);
};

const toDateTimeStart = (date: string): string | undefined =>
  date ? `${date}T00:00:00.000Z` : undefined;

const toDateTimeEnd = (date: string): string | undefined =>
  date ? `${date}T23:59:59.999Z` : undefined;

const totalCounts = (counts: FraudSeverityCount[] = []): number =>
  counts.reduce((sum, item) => sum + item.count, 0);

const severityCountFor = (counts: FraudSeverityCount[] = [], severity: FraudSeverity): number =>
  counts.find((item) => item.severity === severity)?.count ?? 0;

const severityMix = (counts: FraudSeverityCount[] = []): string =>
  severityOrder
    .map((severity) => `${severity.charAt(0).toUpperCase()} ${severityCountFor(counts, severity)}`)
    .join(" / ");

const highCriticalCount = (counts: FraudSeverityCount[] = []): number =>
  severityCountFor(counts, "critical") + severityCountFor(counts, "high");

const validateOptionalUuid = (value: string, label: "account" | "transfer"): string | undefined =>
  !value.trim() || uuidPattern.test(value.trim()) ? undefined : `Enter a valid ${label} UUID.`;

const validateAlertId = (value: string): string | undefined =>
  uuidPattern.test(value.trim()) ? undefined : "Enter a valid alert UUID.";

const validateFilters = (filters: FilterFields): FilterErrors => {
  const errors: FilterErrors = {
    accountId: validateOptionalUuid(filters.accountId, "account"),
    transferId: validateOptionalUuid(filters.transferId, "transfer")
  };

  if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
    errors.dateRange = "Start date must be before end date.";
  }

  return Object.fromEntries(
    Object.entries(errors).filter(([, value]) => Boolean(value))
  ) as FilterErrors;
};

const messageForFailure = (result: ApiResult<unknown>, resource: "alert" | "alerts" | "stats"): Notice => {
  if (result.ok) {
    return { status: "success", title: "Fraud Data Ready", message: "Fraud data loaded." };
  }

  const requestSuffix = result.requestId ? ` Reference ${result.requestId}.` : "";

  if (result.status === 403 || result.error === "forbidden") {
    return {
      status: "error",
      title: "Admin Access Required",
      message: `Fraud operations are restricted to admin sessions.${requestSuffix}`
    };
  }

  if (result.status === 404 || result.error === "not_found") {
    return {
      status: "error",
      title: "Fraud Alert Not Found",
      message: `No fraud ${resource === "alert" ? "alert" : "records"} matched that request.${requestSuffix}`
    };
  }

  if (result.status === 400 || result.error === "validation_error") {
    return {
      status: "error",
      title: "Fraud Query Rejected",
      message: `The fraud ${resource} request did not satisfy gateway constraints.${requestSuffix}`
    };
  }

  if (result.status === 0 || result.status === 503 || result.error === "service_degraded") {
    return {
      status: "error",
      title: "Gateway Unavailable",
      message: `Fraud services are unavailable. Try again after the gateway recovers.${requestSuffix}`
    };
  }

  return {
    status: "error",
    title: "Fraud Request Failed",
    message: `${result.error}.${requestSuffix}`.trim()
  };
};

export const FraudMonitoringPage = ({
  fraudClient = defaultFraudClient,
  getSession = readStoredSession
}: FraudMonitoringPageProps): ReactElement => {
  const { alertId: routeAlertId } = useParams();
  const session = getSession();
  const [filters, setFilters] = useState<FilterFields>({
    accountId: "",
    fromDate: "",
    severity: "all",
    toDate: "",
    transferId: ""
  });
  const [filterErrors, setFilterErrors] = useState<FilterErrors>({});
  const [listState, setListState] = useState<ListState>({ status: "loading" });
  const [detailState, setDetailState] = useState<DetailState>({ status: "idle" });
  const [mutation, setMutation] = useState<"filters" | "refresh" | null>(null);

  const buildQuery = (nextFilters: FilterFields): FraudAlertQuery => ({
    accountId: nextFilters.accountId.trim() || undefined,
    from: toDateTimeStart(nextFilters.fromDate),
    limit: 20,
    page: 1,
    severity: nextFilters.severity === "all" ? undefined : nextFilters.severity,
    to: toDateTimeEnd(nextFilters.toDate)
  });

  const loadDashboard = async (nextFilters = filters): Promise<void> => {
    setListState({ status: "loading" });
    const [alertsResult, statsResult] = await Promise.all([
      fraudClient.getAlerts(buildQuery(nextFilters), session),
      fraudClient.getStats(session)
    ]);

    if (!alertsResult.ok) {
      setListState({ status: "error", message: messageForFailure(alertsResult, "alerts").message });
      return;
    }

    setListState({
      status: "ready",
      alerts: alertsResult.data,
      stats: statsResult.ok ? statsResult.data : undefined,
      statsError: statsResult.ok ? undefined : messageForFailure(statsResult, "stats")
    });
  };

  const loadDetail = async (alertId: string): Promise<void> => {
    const validation = validateAlertId(alertId);

    if (validation) {
      setDetailState({ status: "error", message: validation });
      return;
    }

    setDetailState({ status: "loading" });
    const result = await fraudClient.getAlert(alertId.trim(), session);

    if (!result.ok) {
      setDetailState({ status: "error", message: messageForFailure(result, "alert").message });
      return;
    }

    setDetailState({ status: "ready", alert: result.data });
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (!routeAlertId) {
      setDetailState({ status: "idle" });
      return;
    }

    void loadDetail(routeAlertId);
  }, [routeAlertId]);

  const visibleAlerts = useMemo(() => {
    if (listState.status !== "ready") {
      return [];
    }

    const transferFilter = filters.transferId.trim().toLowerCase();

    if (!transferFilter) {
      return listState.alerts;
    }

    return listState.alerts.filter((alert) => alert.transferId.toLowerCase() === transferFilter);
  }, [filters.transferId, listState]);

  const metrics = useMemo<FraudMetric[]>(() => {
    const stats = listState.status === "ready" ? listState.stats : undefined;
    const weekCounts = stats?.thisWeek ?? [];
    const todayCounts = stats?.today ?? [];

    return [
      {
        label: "Loaded Alerts",
        status: visibleAlerts.length > 0 ? "info" : "neutral",
        value: String(visibleAlerts.length)
      },
      {
        label: "Severity Mix",
        status: highCriticalCount(weekCounts) > 0 ? "warning" : "neutral",
        value: stats ? severityMix(weekCounts) : "Unavailable"
      },
      {
        label: "High / Critical",
        status: highCriticalCount(weekCounts) > 0 ? "error" : "success",
        value: String(highCriticalCount(weekCounts))
      },
      {
        label: "Today",
        status: totalCounts(todayCounts) > 0 ? "warning" : "success",
        value: String(totalCounts(todayCounts))
      }
    ];
  }, [listState, visibleAlerts.length]);

  const updateFilter = (key: keyof FilterFields, value: string): void => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const applyFilters = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const nextErrors = validateFilters(filters);
    setFilterErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setMutation("filters");
    void loadDashboard(filters).finally(() => setMutation(null));
  };

  const refresh = (): void => {
    setMutation("refresh");
    void Promise.all([
      loadDashboard(filters),
      routeAlertId ? loadDetail(routeAlertId) : Promise.resolve()
    ]).finally(() => setMutation(null));
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        actions={<StatusChip status={session?.role === "admin" ? "error" : "warning"}>{session?.role ?? "unknown"}</StatusChip>}
        description="Review fraud alerts, severity distribution, and transfer/account references from the admin gateway."
        eyebrow="Fraud Monitoring"
        title={routeAlertId ? "Fraud Alert Detail" : "Fraud Operations"}
      />

      <ContentGrid>
        {metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} status={metric.status} value={metric.value} />
        ))}
      </ContentGrid>

      {listState.status === "ready" && listState.statsError ? <FraudNotice notice={listState.statsError} /> : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.4fr)]">
        <div className="grid content-start gap-6">
          <section className="grid gap-5 rounded-lg bg-surface-container-low p-4">
            <div className="rounded-lg bg-surface-container-lowest p-5">
              <h3 className="text-title-lg font-black text-on-surface">Alert Filters</h3>
              <p className="mt-2 text-body-sm text-on-surface-variant">
                Severity, account, and date filters are sent to the API. Transfer ID filters the loaded page only.
              </p>
              <form className="mt-5 grid gap-4" noValidate onSubmit={applyFilters}>
                <Select
                  label="Severity"
                  name="severity"
                  onChange={(event) => updateFilter("severity", event.currentTarget.value)}
                  value={filters.severity}
                >
                  <option value="all">All severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </Select>
                <Input
                  error={filterErrors.accountId}
                  label="Account UUID"
                  name="accountId"
                  onChange={(event) => updateFilter("accountId", event.currentTarget.value)}
                  placeholder="123e4567-e89b-12d3-a456-426614174000"
                  value={filters.accountId}
                />
                <Input
                  error={filterErrors.transferId}
                  label="Transfer UUID"
                  name="transferId"
                  onChange={(event) => updateFilter("transferId", event.currentTarget.value)}
                  placeholder="223e4567-e89b-12d3-a456-426614174111"
                  value={filters.transferId}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    error={filterErrors.dateRange}
                    label="From Date"
                    name="fromDate"
                    onChange={(event) => updateFilter("fromDate", event.currentTarget.value)}
                    type="date"
                    value={filters.fromDate}
                  />
                  <Input
                    label="To Date"
                    name="toDate"
                    onChange={(event) => updateFilter("toDate", event.currentTarget.value)}
                    type="date"
                    value={filters.toDate}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button loading={mutation === "filters"} type="submit">
                    Apply Filters
                  </Button>
                  <Button loading={mutation === "refresh"} onClick={refresh} variant="secondary">
                    Refresh
                  </Button>
                </div>
              </form>
            </div>
          </section>

          <FraudDetailPanel detailState={detailState} />
        </div>

        <FraudAlertTable alerts={visibleAlerts} listState={listState} />
      </section>
    </div>
  );
};

interface FraudNoticeProps {
  notice: Notice;
}

const FraudNotice = ({ notice }: FraudNoticeProps): ReactElement => (
  <aside className="rounded-lg bg-surface-container-low p-4" role={notice.status === "error" ? "alert" : "status"}>
    <div className="grid gap-2 rounded-lg bg-surface-container-lowest p-4">
      <StatusChip status={notice.status}>{notice.title}</StatusChip>
      <p className="text-body-sm text-on-surface-variant">{notice.message}</p>
    </div>
  </aside>
);

interface FraudAlertTableProps {
  alerts: FraudAlert[];
  listState: ListState;
}

const FraudAlertTable = ({ alerts, listState }: FraudAlertTableProps): ReactElement => {
  if (listState.status === "loading") {
    return <Skeleton aria-label="fraud alerts loading" className="min-h-[32rem]" />;
  }

  if (listState.status === "error") {
    return <EmptyState description={listState.message} title="Fraud alerts unavailable" tone="error" />;
  }

  return (
    <section className="grid content-start gap-5 rounded-lg bg-surface-container-low p-4">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg bg-surface-container-lowest p-5">
        <div>
          <h3 className="text-headline-sm font-black text-on-surface">Active Fraud Stream</h3>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Current page results from the admin fraud gateway.
          </p>
        </div>
        <StatusChip status="info">client transfer filter</StatusChip>
      </div>
      <DataTable
        caption="Fraud alerts"
        columns={[
          {
            header: "Severity",
            key: "severity",
            render: (alert) => <StatusChip status={severityTone(alert.severity)}>{alert.severity}</StatusChip>
          },
          {
            header: "Account",
            key: "account",
            render: (alert) => (
              <Link className="font-mono text-xs font-bold text-primary hover:underline" to={`/accounts/${alert.fromAccountId}`}>
                {alert.fromAccountId}
              </Link>
            )
          },
          {
            header: "Rule",
            key: "rule",
            render: (alert) => <span className="font-bold">{alert.ruleTriggered || "fraud_rule"}</span>
          },
          {
            header: "Transfer",
            key: "transfer",
            render: (alert) => (
              <Link className="font-mono text-xs font-bold text-primary hover:underline" to={`/transfers/${alert.transferId}`}>
                {alert.transferId}
              </Link>
            )
          },
          {
            header: "Amount",
            key: "amount",
            render: (alert) => formatMoney(alert.amount)
          },
          {
            header: "Detail",
            key: "detail",
            render: (alert) => (
              <Link className="font-bold text-primary hover:underline" to={`/fraud/alerts/${alert.alertId}`}>
                Open
              </Link>
            )
          }
        ]}
        emptyMessage="No fraud alerts matched the current filters"
        getRowKey={(alert) => alert.alertId}
        rows={alerts}
      />
    </section>
  );
};

interface FraudDetailPanelProps {
  detailState: DetailState;
}

const FraudDetailPanel = ({ detailState }: FraudDetailPanelProps): ReactElement => {
  if (detailState.status === "loading") {
    return <Skeleton aria-label="fraud alert detail loading" className="min-h-80" />;
  }

  if (detailState.status === "error") {
    return <EmptyState description={detailState.message} title="Alert detail unavailable" tone="error" />;
  }

  if (detailState.status === "idle") {
    return (
      <EmptyState
        description="Open an alert from the fraud stream to inspect the rule, transfer, account, and timestamp."
        title="No alert selected"
      />
    );
  }

  const { alert } = detailState;

  return (
    <section className="grid gap-5 rounded-lg bg-surface-container-low p-4">
      <article className="grid gap-5 rounded-lg bg-surface-container-lowest p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <StatusChip status={severityTone(alert.severity)}>{alert.severity}</StatusChip>
            <h3 className="text-title-lg font-black text-on-surface">{alert.ruleTriggered || "Fraud Rule"}</h3>
            <p className="break-all font-mono text-label-sm text-on-surface-variant">Alert {alert.alertId}</p>
          </div>
          <p className="text-3xl font-black text-on-surface">{formatMoney(alert.amount)}</p>
        </div>
        <dl className="grid gap-3">
          <FraudFact label="Account ID" value={alert.fromAccountId} to={`/accounts/${alert.fromAccountId}`} />
          <FraudFact label="Transfer ID" value={alert.transferId} to={`/transfers/${alert.transferId}`} />
          <FraudFact label="Source Event" value={alert.sourceEventId || "Fraud event"} />
          <FraudFact label="Created" value={formatTimestamp(alert.createdAt)} />
        </dl>
      </article>
    </section>
  );
};

interface FraudFactProps {
  label: string;
  value: string;
  to?: string;
}

const FraudFact = ({ label, to, value }: FraudFactProps): ReactElement => (
  <div className="grid gap-1 rounded-lg bg-surface-container-low p-3">
    <dt className="text-label-sm font-black uppercase text-on-surface-variant">{label}</dt>
    <dd className="break-words text-body-sm font-bold text-on-surface">
      {to ? (
        <Link className="text-primary hover:underline" to={to}>
          {value}
        </Link>
      ) : (
        value
      )}
    </dd>
  </div>
);
