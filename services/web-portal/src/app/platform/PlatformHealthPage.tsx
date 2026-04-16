import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { ContentGrid, PageHeader } from "../../components/layout";
import { Button, EmptyState, MetricCard, Skeleton, StatusChip } from "../../components/primitives";
import { getGatewayHealth, type GatewayHealthState } from "../../lib/api/health";
import type { AuthSession } from "../auth/session";
import { readStoredSession } from "../auth/session";

export interface PlatformHealthClient {
  getHealth: () => Promise<GatewayHealthState>;
}

export interface PlatformHealthPageProps {
  getSession?: () => AuthSession | null;
  platformHealthClient?: PlatformHealthClient;
}

type HealthState =
  | { status: "loading" }
  | { status: "ready"; health: GatewayHealthState }
  | { status: "error"; message: string };

type ServiceState = "healthy" | "degraded" | "unreachable" | "unknown";
type ChipStatus = "success" | "warning" | "error" | "info" | "neutral" | "unknown";

interface ServiceReadiness {
  id: string;
  label: string;
  responsibility: string;
  state: ServiceState;
}

interface BacklogItem {
  title: string;
  description: string;
  endpoint: string;
}

const defaultPlatformHealthClient: PlatformHealthClient = {
  getHealth: () => getGatewayHealth()
};

const serviceCatalog = [
  {
    id: "api-gateway",
    label: "api-gateway",
    responsibility: "Ingress, policy, and gateway aggregation"
  },
  {
    id: "account",
    label: "account-service",
    responsibility: "Account lifecycle and balance reachability"
  },
  {
    id: "transfer",
    label: "transfer-service",
    responsibility: "Transfer orchestration availability"
  },
  {
    id: "ledger",
    label: "ledger-service",
    responsibility: "Ledger read/write service reachability"
  },
  {
    id: "fraud",
    label: "fraud-service",
    responsibility: "Admin fraud operations reachability"
  },
  {
    id: "notification",
    label: "notification-service",
    responsibility: "Notification consumer and metadata reachability"
  }
] as const;

const backendBacklog: BacklogItem[] = [
  {
    title: "Kubernetes / EKS Rollout State",
    description: "Requires an admin gateway endpoint that reports cluster, namespace, deployment, and rollout health.",
    endpoint: "GET /v1/platform/kubernetes"
  },
  {
    title: "CI/CD Pipeline State",
    description: "Requires a deployment pipeline adapter before showing build, approval, or promotion status.",
    endpoint: "GET /v1/platform/pipelines"
  },
  {
    title: "Image Vulnerability Scan State",
    description: "Requires a scan-report endpoint that redacts registry details and exposes severity counts safely.",
    endpoint: "GET /v1/platform/scans"
  },
  {
    title: "Infrastructure Status",
    description: "Requires backend-curated infrastructure health before showing cloud, Terraform, or network status.",
    endpoint: "GET /v1/platform/infrastructure"
  }
];

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

const gatewayState = (health: GatewayHealthState): ServiceState => {
  if (health.status === "healthy") {
    return "healthy";
  }

  if (health.status === "degraded") {
    return "degraded";
  }

  return "unreachable";
};

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

const toServiceReadiness = (health: GatewayHealthState): ServiceReadiness[] =>
  serviceCatalog.map((service) => {
    if (service.id === "api-gateway") {
      return { ...service, state: gatewayState(health) };
    }

    return {
      ...service,
      state: serviceStateFromValue(health.services[service.id] ?? health.services[service.label])
    };
  });

const summarize = (services: ServiceReadiness[]) => {
  const healthy = services.filter((service) => service.state === "healthy").length;
  const degraded = services.filter((service) => service.state === "degraded").length;
  const unreachable = services.filter((service) => service.state === "unreachable").length;
  const unknown = services.filter((service) => service.state === "unknown").length;

  return {
    degraded,
    healthy,
    ready: degraded === 0 && unreachable === 0 && unknown === 0 && services.length > 0,
    total: services.length,
    unknown,
    unreachable
  };
};

export const PlatformHealthPage = ({
  getSession = readStoredSession,
  platformHealthClient = defaultPlatformHealthClient
}: PlatformHealthPageProps): ReactElement => {
  const session = getSession();
  const [state, setState] = useState<HealthState>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const loadHealth = async (): Promise<void> => {
    setState({ status: "loading" });

    try {
      const health = await platformHealthClient.getHealth();
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
    () => (state.status === "ready" ? toServiceReadiness(state.health) : []),
    [state]
  );
  const summary = useMemo(() => summarize(services), [services]);
  const readinessStatus = state.status === "ready" && summary.ready ? "ready" : "not ready";

  return (
    <div className="grid gap-6">
      <PageHeader
        actions={
          <>
            <StatusChip status="info">{session?.role ?? "unknown"}</StatusChip>
            <Button loading={refreshing} onClick={refresh} variant="secondary">
              Refresh Health
            </Button>
          </>
        }
        description="Admin runtime readiness backed only by the gateway health response. Unsupported platform data is tracked as backend work, not shown as live."
        eyebrow="Platform Health"
        title="Runtime Readiness"
      />

      <ContentGrid>
        <MetricCard
          label="Readiness Gate"
          status={readinessStatus === "ready" ? "success" : "warning"}
          value={readinessStatus}
        />
        <MetricCard label="Reachable Services" status="success" value={`${summary.healthy}/${summary.total}`} />
        <MetricCard
          label="Degraded / Unreachable"
          status={summary.degraded + summary.unreachable > 0 ? "error" : "success"}
          value={`${summary.degraded}/${summary.unreachable}`}
        />
        <MetricCard label="Platform Backlog" status="warning" value={String(backendBacklog.length)} />
      </ContentGrid>

      {state.status === "loading" ? <Skeleton aria-label="platform health loading" className="min-h-[30rem]" /> : null}
      {state.status === "error" ? (
        <EmptyState description={state.message} title="Platform readiness unavailable" tone="error" />
      ) : null}
      {state.status === "ready" ? (
        <PlatformHealthContent health={state.health} services={services} summary={summary} />
      ) : null}
    </div>
  );
};

interface PlatformHealthContentProps {
  health: GatewayHealthState;
  services: ServiceReadiness[];
  summary: ReturnType<typeof summarize>;
}

const PlatformHealthContent = ({
  health,
  services,
  summary
}: PlatformHealthContentProps): ReactElement => (
  <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.8fr)]">
    <section className="grid content-start gap-5 rounded-lg bg-surface-container-low p-4">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg bg-surface-container-lowest p-5">
        <div>
          <h3 className="text-headline-sm font-black text-on-surface">Gateway Health Summary</h3>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Live readiness is limited to service reachability from `/health`.
          </p>
        </div>
        <StatusChip status={health.status === "healthy" ? "success" : health.status === "degraded" ? "warning" : "error"}>
          {health.message}
        </StatusChip>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => (
          <ServiceReadinessCard key={service.id} service={service} />
        ))}
      </div>
    </section>

    <section className="grid content-start gap-5 rounded-lg bg-surface-container-low p-4">
      <article className="grid gap-4 rounded-lg bg-surface-container-lowest p-5">
        <StatusChip status={summary.ready ? "success" : "warning"}>
          {summary.ready ? "Ready" : "Attention Required"}
        </StatusChip>
        <h3 className="text-title-lg font-black text-on-surface">Readiness Decision</h3>
        <p className="text-body-sm leading-6 text-on-surface-variant">
          This decision is derived only from gateway reachability. Kubernetes, deployment, image scan, and cloud
          infrastructure readiness are excluded until backend endpoints exist.
        </p>
        <dl className="grid gap-3">
          <ReadinessFact label="Healthy" status="success" value={String(summary.healthy)} />
          <ReadinessFact label="Degraded" status="warning" value={String(summary.degraded)} />
          <ReadinessFact label="Unreachable" status="error" value={String(summary.unreachable)} />
          <ReadinessFact label="Unknown" status="neutral" value={String(summary.unknown)} />
        </dl>
      </article>

      <section className="grid gap-4 rounded-lg bg-surface-container-lowest p-5">
        <div>
          <StatusChip status="warning">Backend Backlog</StatusChip>
          <h3 className="mt-3 text-title-lg font-black text-on-surface">Unsupported Platform Signals</h3>
          <p className="mt-2 text-body-sm leading-6 text-on-surface-variant">
            These cards are not live. They identify the admin gateway work needed before production readiness can show
            deployment or infrastructure state.
          </p>
        </div>
        <div className="grid gap-3">
          {backendBacklog.map((item) => (
            <BacklogCard item={item} key={item.title} />
          ))}
        </div>
      </section>
    </section>
  </div>
);

interface ServiceReadinessCardProps {
  service: ServiceReadiness;
}

const ServiceReadinessCard = ({ service }: ServiceReadinessCardProps): ReactElement => (
  <article className="grid gap-4 rounded-lg bg-surface-container-lowest p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="grid gap-1">
        <h3 className="text-title-md font-black text-on-surface">{service.label}</h3>
        <p className="text-body-sm leading-6 text-on-surface-variant">{service.responsibility}</p>
      </div>
      <StatusChip status={stateTone(service.state)}>{service.state}</StatusChip>
    </div>
    <p className="font-mono text-xs font-bold text-on-surface-variant">
      Source: {service.id === "api-gateway" ? "/health status" : `/health services.${service.id}`}
    </p>
  </article>
);

interface BacklogCardProps {
  item: BacklogItem;
}

const BacklogCard = ({ item }: BacklogCardProps): ReactElement => (
  <article className="grid gap-2 rounded-lg bg-surface-container-low p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <h4 className="text-body-md font-black text-on-surface">{item.title}</h4>
      <StatusChip status="neutral">Not live</StatusChip>
    </div>
    <p className="text-body-sm leading-6 text-on-surface-variant">{item.description}</p>
    <p className="font-mono text-xs font-bold text-on-surface-variant">{item.endpoint}</p>
  </article>
);

interface ReadinessFactProps {
  label: string;
  status: ChipStatus;
  value: string;
}

const ReadinessFact = ({ label, status, value }: ReadinessFactProps): ReactElement => (
  <div className="flex items-center justify-between gap-4 rounded-lg bg-surface-container-low p-3">
    <dt className="text-label-sm font-black uppercase text-on-surface-variant">{label}</dt>
    <dd className="flex items-center gap-2 text-body-sm font-black text-on-surface">
      <StatusChip status={status}>{status}</StatusChip>
      {value}
    </dd>
  </div>
);
