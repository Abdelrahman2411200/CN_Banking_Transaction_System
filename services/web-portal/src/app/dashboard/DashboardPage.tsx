import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ContentGrid, PageHeader } from "../../components/layout";
import { Button, DataTable, EmptyState, MetricCard, Skeleton, StatusChip } from "../../components/primitives";
import { cn } from "../../lib/cn";
import type { ApiResult } from "../../lib/api/client";
import {
  getDashboardOverview,
  type DashboardAccount,
  type DashboardDataSource,
  type DashboardOverview,
  type DashboardTransfer
} from "../../lib/api/dashboard";
import type { AuthSession, UserRole } from "../auth/session";
import { readStoredSession } from "../auth/session";

export type DashboardClient = (role: UserRole, session: AuthSession | null) => Promise<ApiResult<DashboardOverview>>;

export interface DashboardPageProps {
  getSession?: () => AuthSession | null;
  dashboardClient?: DashboardClient;
}

type DashboardState =
  | { status: "loading" }
  | { status: "ready"; overview: DashboardOverview }
  | { status: "error"; message: string; requestId?: string };

const defaultDashboardClient: DashboardClient = (role, session) =>
  getDashboardOverview(role, { session });

const moneyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency"
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short"
});

const toNumber = (value: string | number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoney = (value: string | number): string => moneyFormatter.format(toNumber(value));

const formatDate = (value: string): string => {
  if (!value) {
    return "Pending timestamp";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Pending timestamp" : dateFormatter.format(date);
};

const statusForAccount = (status: DashboardAccount["status"]): "success" | "warning" | "error" =>
  status === "active" ? "success" : status === "inactive" ? "warning" : "error";

const statusForTransfer = (status: DashboardTransfer["status"]): "success" | "warning" | "error" | "info" =>
  status === "completed"
    ? "success"
    : status === "failed" || status === "compensation_failed"
      ? "error"
      : status === "compensating"
        ? "warning"
        : "info";

const sourceLabel = (source: DashboardDataSource): string =>
  source === "gateway" ? "Gateway data" : "Mock fallback";

const roleCopy = (role: UserRole): { eyebrow: string; title: string; description: string } =>
  role === "customer"
    ? {
        eyebrow: "Customer Overview",
        title: "Dashboard",
        description: "Own accounts, recent transfer activity, service state, and safe next actions."
      }
    : {
        eyebrow: "Operational Overview",
        title: "Dashboard",
        description: "System-facing account exposure, transfer movement, service state, and operator actions."
      };

export const DashboardPage = ({
  dashboardClient = defaultDashboardClient,
  getSession = readStoredSession
}: DashboardPageProps): ReactElement => {
  const session = getSession();
  const role = session?.role ?? "customer";
  const sessionAccessToken = session?.accessToken;
  const sessionSubject = session?.subject;
  const copy = roleCopy(role);
  const [state, setState] = useState<DashboardState>({ status: "loading" });

  useEffect(() => {
    let mounted = true;
    setState({ status: "loading" });

    void dashboardClient(role, session).then((result) => {
      if (!mounted) {
        return;
      }

      if (result.ok) {
        setState({ status: "ready", overview: result.data });
        return;
      }

      setState({
        status: "error",
        message: result.error,
        requestId: result.requestId
      });
    });

    return () => {
      mounted = false;
    };
  }, [dashboardClient, role, sessionAccessToken, sessionSubject]);

  if (state.status === "loading") {
    return <DashboardLoading copy={copy} role={role} />;
  }

  if (state.status === "error") {
    return (
      <div className="grid gap-6">
        <PageHeader
          actions={<StatusChip status="error">Gateway error</StatusChip>}
          description={copy.description}
          eyebrow={copy.eyebrow}
          title={copy.title}
        />
        <EmptyState
          description={
            state.requestId
              ? `${state.message}. Request ${state.requestId}.`
              : `${state.message}.`
          }
          title="Dashboard data unavailable"
          tone="error"
        />
      </div>
    );
  }

  return <DashboardReady copy={copy} overview={state.overview} role={role} />;
};

interface DashboardViewProps {
  copy: ReturnType<typeof roleCopy>;
  overview: DashboardOverview;
  role: UserRole;
}

const DashboardReady = ({ copy, overview, role }: DashboardViewProps): ReactElement => {
  const metrics = useMemo(() => buildMetrics(overview, role), [overview, role]);
  const hasFallback = overview.accounts.source === "mock-fallback" || overview.transfers.source === "mock-fallback";
  const healthStatus = overview.health.status;

  return (
    <div className="grid gap-6">
      <PageHeader
        actions={
          <>
            <StatusChip status={healthStatus === "healthy" ? "success" : healthStatus === "degraded" ? "warning" : "error"}>
              {overview.health.message}
            </StatusChip>
            <StatusChip status={role === "customer" ? "info" : "warning"}>{role}</StatusChip>
          </>
        }
        description={copy.description}
        eyebrow={copy.eyebrow}
        title={copy.title}
      />

      {healthStatus !== "healthy" ? <HealthBanner overview={overview} /> : null}
      {hasFallback ? <FallbackBanner overview={overview} /> : null}

      <ContentGrid>
        {metrics.map((metric) => (
          <MetricCard
            delta={metric.delta}
            icon={<span className="material-symbols-outlined text-2xl">{metric.icon}</span>}
            key={metric.label}
            label={metric.label}
            status={metric.status}
            value={metric.value}
          />
        ))}
      </ContentGrid>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <RecentActivity transfers={overview.transfers.items} />
        <div className="grid content-start gap-6">
          <QuickActions role={role} />
          <ServiceStatus overview={overview} />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <AccountSummary accounts={overview.accounts.items} />
        <LedgerSummary overview={overview} role={role} />
      </section>
    </div>
  );
};

interface DashboardLoadingProps {
  copy: ReturnType<typeof roleCopy>;
  role: UserRole;
}

const DashboardLoading = ({ copy, role }: DashboardLoadingProps): ReactElement => (
  <div className="grid gap-6">
    <PageHeader
      actions={<StatusChip status={role === "customer" ? "info" : "warning"}>{role}</StatusChip>}
      description={copy.description}
      eyebrow={copy.eyebrow}
      title={copy.title}
    />
    <ContentGrid>
      <Skeleton aria-label="dashboard liquidity loading" className="min-h-32" />
      <Skeleton aria-label="dashboard volume loading" className="min-h-32" />
      <Skeleton aria-label="dashboard risk loading" className="min-h-32" />
      <Skeleton aria-label="dashboard health loading" className="min-h-32" />
    </ContentGrid>
    <Skeleton aria-label="dashboard activity loading" className="min-h-80" />
  </div>
);

const buildMetrics = (
  overview: DashboardOverview,
  role: UserRole
): Array<{ label: string; value: string; delta: string; status: "success" | "warning" | "error" | "info" | "neutral"; icon: string }> => {
  const totalLiquidity = overview.accounts.items.reduce((total, account) => total + toNumber(account.balance), 0);
  const recentVolume = overview.transfers.items.reduce((total, transfer) => total + toNumber(transfer.amount), 0);
  const suspendedAccounts = overview.accounts.items.filter((account) => account.status === "suspended").length;
  const completedTransfers = overview.transfers.items.filter((transfer) => transfer.status === "completed").length;
  const failedTransfers = overview.transfers.items.filter((transfer) => statusForTransfer(transfer.status) === "error").length;

  return [
    {
      label: "Total Liquidity",
      value: formatMoney(totalLiquidity),
      delta: sourceLabel(overview.accounts.source),
      status: overview.accounts.source === "gateway" ? "success" : "warning",
      icon: "account_balance_wallet"
    },
    {
      label: "Recent Volume",
      value: formatMoney(recentVolume),
      delta: `${overview.transfers.items.length} recent transfers`,
      status: failedTransfers > 0 ? "warning" : "success",
      icon: "swap_horiz"
    },
    {
      label: role === "customer" ? "Risk Profile" : "Operational Alerts",
      value: role === "customer" ? (suspendedAccounts > 0 ? "Review" : "Low") : String(suspendedAccounts + failedTransfers),
      delta: role === "customer" ? `${suspendedAccounts} restricted accounts` : "restricted or failed",
      status: suspendedAccounts + failedTransfers > 0 ? "warning" : "success",
      icon: role === "customer" ? "verified_user" : "gpp_maybe"
    },
    {
      label: "Transfer Completion",
      value: String(completedTransfers),
      delta: overview.health.status,
      status: overview.health.status === "healthy" ? "success" : overview.health.status === "degraded" ? "warning" : "error",
      icon: "monitor_heart"
    }
  ];
};

interface HealthBannerProps {
  overview: DashboardOverview;
}

const HealthBanner = ({ overview }: HealthBannerProps): ReactElement => (
  <aside className="rounded-lg bg-surface-container-low p-4" role="status">
    <div className="grid gap-2 rounded-lg bg-surface-container-lowest p-4 text-left">
      <StatusChip status={overview.health.status === "degraded" ? "warning" : "error"}>
        {overview.health.status}
      </StatusChip>
      <h3 className="text-title-md font-black text-on-surface">Service state requires attention</h3>
      <p className="text-body-sm text-on-surface-variant">{overview.health.message}</p>
    </div>
  </aside>
);

interface FallbackBannerProps {
  overview: DashboardOverview;
}

const FallbackBanner = ({ overview }: FallbackBannerProps): ReactElement => (
  <aside className="rounded-lg bg-surface-container-low p-4" role="status">
    <div className="grid gap-2 rounded-lg bg-surface-container-lowest p-4 text-left">
      <StatusChip status="warning">Mock fallback</StatusChip>
      <h3 className="text-title-md font-black text-on-surface">Dashboard list endpoints pending</h3>
      <p className="text-body-sm text-on-surface-variant">
        {overview.accounts.notice ?? overview.transfers.notice ?? "Fallback overview data is active."}
      </p>
    </div>
  </aside>
);

interface RecentActivityProps {
  transfers: DashboardTransfer[];
}

const RecentActivity = ({ transfers }: RecentActivityProps): ReactElement => (
  <section className="grid gap-4 rounded-lg bg-surface-container-low p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="text-title-lg font-black text-on-surface">Recent Activity</h3>
        <p className="mt-1 text-body-sm text-on-surface-variant">Gateway transfer movement for the current dashboard scope.</p>
      </div>
      <Button variant="tertiary">Download CSV</Button>
    </div>
    <DataTable
      caption="Recent transfer activity"
      columns={[
        {
          header: "Transfer",
          key: "transfer",
          render: (transfer) => (
            <div className="grid gap-1">
              <span className="text-sm font-black text-on-surface">{transfer.id}</span>
              <span className="text-xs text-on-surface-variant">
                {transfer.fromAccountId} to {transfer.toAccountId}
              </span>
            </div>
          )
        },
        {
          header: "Amount",
          key: "amount",
          render: (transfer) => <span className="font-black">{formatMoney(transfer.amount)}</span>
        },
        {
          header: "Status",
          key: "status",
          render: (transfer) => <StatusChip status={statusForTransfer(transfer.status)}>{transfer.status}</StatusChip>
        },
        {
          header: "Updated",
          key: "updated",
          render: (transfer) => <span className="text-on-surface-variant">{formatDate(transfer.updatedAt)}</span>
        }
      ]}
      emptyMessage="No recent transfer activity"
      getRowKey={(transfer) => transfer.id}
      rows={transfers}
    />
  </section>
);

interface QuickActionsProps {
  role: UserRole;
}

const QuickActions = ({ role }: QuickActionsProps): ReactElement => {
  const actions =
    role === "customer"
      ? [
          { label: "Send Transfer", description: "Move funds between ledger accounts", icon: "swap_horiz", to: "/transfers" },
          { label: "Review Ledger", description: "Audit account entries", icon: "menu_book", to: "/ledger" }
        ]
      : [
          { label: "Create Account", description: "Open a controlled sub-ledger", icon: "account_balance", to: "/accounts" },
          { label: "Review Fraud", description: "Inspect restricted activity", icon: "policy", to: "/fraud" },
          { label: "Platform Health", description: "Check gateway service state", icon: "health_and_safety", to: "/platform-health" }
        ];

  return (
    <section className="grid gap-4 rounded-lg bg-surface-container-low p-4">
      <h3 className="text-title-lg font-black text-on-surface">Quick Actions</h3>
      <div className="grid gap-3">
        {actions.map((action, index) => (
          <Link
            className={cn(
              "grid gap-1 rounded-lg p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-primary",
              index === 0
                ? "bg-primary text-on-primary hover:brightness-105"
                : "bg-surface-container-lowest text-on-surface hover:bg-surface-variant"
            )}
            key={action.label}
            to={action.to}
          >
            <span className="flex items-center gap-3 text-sm font-black">
              <span aria-hidden="true" className="material-symbols-outlined text-xl">
                {action.icon}
              </span>
              {action.label}
            </span>
            <span className={cn("text-xs", index === 0 ? "text-on-primary/80" : "text-on-surface-variant")}>
              {action.description}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
};

interface ServiceStatusProps {
  overview: DashboardOverview;
}

const ServiceStatus = ({ overview }: ServiceStatusProps): ReactElement => {
  const services = Object.entries(overview.health.services);

  return (
    <section className="grid gap-4 rounded-lg bg-surface-container-low p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-title-lg font-black text-on-surface">Service Status</h3>
          <p className="mt-1 text-body-sm text-on-surface-variant">Live gateway `/health` probe.</p>
        </div>
        <StatusChip status={overview.health.status === "healthy" ? "success" : overview.health.status === "degraded" ? "warning" : "error"}>
          {overview.health.status}
        </StatusChip>
      </div>
      {services.length > 0 ? (
        <div className="grid gap-2">
          {services.map(([name, status]) => (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-container-lowest p-3" key={name}>
              <span className="text-sm font-black capitalize text-on-surface">{name}</span>
              <StatusChip status={status === "ok" ? "success" : status === "degraded" ? "warning" : "error"}>
                {status}
              </StatusChip>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState className="min-h-28" description={overview.health.message} title="No service details reported" />
      )}
    </section>
  );
};

interface AccountSummaryProps {
  accounts: DashboardAccount[];
}

const AccountSummary = ({ accounts }: AccountSummaryProps): ReactElement => (
  <section className="grid gap-4 rounded-lg bg-surface-container-low p-4">
    <div>
      <h3 className="text-title-lg font-black text-on-surface">Account Summary</h3>
      <p className="mt-1 text-body-sm text-on-surface-variant">Balances and restrictions for the active dashboard scope.</p>
    </div>
    {accounts.length > 0 ? (
      <div className="grid gap-3">
        {accounts.map((account) => (
          <article className="grid gap-3 rounded-lg bg-surface-container-lowest p-4" key={account.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-title-md font-black text-on-surface">{account.name}</h4>
                <p className="mt-1 text-label-sm text-on-surface-variant">{account.email}</p>
              </div>
              <StatusChip status={statusForAccount(account.status)}>{account.status}</StatusChip>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className="text-2xl font-black text-on-surface">{formatMoney(account.balance)}</p>
              <StatusChip status={account.kycStatus === "verified" ? "success" : account.kycStatus === "pending" ? "warning" : "error"}>
                KYC {account.kycStatus}
              </StatusChip>
            </div>
          </article>
        ))}
      </div>
    ) : (
      <EmptyState title="No accounts returned" />
    )}
  </section>
);

interface LedgerSummaryProps {
  overview: DashboardOverview;
  role: UserRole;
}

const LedgerSummary = ({ overview, role }: LedgerSummaryProps): ReactElement => (
  <section className="grid gap-4 rounded-lg bg-surface-container-low p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-title-lg font-black text-on-surface">Ledger Summary</h3>
        <p className="mt-1 text-body-sm text-on-surface-variant">Stats are read only when the gateway exposes them for this role.</p>
      </div>
      <StatusChip status={overview.ledgerStats ? "success" : role === "admin" ? "warning" : "info"}>
        {overview.ledgerStats ? "available" : "restricted"}
      </StatusChip>
    </div>
    {overview.ledgerStats ? (
      <ContentGrid className="md:grid-cols-2 xl:grid-cols-2">
        <MetricCard label="Credits" status="success" value={formatMoney(overview.ledgerStats.totalCredits)} />
        <MetricCard label="Debits" status="warning" value={formatMoney(overview.ledgerStats.totalDebits)} />
        <MetricCard label="Net" status={overview.ledgerStats.net >= 0 ? "success" : "error"} value={formatMoney(overview.ledgerStats.net)} />
        <MetricCard label="Entries" status="info" value={String(overview.ledgerStats.entryCount)} />
      </ContentGrid>
    ) : (
      <EmptyState description={overview.ledgerStatsNotice} title="Ledger stats not available" />
    )}
  </section>
);
