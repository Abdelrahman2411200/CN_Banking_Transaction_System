import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { ContentGrid, PageHeader } from "../../components/layout";
import { Button, EmptyState, MetricCard, Skeleton, StatusChip } from "../../components/primitives";
import type { ApiResult } from "../../lib/api/client";
import {
  getNotifications,
  type NotificationOverview,
  type NotificationRecord
} from "../../lib/api/notifications";
import type { AuthSession } from "../auth/session";
import { readStoredSession } from "../auth/session";

export interface NotificationClient {
  getNotifications: (session: AuthSession | null) => Promise<ApiResult<NotificationOverview>>;
}

export interface NotificationCenterPageProps {
  getSession?: () => AuthSession | null;
  notificationClient?: NotificationClient;
}

type NotificationState =
  | { status: "loading" }
  | { status: "ready"; overview: NotificationOverview; requestId?: string }
  | { status: "error"; message: string };

type ChipStatus = "success" | "warning" | "error" | "info" | "neutral" | "unknown";

const defaultNotificationClient: NotificationClient = {
  getNotifications: (session) => getNotifications({ session })
};

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  year: "numeric"
});

const formatTimestamp = (value?: string): string => {
  if (!value) {
    return "Pending timestamp";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Pending timestamp" : timestampFormatter.format(date);
};

const titleCase = (value: string): string =>
  value
    .replace(/[_-]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const statusTone = (status?: string): ChipStatus => {
  const normalized = status?.toLowerCase();

  if (!normalized) {
    return "neutral";
  }

  if (["sent", "delivered", "success", "completed"].includes(normalized)) {
    return "success";
  }

  if (["failed", "error", "bounced", "dropped"].includes(normalized)) {
    return "error";
  }

  if (["skipped", "retrying", "deferred"].includes(normalized)) {
    return "warning";
  }

  if (["pending", "queued", "processing"].includes(normalized)) {
    return "info";
  }

  return "neutral";
};

const channelTone = (channel?: string): ChipStatus => {
  const normalized = channel?.toLowerCase();

  if (normalized === "email") {
    return "info";
  }

  if (normalized === "sms") {
    return "warning";
  }

  if (normalized === "push") {
    return "success";
  }

  return "neutral";
};

const messageForFailure = (result: ApiResult<unknown>): string => {
  if (result.ok) {
    return "Notification data loaded.";
  }

  const requestSuffix = result.requestId ? ` Reference ${result.requestId}.` : "";

  if (result.status === 403 || result.error === "forbidden") {
    return `Notifications are restricted to admin sessions.${requestSuffix}`;
  }

  if (result.status === 0 || result.status === 503 || result.error === "service_degraded") {
    return `Notification service data is unavailable. Try again after the gateway recovers.${requestSuffix}`;
  }

  if (result.status === 429 || result.error === "rate_limit_exceeded") {
    return `The notification gateway is rate limiting this session.${requestSuffix}`;
  }

  return `${result.error}.${requestSuffix}`.trim();
};

export const NotificationCenterPage = ({
  getSession = readStoredSession,
  notificationClient = defaultNotificationClient
}: NotificationCenterPageProps): ReactElement => {
  const session = getSession();
  const [state, setState] = useState<NotificationState>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = async (): Promise<void> => {
    setState({ status: "loading" });
    const result = await notificationClient.getNotifications(session);

    if (!result.ok) {
      setState({ status: "error", message: messageForFailure(result) });
      return;
    }

    setState({ status: "ready", overview: result.data, requestId: result.requestId });
  };

  useEffect(() => {
    void loadNotifications();
  }, []);

  const refresh = (): void => {
    setRefreshing(true);
    void loadNotifications().finally(() => setRefreshing(false));
  };

  const overview = state.status === "ready" ? state.overview : undefined;
  const metrics = useMemo(
    () => [
      {
        label: "Timeline Records",
        status: overview && overview.records.length > 0 ? "info" : "neutral",
        value: String(overview?.records.length ?? 0)
      },
      {
        label: "Channels",
        status: overview && overview.channels.length > 0 ? "success" : "neutral",
        value: String(overview?.channels.length ?? 0)
      },
      {
        label: "Topics",
        status: overview && overview.subscribedTopics.length > 0 ? "info" : "neutral",
        value: String(overview?.subscribedTopics.length ?? 0)
      },
      {
        label: "Persistence",
        status: overview?.persistence === "none" ? "warning" : "neutral",
        value: overview?.persistence ? titleCase(overview.persistence) : "Unknown"
      }
    ] satisfies Array<{ label: string; status: ChipStatus; value: string }>,
    [overview]
  );

  return (
    <div className="grid gap-6">
      <PageHeader
        actions={
          <>
            <StatusChip status={session?.role === "admin" ? "info" : "warning"}>
              {session?.role ?? "unknown"}
            </StatusChip>
            <Button loading={refreshing} onClick={refresh} variant="secondary">
              Refresh
            </Button>
          </>
        }
        description="Read the admin notification stream exactly as exposed by the gateway. Mutation actions stay hidden until supported endpoints exist."
        eyebrow="Notification Center"
        title="Notification Hub"
      />

      <ContentGrid>
        {metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} status={metric.status} value={metric.value} />
        ))}
      </ContentGrid>

      {state.status === "loading" ? <Skeleton aria-label="notifications loading" className="min-h-[30rem]" /> : null}
      {state.status === "error" ? (
        <EmptyState description={state.message} title="Notifications unavailable" tone="error" />
      ) : null}
      {state.status === "ready" ? <NotificationContent overview={state.overview} requestId={state.requestId} /> : null}
    </div>
  );
};

interface NotificationContentProps {
  overview: NotificationOverview;
  requestId?: string;
}

const NotificationContent = ({ overview, requestId }: NotificationContentProps): ReactElement => (
  <div className="grid gap-6 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.35fr)]">
    <section className="grid content-start gap-5 rounded-lg bg-surface-container-low p-4">
      <div className="grid gap-5 rounded-lg bg-surface-container-lowest p-5">
        <div className="grid gap-2">
          <h3 className="text-title-lg font-black text-on-surface">Gateway Subscription State</h3>
          <p className="text-body-sm text-on-surface-variant">
            The backend currently reports event-consumer metadata and read-only notification records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {overview.mode ? <StatusChip status="info">{titleCase(overview.mode)}</StatusChip> : null}
          {overview.persistence ? (
            <StatusChip status={overview.persistence === "none" ? "warning" : "neutral"}>
              {`Persistence ${overview.persistence}`}
            </StatusChip>
          ) : null}
          {requestId ? <StatusChip status="neutral">{`Request ${requestId}`}</StatusChip> : null}
        </div>
      </div>

      <MetadataBlock emptyLabel="No channels returned" items={overview.channels} label="Channels" />
      <MetadataBlock emptyLabel="No subscribed topics returned" items={overview.subscribedTopics} label="Subscribed Topics" />

      <aside className="rounded-lg bg-surface-container-lowest p-5" role="note">
        <StatusChip status="warning">Read-only</StatusChip>
        <p className="mt-3 text-body-sm leading-6 text-on-surface-variant">
          Resend, acknowledge, mark-read, and creation actions are unavailable until the backend exposes endpoints.
        </p>
      </aside>
    </section>

    <NotificationTimeline records={overview.records} />
  </div>
);

interface MetadataBlockProps {
  emptyLabel: string;
  items: string[];
  label: string;
}

const MetadataBlock = ({ emptyLabel, items, label }: MetadataBlockProps): ReactElement => (
  <section className="grid gap-3 rounded-lg bg-surface-container-lowest p-5">
    <h3 className="text-label-lg font-black uppercase text-on-surface-variant">{label}</h3>
    {items.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <StatusChip key={item} status="neutral">
            {item}
          </StatusChip>
        ))}
      </div>
    ) : (
      <p className="text-body-sm text-on-surface-variant">{emptyLabel}</p>
    )}
  </section>
);

interface NotificationTimelineProps {
  records: NotificationRecord[];
}

const NotificationTimeline = ({ records }: NotificationTimelineProps): ReactElement => {
  if (records.length === 0) {
    return (
      <EmptyState
        description="The gateway returned subscription metadata but no persisted notification records. Timeline actions remain read-only."
        title="No notifications recorded"
      />
    );
  }

  return (
    <section className="grid content-start gap-5 rounded-lg bg-surface-container-low p-4">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg bg-surface-container-lowest p-5">
        <div>
          <h3 className="text-headline-sm font-black text-on-surface">Live Notification Timeline</h3>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Records returned by the admin notification gateway.
          </p>
        </div>
        <StatusChip status="info">{records.length} loaded</StatusChip>
      </div>
      <div className="grid gap-3">
        {records.map((record) => (
          <NotificationTimelineItem key={record.id} record={record} />
        ))}
      </div>
    </section>
  );
};

interface NotificationTimelineItemProps {
  record: NotificationRecord;
}

const NotificationTimelineItem = ({ record }: NotificationTimelineItemProps): ReactElement => (
  <article className="grid gap-4 rounded-lg bg-surface-container-lowest p-5 md:grid-cols-[minmax(0,1fr)_auto]">
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {record.status ? <StatusChip status={statusTone(record.status)}>{record.status}</StatusChip> : null}
        {record.channel ? <StatusChip status={channelTone(record.channel)}>{record.channel}</StatusChip> : null}
        {record.topic ? <StatusChip status="neutral">{record.topic}</StatusChip> : null}
      </div>
      <div className="grid gap-1">
        <h3 className="text-title-md font-black text-on-surface">
          {record.subject ?? titleCase(record.type)}
        </h3>
        <p className="text-body-sm leading-6 text-on-surface-variant">
          {record.message ?? "No message body returned by the gateway."}
        </p>
      </div>
      <dl className="grid gap-2 text-body-sm text-on-surface-variant sm:grid-cols-2">
        <NotificationFact label="Recipient" value={record.recipient ?? "Not provided"} />
        <NotificationFact label="Record ID" value={record.id} />
        {record.transferId ? <NotificationFact label="Transfer ID" value={record.transferId} /> : null}
        {record.accountId ? <NotificationFact label="Account ID" value={record.accountId} /> : null}
      </dl>
    </div>
    <div className="text-left md:text-right">
      <p className="text-label-sm font-black uppercase text-on-surface-variant">Created</p>
      <p className="mt-1 text-body-sm font-bold text-on-surface">{formatTimestamp(record.createdAt)}</p>
    </div>
  </article>
);

interface NotificationFactProps {
  label: string;
  value: string;
}

const NotificationFact = ({ label, value }: NotificationFactProps): ReactElement => (
  <div className="grid gap-1 rounded-lg bg-surface-container-low p-3">
    <dt className="text-label-sm font-black uppercase text-on-surface-variant">{label}</dt>
    <dd className="break-words font-mono text-xs font-bold text-on-surface">{value}</dd>
  </div>
);
