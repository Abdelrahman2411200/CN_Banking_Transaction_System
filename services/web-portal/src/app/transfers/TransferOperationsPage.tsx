import type { FormEvent, ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ContentGrid, PageHeader } from "../../components/layout";
import { Button, EmptyState, Input, MetricCard, Skeleton, StatusChip } from "../../components/primitives";
import type { ApiResult } from "../../lib/api/client";
import {
  createTransfer,
  generateIdempotencyKey,
  getTransfer,
  type CreateTransferInput,
  type SagaStep,
  type TransferRecord,
  type TransferStatus
} from "../../lib/api/transfers";
import type { AuthSession } from "../auth/session";
import { readStoredSession } from "../auth/session";

export interface TransferClient {
  create: (
    input: CreateTransferInput,
    session: AuthSession | null,
    idempotencyKey: string
  ) => Promise<ApiResult<TransferRecord>>;
  get: (transferId: string, session: AuthSession | null) => Promise<ApiResult<TransferRecord>>;
}

export interface TransferOperationsPageProps {
  transferClient?: TransferClient;
  getSession?: () => AuthSession | null;
}

interface TransferFields {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
}

interface TransferErrors {
  fromAccountId?: string;
  toAccountId?: string;
  amount?: string;
}

type DetailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; transfer: TransferRecord }
  | { status: "error"; message: string; requestId?: string };

type Notice = { status: "success" | "warning" | "error" | "info"; title: string; message: string } | null;
type TransferMetricStatus = "success" | "warning" | "error" | "info" | "neutral";

interface TransferMetric {
  label: string;
  status: TransferMetricStatus;
  value: string;
}

const defaultTransferClient: TransferClient = {
  create: (input, session, idempotencyKey) => createTransfer(input, { idempotencyKey, session }),
  get: (transferId, session) => getTransfer(transferId, { session })
};

const accountIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const moneyPattern = /^\d+(\.\d{1,2})?$/;

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
  month: "short",
  year: "numeric"
});

export const validateTransferRequest = (fields: TransferFields): TransferErrors => {
  const errors: TransferErrors = {};
  const fromAccountId = fields.fromAccountId.trim();
  const toAccountId = fields.toAccountId.trim();
  const amount = fields.amount.trim();

  if (!accountIdPattern.test(fromAccountId)) {
    errors.fromAccountId = "Enter a valid source account UUID.";
  }

  if (!accountIdPattern.test(toAccountId)) {
    errors.toAccountId = "Enter a valid destination account UUID.";
  }

  if (fromAccountId && toAccountId && fromAccountId.toLowerCase() === toAccountId.toLowerCase()) {
    errors.toAccountId = "Destination must use a different account UUID.";
  }

  if (!moneyPattern.test(amount) || Number(amount) <= 0) {
    errors.amount = "Use a positive USD amount with up to 2 decimals.";
  }

  return errors;
};

export const validateTransferId = (transferId: string): string | undefined =>
  accountIdPattern.test(transferId.trim()) ? undefined : "Enter a valid transfer UUID.";

const formatMoney = (value: string): string => moneyFormatter.format(Number(value || 0));

const formatDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Pending timestamp" : dateFormatter.format(date);
};

const humanizeStatus = (status: TransferStatus): string =>
  status.replace(/_/g, " ");

const statusForTransfer = (status: TransferStatus): TransferMetricStatus => {
  if (status === "completed") {
    return "success";
  }

  if (status === "initiated") {
    return "info";
  }

  if (status === "compensating") {
    return "warning";
  }

  return "error";
};

const messageForFailure = (result: ApiResult<unknown>): Notice => {
  if (result.ok) {
    return null;
  }

  const requestSuffix = result.requestId ? ` Reference ${result.requestId}.` : "";

  if (result.status === 400 || result.error === "validation_error") {
    return {
      status: "error",
      title: "Transfer Validation Failed",
      message: `The transfer request did not satisfy gateway constraints.${requestSuffix}`
    };
  }

  if (result.status === 404 || result.error === "not_found") {
    return {
      status: "error",
      title: "Transfer Not Found",
      message: `No transfer matched that identifier.${requestSuffix}`
    };
  }

  if (result.status === 422 || result.error === "insufficient_funds") {
    return {
      status: "error",
      title: "Insufficient Funds",
      message: `The source account cannot cover this transfer amount.${requestSuffix}`
    };
  }

  if (result.status === 423 || result.error === "account_frozen") {
    return {
      status: "error",
      title: "Account Frozen",
      message: `One of the accounts is frozen and cannot participate in a transfer.${requestSuffix}`
    };
  }

  if (result.status === 0 || result.status === 503 || result.error === "service_degraded") {
    return {
      status: "error",
      title: "Gateway Unavailable",
      message: `Transfer services are unavailable. Try again after the gateway recovers.${requestSuffix}`
    };
  }

  return {
    status: "error",
    title: "Transfer Request Failed",
    message: `${result.error}.${requestSuffix}`.trim()
  };
};

export const TransferOperationsPage = ({
  transferClient = defaultTransferClient,
  getSession = readStoredSession
}: TransferOperationsPageProps): ReactElement => {
  const { id: routeTransferId } = useParams();
  const navigate = useNavigate();
  const session = getSession();
  const submittingRef = useRef(false);
  const [fields, setFields] = useState<TransferFields>({ amount: "", fromAccountId: "", toAccountId: "" });
  const [errors, setErrors] = useState<TransferErrors>({});
  const [lookupId, setLookupId] = useState(routeTransferId ?? "");
  const [lookupError, setLookupError] = useState<string | undefined>();
  const [detailState, setDetailState] = useState<DetailState>({ status: "idle" });
  const [notice, setNotice] = useState<Notice>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => generateIdempotencyKey());
  const [mutation, setMutation] = useState<"create" | "lookup" | "refresh" | "copy" | null>(null);

  const loadTransfer = async (transferId: string): Promise<void> => {
    const nextLookupError = validateTransferId(transferId);
    setLookupError(nextLookupError);

    if (nextLookupError) {
      setDetailState({ status: "error", message: nextLookupError });
      return;
    }

    setDetailState({ status: "loading" });
    const result = await transferClient.get(transferId.trim(), session);

    if (!result.ok) {
      const failure = messageForFailure(result);
      setDetailState({
        status: "error",
        message: failure?.message ?? result.error,
        requestId: result.requestId
      });
      return;
    }

    setDetailState({ status: "ready", transfer: result.data });
  };

  useEffect(() => {
    if (!routeTransferId) {
      setDetailState({ status: "idle" });
      return;
    }

    setLookupId(routeTransferId);
    void loadTransfer(routeTransferId);
  }, [routeTransferId]);

  const metrics = useMemo<TransferMetric[]>(() => {
    const transfer = detailState.status === "ready" ? detailState.transfer : undefined;

    return [
      {
        label: "Transfer Status",
        status: transfer ? statusForTransfer(transfer.status) : "neutral",
        value: transfer ? humanizeStatus(transfer.status) : "No transfer"
      },
      {
        label: "Amount",
        status: transfer ? statusForTransfer(transfer.status) : "neutral",
        value: transfer ? formatMoney(transfer.amount) : "$0.00"
      },
      {
        label: "Saga Step",
        status: transfer ? statusForTransfer(transfer.status) : "neutral",
        value: transfer?.sagaState.currentStep ?? "create"
      },
      {
        label: "Idempotency",
        status: "info",
        value: idempotencyKey
      }
    ];
  }, [detailState, idempotencyKey]);

  const updateField = (key: keyof TransferFields, value: string): void => {
    setFields((current) => ({ ...current, [key]: value }));
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (submittingRef.current) {
      return;
    }

    const nextErrors = validateTransferRequest(fields);
    setErrors(nextErrors);
    setNotice(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    submittingRef.current = true;
    setMutation("create");
    const keyForRequest = idempotencyKey;
    const result = await transferClient.create(
      {
        amount: fields.amount.trim(),
        fromAccountId: fields.fromAccountId.trim(),
        toAccountId: fields.toAccountId.trim()
      },
      session,
      keyForRequest
    );
    submittingRef.current = false;
    setMutation(null);

    if (!result.ok) {
      setNotice(messageForFailure(result));
      return;
    }

    setFields({ amount: "", fromAccountId: "", toAccountId: "" });
    setIdempotencyKey(generateIdempotencyKey());
    setNotice({
      status: "success",
      title: "Transfer Initiated",
      message: `Transfer ${result.data.id} entered the saga monitor.`
    });
    void navigate(`/transfers/${result.data.id}`);
  };

  const submitLookup = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const nextLookupError = validateTransferId(lookupId);
    setLookupError(nextLookupError);
    setNotice(null);

    if (nextLookupError) {
      return;
    }

    setMutation("lookup");
    void navigate(`/transfers/${lookupId.trim()}`);
    setMutation(null);
  };

  const refreshTransfer = async (): Promise<void> => {
    if (detailState.status !== "ready") {
      return;
    }

    setMutation("refresh");
    await loadTransfer(detailState.transfer.id);
    setMutation(null);
  };

  const copyTransferId = async (): Promise<void> => {
    if (detailState.status !== "ready") {
      return;
    }

    setMutation("copy");
    await navigator.clipboard?.writeText(detailState.transfer.id).catch(() => undefined);
    setMutation(null);
    setNotice({
      status: "info",
      title: "Transfer ID Ready",
      message: detailState.transfer.id
    });
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        actions={<StatusChip status="info">{session?.role ?? "customer"}</StatusChip>}
        description="Initiate transfer sagas, monitor distributed state, and preserve idempotent gateway writes."
        eyebrow="Transfer Operations"
        title={routeTransferId ? "Transfer Detail" : "Transfer Funds"}
      />

      {notice ? <TransferNotice notice={notice} /> : null}

      <ContentGrid>
        {metrics.map((metric) => (
          <MetricCard
            className={metric.label === "Idempotency" ? "lg:col-span-2" : undefined}
            key={metric.label}
            label={metric.label}
            status={metric.status}
            value={metric.value}
          />
        ))}
      </ContentGrid>

      <section className="grid gap-6 xl:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.4fr)]">
        <div className="grid content-start gap-6">
          <section className="grid gap-5 rounded-lg bg-surface-container-low p-4">
            <div className="rounded-lg bg-surface-container-lowest p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-title-lg font-black text-on-surface">Initiate Transfer</h3>
                  <p className="mt-2 text-body-sm text-on-surface-variant">
                    Transactional Saga Protocol v2.4.
                  </p>
                </div>
                <div className="grid min-w-0 max-w-full gap-1 text-left sm:text-right">
                  <span className="text-label-sm font-black uppercase text-on-surface-variant">Idempotency-Key</span>
                  <code className="block max-w-full break-all font-mono text-xs font-bold text-primary">{idempotencyKey}</code>
                </div>
              </div>

              <form className="mt-5 grid gap-4" noValidate onSubmit={(event) => void submitCreate(event)}>
                <Input
                  error={errors.fromAccountId}
                  label="Source Account UUID"
                  name="fromAccountId"
                  onChange={(event) => updateField("fromAccountId", event.currentTarget.value)}
                  placeholder="123e4567-e89b-12d3-a456-426614174000"
                  value={fields.fromAccountId}
                />
                <Input
                  error={errors.toAccountId}
                  label="Destination Account UUID"
                  name="toAccountId"
                  onChange={(event) => updateField("toAccountId", event.currentTarget.value)}
                  placeholder="987e6543-e21b-12d3-a456-426614174999"
                  value={fields.toAccountId}
                />
                <Input
                  error={errors.amount}
                  inputMode="decimal"
                  label="Transfer Amount"
                  name="amount"
                  onChange={(event) => updateField("amount", event.currentTarget.value)}
                  placeholder="1250.00"
                  value={fields.amount}
                />
                <Button className="w-full" loading={mutation === "create"} type="submit">
                  Initiate Transfer
                </Button>
              </form>
            </div>
          </section>

          <section className="grid gap-5 rounded-lg bg-surface-container-low p-4">
            <div className="rounded-lg bg-surface-container-lowest p-5">
              <h3 className="text-title-lg font-black text-on-surface">Saga Lookup</h3>
              <p className="mt-2 text-body-sm text-on-surface-variant">
                Resolve a transfer saga by transfer UUID.
              </p>
              <form className="mt-5 grid gap-4" noValidate onSubmit={submitLookup}>
                <Input
                  error={lookupError}
                  label="Transfer UUID"
                  name="transferId"
                  onChange={(event) => setLookupId(event.currentTarget.value)}
                  placeholder="123e4567-e89b-12d3-a456-426614174000"
                  value={lookupId}
                />
                <Button className="w-full" loading={mutation === "lookup"} type="submit" variant="secondary">
                  Monitor Transfer
                </Button>
              </form>
            </div>
          </section>
        </div>

        <TransferDetailPanel
          detailState={detailState}
          mutation={mutation}
          onCopy={() => void copyTransferId()}
          onRefresh={() => void refreshTransfer()}
        />
      </section>
    </div>
  );
};

interface TransferNoticeProps {
  notice: NonNullable<Notice>;
}

const TransferNotice = ({ notice }: TransferNoticeProps): ReactElement => (
  <aside className="rounded-lg bg-surface-container-low p-4" role={notice.status === "error" ? "alert" : "status"}>
    <div className="grid gap-2 rounded-lg bg-surface-container-lowest p-4">
      <StatusChip status={notice.status}>{notice.title}</StatusChip>
      <p className="break-words text-body-sm text-on-surface-variant">{notice.message}</p>
    </div>
  </aside>
);

interface TransferDetailPanelProps {
  detailState: DetailState;
  mutation: "create" | "lookup" | "refresh" | "copy" | null;
  onCopy: () => void;
  onRefresh: () => void;
}

const TransferDetailPanel = ({
  detailState,
  mutation,
  onCopy,
  onRefresh
}: TransferDetailPanelProps): ReactElement => {
  if (detailState.status === "loading") {
    return <Skeleton aria-label="transfer detail loading" className="min-h-[32rem]" />;
  }

  if (detailState.status === "error") {
    return (
      <EmptyState
        description={detailState.requestId ? `${detailState.message} Reference ${detailState.requestId}.` : detailState.message}
        title="Transfer detail unavailable"
        tone="error"
      />
    );
  }

  if (detailState.status === "idle") {
    return (
      <EmptyState
        description="Initiate a transfer or search by transfer UUID to load saga state, timestamps, and account legs."
        title="No transfer selected"
      />
    );
  }

  const { transfer } = detailState;
  const errorMessage = transfer.errorMessage ?? transfer.sagaState.error;

  return (
    <section className="grid content-start gap-6 rounded-lg bg-surface-container-low p-4">
      <article className="grid gap-6 rounded-lg bg-surface-container-lowest p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg bg-surface-container-high p-5">
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-headline-sm font-black text-on-surface">Transfer Saga</h3>
              <StatusChip status={statusForTransfer(transfer.status)}>{humanizeStatus(transfer.status)}</StatusChip>
            </div>
            <p className="break-all font-mono text-label-sm text-on-surface-variant">UUID: {transfer.id}</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-label-sm font-black uppercase text-on-surface-variant">Transfer Amount</p>
            <p className="mt-1 text-3xl font-black text-on-surface">{formatMoney(transfer.amount)}</p>
          </div>
        </div>

        {errorMessage ? (
          <TransferNotice
            notice={{
              status: transfer.status === "compensating" ? "warning" : "error",
              title: "Saga Exception",
              message: errorMessage
            }}
          />
        ) : null}

        <SagaVisualizer transfer={transfer} />

        <dl className="grid gap-4 md:grid-cols-2">
          <TransferFact label="Source Account" value={transfer.fromAccountId} />
          <TransferFact label="Destination Account" value={transfer.toAccountId} />
          <TransferFact label="Created" value={formatDate(transfer.createdAt)} />
          <TransferFact label="Updated" value={formatDate(transfer.updatedAt)} />
        </dl>

        <div className="flex flex-wrap gap-3">
          <Button loading={mutation === "refresh"} onClick={onRefresh} variant="secondary">
            Refresh Status
          </Button>
          <Button loading={mutation === "copy"} onClick={onCopy} variant="tertiary">
            Copy Transfer ID
          </Button>
          <Link
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-transparent px-4 py-2 text-sm font-bold text-on-surface shadow-[inset_0_0_0_1px_rgb(169_180_185_/_0.2)] transition hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface"
            to={`/transfers/${transfer.id}`}
          >
            Open Detail Route
          </Link>
        </div>
      </article>
    </section>
  );
};

interface SagaVisualizerProps {
  transfer: TransferRecord;
}

interface SagaNode {
  key: SagaStep;
  label: string;
  complete: boolean;
  active: boolean;
  failed: boolean;
}

const sagaStepOrder: SagaStep[] = ["create", "debit", "credit", "compensation", "completed"];

const buildSagaNodes = (transfer: TransferRecord): SagaNode[] => {
  const activeIndex = sagaStepOrder.indexOf(transfer.sagaState.currentStep);
  const terminalFailed = transfer.status === "failed" || transfer.status === "compensation_failed";

  return [
    {
      key: "create",
      label: "Created",
      complete: activeIndex > 0 || transfer.status !== "initiated",
      active: transfer.sagaState.currentStep === "create",
      failed: false
    },
    {
      key: "debit",
      label: "Debit Reserved",
      complete: transfer.sagaState.debitCompleted,
      active: transfer.sagaState.currentStep === "debit",
      failed: terminalFailed && !transfer.sagaState.debitCompleted
    },
    {
      key: "credit",
      label: "Credit Posted",
      complete: transfer.sagaState.creditCompleted,
      active: transfer.sagaState.currentStep === "credit",
      failed: terminalFailed && transfer.sagaState.debitCompleted && !transfer.sagaState.creditCompleted
    },
    {
      key: "compensation",
      label: "Compensation",
      complete: transfer.sagaState.compensationCompleted,
      active: transfer.sagaState.currentStep === "compensation" || transfer.status === "compensating",
      failed: transfer.status === "compensation_failed"
    },
    {
      key: "completed",
      label: "Completed",
      complete: transfer.status === "completed",
      active: transfer.sagaState.currentStep === "completed",
      failed: false
    }
  ];
};

const SagaVisualizer = ({ transfer }: SagaVisualizerProps): ReactElement => {
  const nodes = buildSagaNodes(transfer);

  return (
    <section className="grid gap-4 rounded-lg bg-surface-container-low p-4">
      <div>
        <h3 className="text-title-lg font-black text-on-surface">Active Transaction Saga</h3>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Current step: <span className="font-bold text-on-surface">{transfer.sagaState.currentStep}</span>
        </p>
      </div>
      <ol className="grid gap-3 md:grid-cols-5">
        {nodes.map((node) => (
          <li className="grid gap-2 rounded-lg bg-surface-container-lowest p-4" key={node.key}>
            <StatusChip status={node.failed ? "error" : node.complete ? "success" : node.active ? "warning" : "neutral"}>
              {node.failed ? "failed" : node.complete ? "complete" : node.active ? "active" : "pending"}
            </StatusChip>
            <p className="text-body-sm font-black text-on-surface">{node.label}</p>
          </li>
        ))}
      </ol>
    </section>
  );
};

interface TransferFactProps {
  label: string;
  value: string;
}

const TransferFact = ({ label, value }: TransferFactProps): ReactElement => (
  <div className="grid gap-1 rounded-lg bg-surface-container-low p-4">
    <dt className="text-label-sm font-black uppercase text-on-surface-variant">{label}</dt>
    <dd className="break-words text-body-md font-bold text-on-surface">{value}</dd>
  </div>
);
