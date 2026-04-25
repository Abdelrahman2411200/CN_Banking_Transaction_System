import type { FormEvent, ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ContentGrid, PageHeader } from "../../components/layout";
import { Button, EmptyState, Input, MetricCard, Skeleton, StatusChip } from "../../components/primitives";
import type { ApiResult } from "../../lib/api/client";
import {
  getAccountLedger,
  getLedgerStats,
  getTransferLedger,
  type LedgerEntry,
  type LedgerEntryStatus,
  type LedgerEntryType,
  type LedgerStats
} from "../../lib/api/ledger";
import { firstZodMessage, ledgerIdSchema } from "../../lib/forms/schemas";
import type { AuthSession } from "../auth/session";
import { readStoredSession } from "../auth/session";

export interface LedgerClient {
  getAccountEntries: (accountId: string, session: AuthSession | null) => Promise<ApiResult<LedgerEntry[]>>;
  getTransferEntries: (transferId: string, session: AuthSession | null) => Promise<ApiResult<LedgerEntry[]>>;
  getStats: (accountId: string, session: AuthSession | null) => Promise<ApiResult<LedgerStats>>;
}

export interface FinancialLedgerPageProps {
  ledgerClient?: LedgerClient;
  getSession?: () => AuthSession | null;
}

type LedgerScope = "account" | "transfer";

type LedgerState =
  | { status: "idle" }
  | { status: "loading"; scope: LedgerScope }
  | { status: "ready"; scope: LedgerScope; id: string; entries: LedgerEntry[]; stats?: LedgerStats; statsNotice?: Notice }
  | { status: "error"; scope: LedgerScope; message: string; requestId?: string };

type Notice = { status: "success" | "warning" | "error" | "info"; title: string; message: string };
type MetricStatus = "success" | "warning" | "error" | "info" | "neutral";

interface LedgerMetric {
  label: string;
  value: string;
  status: MetricStatus;
}

const defaultLedgerClient: LedgerClient = {
  getAccountEntries: (accountId, session) => getAccountLedger(accountId, { session }),
  getStats: (accountId, session) => getLedgerStats(accountId, { session }),
  getTransferEntries: (transferId, session) => getTransferLedger(transferId, { session })
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency"
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  year: "numeric"
});

export const validateLedgerId = (value: string, label: "account" | "transfer"): string | undefined => {
  const result = ledgerIdSchema(label).safeParse(value);

  return result.success ? undefined : firstZodMessage(result.error);
};

const formatMoney = (value: number | string): string => moneyFormatter.format(Number(value || 0));

const formatTimestamp = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Pending timestamp" : timestampFormatter.format(date);
};

const formatGroupLabel = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Pending timestamp" : dateFormatter.format(date);
};

const entryTypeStatus = (entryType: LedgerEntryType): MetricStatus =>
  entryType === "credit" ? "success" : "info";

const entryStatusTone = (status: LedgerEntryStatus): MetricStatus => {
  if (status === "completed") {
    return "success";
  }

  if (status === "reversed") {
    return "warning";
  }

  return "error";
};

const messageForFailure = (result: ApiResult<unknown>, scope: LedgerScope): Notice => {
  if (result.ok) {
    return { status: "success", title: "Ledger Ready", message: "Ledger data loaded." };
  }

  const requestSuffix = result.requestId ? ` Reference ${result.requestId}.` : "";

  if (result.status === 400 || result.error === "validation_error") {
    return {
      status: "error",
      title: "Ledger Validation Failed",
      message: `The ${scope} lookup did not satisfy gateway constraints.${requestSuffix}`
    };
  }

  if (result.status === 403 || result.error === "forbidden") {
    return {
      status: "warning",
      title: "Ledger Access Restricted",
      message: `This session cannot access that ledger resource.${requestSuffix}`
    };
  }

  if (result.status === 404 || result.error === "not_found") {
    return {
      status: "error",
      title: "Ledger Not Found",
      message: `No ledger entries matched that ${scope} identifier.${requestSuffix}`
    };
  }

  if (result.status === 0 || result.status === 503 || result.error === "service_degraded") {
    return {
      status: "error",
      title: "Gateway Unavailable",
      message: `Ledger services are unavailable. Try again after the gateway recovers.${requestSuffix}`
    };
  }

  return {
    status: "error",
    title: "Ledger Request Failed",
    message: `${result.error}.${requestSuffix}`.trim()
  };
};

const statsNoticeFor = (result: ApiResult<LedgerStats>): Notice | undefined => {
  if (result.ok) {
    return undefined;
  }

  if (result.status === 403 || result.error === "forbidden") {
    return {
      status: "warning",
      title: "Stats Restricted",
      message: "Ledger stats are restricted for this session. Account entries remain available."
    };
  }

  return {
    status: "warning",
    title: "Stats Unavailable",
    message: `Ledger entries loaded, but stats returned ${result.error}.`
  };
};

const groupEntriesByDate = (entries: LedgerEntry[]): Array<{ label: string; entries: LedgerEntry[] }> => {
  const groups = new Map<string, LedgerEntry[]>();

  entries.forEach((entry) => {
    const label = formatGroupLabel(entry.createdAt);
    groups.set(label, [...(groups.get(label) ?? []), entry]);
  });

  return Array.from(groups.entries()).map(([label, groupEntries]) => ({ label, entries: groupEntries }));
};

export const FinancialLedgerPage = ({
  ledgerClient = defaultLedgerClient,
  getSession = readStoredSession
}: FinancialLedgerPageProps): ReactElement => {
  const { transferId: routeTransferId } = useParams();
  const navigate = useNavigate();
  const session = getSession();
  const [accountId, setAccountId] = useState("");
  const [transferId, setTransferId] = useState(routeTransferId ?? "");
  const [accountError, setAccountError] = useState<string | undefined>();
  const [transferError, setTransferError] = useState<string | undefined>();
  const [ledgerState, setLedgerState] = useState<LedgerState>({ status: "idle" });
  const [mutation, setMutation] = useState<"account" | "transfer" | "refresh" | null>(null);

  const loadAccountLedger = async (nextAccountId: string): Promise<void> => {
    const validation = validateLedgerId(nextAccountId, "account");
    setAccountError(validation);

    if (validation) {
      setLedgerState({ status: "error", scope: "account", message: validation });
      return;
    }

    setLedgerState({ status: "loading", scope: "account" });
    const entriesResult = await ledgerClient.getAccountEntries(nextAccountId.trim(), session);

    if (!entriesResult.ok) {
      const failure = messageForFailure(entriesResult, "account");
      setLedgerState({ status: "error", scope: "account", message: failure.message });
      return;
    }

    const statsResult = await ledgerClient.getStats(nextAccountId.trim(), session);
    setLedgerState({
      status: "ready",
      scope: "account",
      id: nextAccountId.trim(),
      entries: entriesResult.data,
      stats: statsResult.ok ? statsResult.data : undefined,
      statsNotice: statsNoticeFor(statsResult)
    });
  };

  const loadTransferLedger = async (nextTransferId: string): Promise<void> => {
    const validation = validateLedgerId(nextTransferId, "transfer");
    setTransferError(validation);

    if (validation) {
      setLedgerState({ status: "error", scope: "transfer", message: validation });
      return;
    }

    setLedgerState({ status: "loading", scope: "transfer" });
    const entriesResult = await ledgerClient.getTransferEntries(nextTransferId.trim(), session);

    if (!entriesResult.ok) {
      const failure = messageForFailure(entriesResult, "transfer");
      setLedgerState({ status: "error", scope: "transfer", message: failure.message });
      return;
    }

    setLedgerState({
      status: "ready",
      scope: "transfer",
      id: nextTransferId.trim(),
      entries: entriesResult.data
    });
  };

  useEffect(() => {
    if (!routeTransferId) {
      setLedgerState({ status: "idle" });
      return;
    }

    setTransferId(routeTransferId);
    void loadTransferLedger(routeTransferId);
  }, [routeTransferId]);

  const metrics = useMemo<LedgerMetric[]>(() => {
    const stats = ledgerState.status === "ready" ? ledgerState.stats : undefined;
    const entries = ledgerState.status === "ready" ? ledgerState.entries : [];
    const fallbackDebits = entries
      .filter((entry) => entry.entryType === "debit")
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const fallbackCredits = entries
      .filter((entry) => entry.entryType === "credit")
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const statsRestricted = ledgerState.status === "ready" && Boolean(ledgerState.statsNotice);

    return [
      {
        label: "Total Debits",
        status: statsRestricted ? "warning" : "info",
        value: stats ? formatMoney(stats.totalDebits) : statsRestricted ? "Restricted" : formatMoney(fallbackDebits)
      },
      {
        label: "Total Credits",
        status: statsRestricted ? "warning" : "success",
        value: stats ? formatMoney(stats.totalCredits) : statsRestricted ? "Restricted" : formatMoney(fallbackCredits)
      },
      {
        label: "Net Movement",
        status: stats ? (stats.net >= 0 ? "success" : "warning") : statsRestricted ? "warning" : "neutral",
        value: stats ? formatMoney(stats.net) : statsRestricted ? "Restricted" : formatMoney(fallbackCredits - fallbackDebits)
      },
      {
        label: "Entry Count",
        status: "neutral",
        value: String(stats?.entryCount ?? entries.length)
      }
    ];
  }, [ledgerState]);

  const submitAccountLookup = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const validation = validateLedgerId(accountId, "account");
    setAccountError(validation);

    if (validation) {
      return;
    }

    setMutation("account");
    void loadAccountLedger(accountId).finally(() => setMutation(null));
  };

  const submitTransferLookup = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const validation = validateLedgerId(transferId, "transfer");
    setTransferError(validation);

    if (validation) {
      return;
    }

    setMutation("transfer");
    void navigate(`/ledger/transfers/${transferId.trim()}`);
    setMutation(null);
  };

  const refreshLedger = (): void => {
    if (ledgerState.status !== "ready") {
      return;
    }

    setMutation("refresh");
    const refresh =
      ledgerState.scope === "account"
        ? loadAccountLedger(ledgerState.id)
        : loadTransferLedger(ledgerState.id);
    void refresh.finally(() => setMutation(null));
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        actions={<StatusChip status={session?.role === "admin" ? "success" : "info"}>{session?.role ?? "customer"}</StatusChip>}
        description="Lookup recorded ledger entries through the gateway and review account or transfer audit trails."
        eyebrow="Financial Ledger"
        title={routeTransferId ? "Transfer Ledger" : "Ledger Audit"}
      />

      <ContentGrid>
        {metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} status={metric.status} value={metric.value} />
        ))}
      </ContentGrid>

      {ledgerState.status === "ready" && ledgerState.statsNotice ? <LedgerNotice notice={ledgerState.statsNotice} /> : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.4fr)]">
        <div className="grid content-start gap-6">
          <section className="grid gap-5 rounded-lg bg-surface-container-low p-4">
            <div className="rounded-lg bg-surface-container-lowest p-5">
              <h3 className="text-title-lg font-black text-on-surface">Account Ledger Lookup</h3>
              <p className="mt-2 text-body-sm text-on-surface-variant">
                Resolve entries and stats by account UUID.
              </p>
              <form className="mt-5 grid gap-4" noValidate onSubmit={submitAccountLookup}>
                <Input
                  error={accountError}
                  label="Account UUID"
                  name="accountId"
                  onChange={(event) => setAccountId(event.currentTarget.value)}
                  placeholder="123e4567-e89b-12d3-a456-426614174000"
                  value={accountId}
                />
                <Button className="w-full" loading={mutation === "account"} type="submit">
                  Lookup Account Ledger
                </Button>
              </form>
            </div>
          </section>

          <section className="grid gap-5 rounded-lg bg-surface-container-low p-4">
            <div className="rounded-lg bg-surface-container-lowest p-5">
              <h3 className="text-title-lg font-black text-on-surface">Transfer Audit Lookup</h3>
              <p className="mt-2 text-body-sm text-on-surface-variant">
                Review debit and credit entries for a transfer UUID.
              </p>
              <form className="mt-5 grid gap-4" noValidate onSubmit={submitTransferLookup}>
                <Input
                  error={transferError}
                  label="Transfer UUID"
                  name="transferId"
                  onChange={(event) => setTransferId(event.currentTarget.value)}
                  placeholder="223e4567-e89b-12d3-a456-426614174111"
                  value={transferId}
                />
                <Button className="w-full" loading={mutation === "transfer"} type="submit" variant="secondary">
                  Lookup Transfer Audit
                </Button>
              </form>
            </div>
          </section>

          <section className="grid gap-3 rounded-lg bg-surface-container-low p-4">
            <div className="rounded-lg bg-surface-container-lowest p-5">
              <h3 className="text-title-lg font-black text-on-surface">Export</h3>
              <p className="mt-2 text-body-sm text-on-surface-variant">
                Export is reserved for a future backend endpoint. Current views stay read-only.
              </p>
            </div>
          </section>
        </div>

        <LedgerEntriesPanel ledgerState={ledgerState} mutation={mutation} onRefresh={refreshLedger} />
      </section>
    </div>
  );
};

interface LedgerNoticeProps {
  notice: Notice;
}

const LedgerNotice = ({ notice }: LedgerNoticeProps): ReactElement => (
  <aside className="rounded-lg bg-surface-container-low p-4" role={notice.status === "error" ? "alert" : "status"}>
    <div className="grid gap-2 rounded-lg bg-surface-container-lowest p-4">
      <StatusChip status={notice.status}>{notice.title}</StatusChip>
      <p className="text-body-sm text-on-surface-variant">{notice.message}</p>
    </div>
  </aside>
);

interface LedgerEntriesPanelProps {
  ledgerState: LedgerState;
  mutation: "account" | "transfer" | "refresh" | null;
  onRefresh: () => void;
}

const LedgerEntriesPanel = ({ ledgerState, mutation, onRefresh }: LedgerEntriesPanelProps): ReactElement => {
  if (ledgerState.status === "loading") {
    return <Skeleton aria-label="ledger entries loading" className="min-h-[32rem]" />;
  }

  if (ledgerState.status === "error") {
    return (
      <EmptyState
        description={ledgerState.requestId ? `${ledgerState.message} Reference ${ledgerState.requestId}.` : ledgerState.message}
        title="Ledger lookup failed"
        tone="error"
      />
    );
  }

  if (ledgerState.status === "idle") {
    return (
      <EmptyState
        description="Search by account UUID or transfer UUID to load recorded ledger entries."
        title="No ledger selected"
      />
    );
  }

  if (ledgerState.entries.length === 0) {
    return (
      <EmptyState
        description="The gateway returned an empty ledger for this lookup."
        title="No ledger entries"
      />
    );
  }

  const groups = groupEntriesByDate(ledgerState.entries);

  return (
    <section className="grid content-start gap-6 rounded-lg bg-surface-container-low p-4">
      <article className="grid gap-5 rounded-lg bg-surface-container-lowest p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-title-lg font-black text-on-surface">
              {ledgerState.scope === "account" ? "Account Entries" : "Transfer Entries"}
            </h3>
            <p className="mt-1 break-all font-mono text-label-sm text-on-surface-variant">{ledgerState.id}</p>
          </div>
          <Button loading={mutation === "refresh"} onClick={onRefresh} variant="secondary">
            Refresh Ledger
          </Button>
        </div>

        <div className="grid gap-6">
          {groups.map((group) => (
            <section className="grid gap-3" key={group.label}>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-container-low p-4">
                <h4 className="text-title-md font-black text-on-surface">{group.label}</h4>
                <StatusChip status="neutral">{group.entries.length} entries</StatusChip>
              </div>
              <div className="grid gap-3">
                {group.entries.map((entry) => (
                  <LedgerEntryRow entry={entry} key={entry.entryId} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </section>
  );
};

interface LedgerEntryRowProps {
  entry: LedgerEntry;
}

const LedgerEntryRow = ({ entry }: LedgerEntryRowProps): ReactElement => (
  <article className="grid gap-4 rounded-lg bg-surface-container-lowest p-4 shadow-[inset_0_0_0_1px_rgb(169_180_185_/_0.12)] md:grid-cols-[minmax(0,1fr)_auto]">
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={entryTypeStatus(entry.entryType)}>{entry.entryType}</StatusChip>
        <StatusChip status={entryStatusTone(entry.status)}>{entry.status}</StatusChip>
        <span className="text-label-sm font-bold text-on-surface-variant">{formatTimestamp(entry.createdAt)}</span>
      </div>
      <dl className="grid gap-3 md:grid-cols-2">
        <LedgerFact label="Entry ID" value={entry.entryId} />
        <LedgerFact label="Transfer ID" value={entry.transferId} to={`/ledger/transfers/${entry.transferId}`} />
        <LedgerFact label="Account ID" value={entry.accountId} />
        <LedgerFact label="Source Event" value={entry.sourceEvent || "Recorded ledger event"} />
      </dl>
    </div>
    <div className="grid content-start gap-1 text-left md:text-right">
      <p className="text-label-sm font-black uppercase text-on-surface-variant">Amount</p>
      <p className="text-2xl font-black text-on-surface">{formatMoney(entry.amount)}</p>
      <p className="break-all text-xs font-semibold text-on-surface-variant">
        {entry.fromAccountId} to {entry.toAccountId}
      </p>
    </div>
  </article>
);

interface LedgerFactProps {
  label: string;
  value: string;
  to?: string;
}

const LedgerFact = ({ label, to, value }: LedgerFactProps): ReactElement => (
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
