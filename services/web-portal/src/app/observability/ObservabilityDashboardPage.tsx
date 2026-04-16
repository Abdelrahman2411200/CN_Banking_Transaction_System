import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { ContentGrid, PageHeader } from "../../components/layout";
import { Button, DataTable, EmptyState, MetricCard, Skeleton, StatusChip } from "../../components/primitives";
import { getGatewayHealth, type GatewayHealthState } from "../../lib/api/health";
import type { AuthSession } from "../auth/session";
import { readStoredSession } from "../auth/session";

export interface ObservabilityClient {
  getHealth: () => Promise<GatewayHealthState>;
}

export interface ObservabilityDashboardPageProps {
  getSession?: () => AuthSession | null;
  observabilityClient?: ObservabilityClient;
}

type HealthState =
  | { status: "loading" }
  | { status: "ready"; health: GatewayHealthState }
  | { status: "error"; message: string };

type ServiceState = "healthy" | "degraded" | "unreachable" | "unknown";
type ChipStatus = "success" | "warning" | "error" | "info" | "neutral" | "unknown";

interface ServiceMapItem {
  id: string;
  label: string;
  role: string;
  source: string;
  state: ServiceState;
}

const defaultObservabilityClient: ObservabilityClient = {
  getHealth: () => getGatewayHealth()
};

const serviceCatalog = [
  {
    id: "api-gateway",
    label: "api-gateway",
    role: "Browser entrypoint and request policy"
  },
  {
    id: "account",
    label: "account-service",
    role: "Account creation, KYC, balances, freezes"
  },
  {
    id: "transfer",
    label: "transfer-service",
    role: "Idempotent transfer orchestration"
  },
  {
    id: "ledger",
    label: "ledger-service",
    role: "Immutable account and transfer ledger reads"
  },
  {
    id: "fraud",
    label: "fraud-service",
    role: "Admin fraud alert detection and review"
  },
  {
    id: "notification",
    label: "notification-service",
    role: "Admin notification stream metadata"
  }
] as const;

const stateTone = (state: ServiceState): ChipStatus => {
  if (state === "healthy") {
    return "success";
  }

  if (state === "degraded") {
    return "warning";
  }

  if (state === "unreachable") {
    return "error";
  }

  return "neutral";
};

const gatewayStateFromHealth = (health: GatewayHealthState): ServiceState => {
  if (health.status === "healthy") {
    return "healthy";
  }

  if (health.status === "degraded") {
    return "degraded";
  }

  return "unreachable";
};

const serviceStateFromValue = (value?: string): ServiceState => {
  if (value === "ok" || value === "healthy") {
    return "healthy";
  }

  if (value === "degraded") {
    return "degraded";
  }

  if (value === "unreachable" || value === "unavailable") {
    return "unreachable";
  }

  return "unknown";
};

const toServiceMap = (health: GatewayHealthState): ServiceMapItem[] =>
  serviceCatalog.map((service) => {
    if (service.id === "api-gateway") {
      return {
        ...service,
        source: "/health aggregate",
        state: gatewayStateFromHealth(health)
      };
    }

    return {
      ...service,
      source: `/health services.${service.id}`,
      state: serviceStateFromValue(health.services[service.id] ?? health.services[service.label])
    };
  });

const metricSummary = (items: ServiceMapItem[]) => {
  const healthy = items.filter((item) => item.state === "healthy").length;
  const degraded = items.filter((item) => item.state === "degraded").length;
  const unreachable = items.filter((item) => item.state === "unreachable").length;
  const unknown = items.filter((item) => item.state === "unknown").length;

  return { degraded, healthy, unreachable, unknown };
};

export const ObservabilityDashboardPage = ({
  getSession = readStoredSession,
  observabilityClient = defaultObservabilityClient
}: ObservabilityDashboardPageProps): ReactElement => {
  const session = getSession();
  const [state, setState] = useState<HealthState>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const loadHealth = async (): Promise<void> => {
    setState({ status: "loading" });

    try {
      const health = await observabilityClient.getHealth();
      setState({ status: "ready", health });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Gateway health unavailable"
      });
    }
  };

  useEffect(() => {
    void loadHealth();
  }, []);

  const refresh = (): void => {
    setRefreshing(true);
    void loadHealth().finally(() => setRefreshing(false));
  };

  const services = useMemo(
    () => (state.status === "ready" ? toServiceMap(state.health) : []),
    [state]
  );
  const summary = useMemo(() => metricSummary(services), [services]);
  const gatewayStatus = state.status === "ready" ? state.health.status : "unknown";
  const isAdmin = session?.role === "admin";

  return (
    <div className="grid gap-6">
      <PageHeader
        actions={
          <>
            <StatusChip status={isAdmin ? "info" : "warning"}>{session?.role ?? "unknown"}</StatusChip>
            <Button loading={refreshing} onClick={refresh} variant="secondary">
              Refresh Health
            </Button>
          </>
        }
        description="Gateway-facing service reachability, summarized from live health checks without exposing raw telemetry in the browser."
        eyebrow="Observability"
        title="Operational Health"
      />

      <ContentGrid>
        <MetricCard
          label="Gateway State"
          status={gatewayStatus === "healthy" ? "success" : gatewayStatus === "degraded" ? "warning" : "error"}
          value={gatewayStatus}
        />
        <MetricCard label="Healthy Services" status="success" value={String(summary.healthy)} />
        <MetricCard
          label="Degraded / Unreachable"
          status={summary.degraded + summary.unreachable > 0 ? "error" : "success"}
          value={`${summary.degraded}/${summary.unreachable}`}
        />
        <MetricCard
          label="Metrics Exposure"
          status="warning"
          value="Server-side"
        />
      </ContentGrid>

      {state.status === "loading" ? <Skeleton aria-label="observability health loading" className="min-h-[30rem]" /> : null}
      {state.status === "error" ? (
        <EmptyState description={state.message} title="Health overview unavailable" tone="error" />
      ) : null}
      {state.status === "ready" ? (
        <ObservabilityContent health={state.health} isAdmin={isAdmin} services={services} summary={summary} />
      ) : null}
    </div>
  );
};

interface ObservabilityContentProps {
  health: GatewayHealthState;
  isAdmin: boolean;
  services: ServiceMapItem[];
  summary: ReturnType<typeof metricSummary>;
}

const ObservabilityContent = ({
  health,
  isAdmin,
  services,
  summary
}: ObservabilityContentProps): ReactElement => (
  <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.8fr)]">
    <section className="grid content-start gap-5 rounded-lg bg-surface-container-low p-4">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg bg-surface-container-lowest p-5">
        <div>
          <h3 className="text-headline-sm font-black text-on-surface">Service Map Integrity</h3>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            api-gateway plus banking services from the live gateway health response.
          </p>
        </div>
        <StatusChip status={health.status === "healthy" ? "success" : health.status === "degraded" ? "warning" : "error"}>
          {health.message}
        </StatusChip>
      </div>

      <DataTable
        caption="Gateway service map"
        columns={[
          {
            header: "Service",
            key: "service",
            render: (service) => (
              <div className="grid gap-1">
                <span className="font-black">{service.label}</span>
                <span className="text-xs text-on-surface-variant">{service.role}</span>
              </div>
            )
          },
          {
            header: "Source",
            key: "source",
            render: (service) => <span className="font-mono text-xs">{service.source}</span>
          },
          {
            header: "Status",
            key: "status",
            render: (service) => <StatusChip status={stateTone(service.state)}>{service.state}</StatusChip>
          }
        ]}
        getRowKey={(service) => service.id}
        rows={services}
      />
    </section>

    <section className="grid content-start gap-5 rounded-lg bg-surface-container-low p-4">
      <article className="grid gap-4 rounded-lg bg-surface-container-lowest p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-title-lg font-black text-on-surface">Health Summary</h3>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Reachability is read from `/health`; missing services are marked unknown rather than inferred.
            </p>
          </div>
          <StatusChip status={summary.unknown > 0 ? "neutral" : "info"}>{summary.unknown} unknown</StatusChip>
        </div>
        <dl className="grid gap-3">
          <HealthFact label="Healthy" status="success" value={String(summary.healthy)} />
          <HealthFact label="Degraded" status="warning" value={String(summary.degraded)} />
          <HealthFact label="Unreachable" status="error" value={String(summary.unreachable)} />
        </dl>
      </article>

      <article className="grid gap-4 rounded-lg bg-surface-container-lowest p-5">
        <StatusChip status="warning">Metrics Decision</StatusChip>
        <h3 className="text-title-lg font-black text-on-surface">Raw `/metrics` stays out of the browser</h3>
        <p className="text-body-sm leading-6 text-on-surface-variant">
          The gateway exposes Prometheus text for infrastructure collection, but this portal defaults to summarized
          health. Browser-facing metrics can be added later behind an admin endpoint that redacts labels and secrets.
        </p>
      </article>

      {isAdmin ? (
        <article className="grid gap-4 rounded-lg bg-surface-container-lowest p-5">
          <StatusChip status="info">Admin Detail</StatusChip>
          <h3 className="text-title-lg font-black text-on-surface">Operational Detail Policy</h3>
          <p className="text-body-sm leading-6 text-on-surface-variant">
            Log search, raw Prometheus output, pod names, and deployment topology are not rendered from static mock data.
            They require dedicated admin gateway endpoints before becoming interactive.
          </p>
        </article>
      ) : (
        <EmptyState
          description="Sensitive telemetry, log search, and raw metrics are hidden from non-admin sessions."
          title="Admin operational detail hidden"
        />
      )}
    </section>
  </div>
);

interface HealthFactProps {
  label: string;
  status: ChipStatus;
  value: string;
}

const HealthFact = ({ label, status, value }: HealthFactProps): ReactElement => (
  <div className="flex items-center justify-between gap-4 rounded-lg bg-surface-container-low p-3">
    <dt className="text-label-sm font-black uppercase text-on-surface-variant">{label}</dt>
    <dd className="flex items-center gap-2 text-body-sm font-black text-on-surface">
      <StatusChip status={status}>{status}</StatusChip>
      {value}
    </dd>
  </div>
);
