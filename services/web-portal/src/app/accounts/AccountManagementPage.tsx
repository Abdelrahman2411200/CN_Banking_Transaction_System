import type { FormEvent, ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ContentGrid, PageHeader } from "../../components/layout";
import { Button, EmptyState, Input, MetricCard, Select, Skeleton, StatusChip } from "../../components/primitives";
import type { ApiResult } from "../../lib/api/client";
import {
  createAccount,
  freezeAccount,
  getAccount,
  getAccountBalance,
  updateAccountKyc,
  type AccountBalance,
  type AccountKycStatus,
  type AccountRecord
} from "../../lib/api/accounts";
import type { AuthSession, UserRole } from "../auth/session";
import { readStoredSession } from "../auth/session";

export interface AccountClient {
  create: (input: { name: string; email: string; initialBalance: string }, session: AuthSession | null) => Promise<ApiResult<AccountRecord>>;
  get: (accountId: string, session: AuthSession | null) => Promise<ApiResult<AccountRecord>>;
  getBalance: (accountId: string, session: AuthSession | null) => Promise<ApiResult<AccountBalance>>;
  updateKyc: (accountId: string, kycStatus: AccountKycStatus, session: AuthSession | null) => Promise<ApiResult<AccountRecord>>;
  freeze: (accountId: string, session: AuthSession | null) => Promise<ApiResult<AccountRecord>>;
}

export interface AccountManagementPageProps {
  accountClient?: AccountClient;
  getSession?: () => AuthSession | null;
}

interface CreateFields {
  name: string;
  email: string;
  initialBalance: string;
}

interface CreateErrors {
  name?: string;
  email?: string;
  initialBalance?: string;
}

type DetailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; account: AccountRecord; balance?: AccountBalance; balanceError?: string }
  | { status: "error"; message: string; requestId?: string };

type Notice = { status: "success" | "warning" | "error"; title: string; message: string } | null;
type AccountMetricStatus = "success" | "warning" | "error" | "info" | "neutral";
interface AccountMetric {
  label: string;
  status: AccountMetricStatus;
  value: string;
}

const defaultAccountClient: AccountClient = {
  create: (input, session) => createAccount(input, { session }),
  freeze: (accountId, session) => freezeAccount(accountId, { session }),
  get: (accountId, session) => getAccount(accountId, { session }),
  getBalance: (accountId, session) => getAccountBalance(accountId, { session }),
  updateKyc: (accountId, kycStatus, session) => updateAccountKyc({ accountId, kycStatus }, { session })
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const moneyPattern = /^\d+(\.\d{1,2})?$/;
const accountIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export const validateCreateAccount = (fields: CreateFields): CreateErrors => {
  const errors: CreateErrors = {};

  if (fields.name.trim().length < 2) {
    errors.name = "Enter the account holder's legal name.";
  }

  if (!emailPattern.test(fields.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!moneyPattern.test(fields.initialBalance.trim())) {
    errors.initialBalance = "Use a non-negative USD amount with up to 2 decimals.";
  }

  return errors;
};

export const validateAccountId = (accountId: string): string | undefined =>
  accountIdPattern.test(accountId.trim()) ? undefined : "Enter a valid account UUID.";

const formatMoney = (value: string): string => moneyFormatter.format(Number(value || 0));

const formatDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Pending timestamp" : dateFormatter.format(date);
};

const statusForAccount = (status: AccountRecord["status"]): "success" | "warning" | "error" =>
  status === "active" ? "success" : status === "inactive" ? "warning" : "error";

const statusForKyc = (status: AccountKycStatus): "success" | "warning" | "error" =>
  status === "verified" ? "success" : status === "pending" ? "warning" : "error";

const canMutateAccount = (role: UserRole): boolean => role === "operator" || role === "admin";

const messageForFailure = (result: ApiResult<unknown>): Notice => {
  if (result.ok) {
    return null;
  }

  const requestSuffix = result.requestId ? ` Reference ${result.requestId}.` : "";

  if (result.status === 409 || result.error === "conflict") {
    return {
      status: "error",
      title: "Duplicate Account Identity",
      message: `An account with this email already exists.${requestSuffix}`
    };
  }

  if (result.status === 404 || result.error === "not_found") {
    return {
      status: "error",
      title: "Account Not Found",
      message: `No account record matched that identifier.${requestSuffix}`
    };
  }

  if (result.status === 403 || result.error === "forbidden") {
    return {
      status: "error",
      title: "Action Restricted",
      message: `This session cannot perform that account operation.${requestSuffix}`
    };
  }

  if (result.status === 0 || result.status === 503 || result.error === "service_degraded") {
    return {
      status: "error",
      title: "Gateway Unavailable",
      message: `Account services are unavailable. Try again after the gateway recovers.${requestSuffix}`
    };
  }

  return {
    status: "error",
    title: "Account Request Failed",
    message: `${result.error}.${requestSuffix}`.trim()
  };
};

export const AccountManagementPage = ({
  accountClient = defaultAccountClient,
  getSession = readStoredSession
}: AccountManagementPageProps): ReactElement => {
  const { id: routeAccountId } = useParams();
  const navigate = useNavigate();
  const session = getSession();
  const role = session?.role ?? "customer";
  const roleCanMutate = canMutateAccount(role);
  const [createFields, setCreateFields] = useState<CreateFields>({ email: "", initialBalance: "", name: "" });
  const [createErrors, setCreateErrors] = useState<CreateErrors>({});
  const [lookupId, setLookupId] = useState(routeAccountId ?? "");
  const [lookupError, setLookupError] = useState<string | undefined>();
  const [detailState, setDetailState] = useState<DetailState>({ status: "idle" });
  const [notice, setNotice] = useState<Notice>(null);
  const [mutation, setMutation] = useState<"create" | "lookup" | "kyc" | "freeze" | null>(null);
  const [kycSelection, setKycSelection] = useState<AccountKycStatus>("pending");

  const loadAccount = async (accountId: string): Promise<void> => {
    const nextLookupError = validateAccountId(accountId);
    setLookupError(nextLookupError);

    if (nextLookupError) {
      setDetailState({ status: "error", message: nextLookupError });
      return;
    }

    setDetailState({ status: "loading" });
    const accountResult = await accountClient.get(accountId, session);

    if (!accountResult.ok) {
      const failure = messageForFailure(accountResult);
      setDetailState({
        status: "error",
        message: failure?.message ?? accountResult.error,
        requestId: accountResult.requestId
      });
      return;
    }

    const balanceResult = await accountClient.getBalance(accountId, session);
    setKycSelection(accountResult.data.kycStatus);
    setDetailState({
      status: "ready",
      account: accountResult.data,
      balance: balanceResult.ok ? balanceResult.data : undefined,
      balanceError: balanceResult.ok ? undefined : balanceResult.error
    });
  };

  useEffect(() => {
    if (!routeAccountId) {
      setDetailState({ status: "idle" });
      return;
    }

    setLookupId(routeAccountId);
    void loadAccount(routeAccountId);
  }, [routeAccountId]);

  const metrics = useMemo<AccountMetric[]>(() => {
    const account = detailState.status === "ready" ? detailState.account : undefined;
    const balance = detailState.status === "ready" ? detailState.balance?.balance ?? detailState.account.balance : "0.00";

    return [
      { label: "Balance", value: formatMoney(balance), status: account ? statusForAccount(account.status) : "neutral" as const },
      { label: "Ledger Status", value: account?.status ?? "No account", status: account ? statusForAccount(account.status) : "neutral" as const },
      { label: "KYC Status", value: account?.kycStatus ?? "pending", status: account ? statusForKyc(account.kycStatus) : "warning" as const },
      { label: "Access Scope", value: roleCanMutate ? "Operator" : "Read only", status: roleCanMutate ? "info" : "neutral" as const }
    ];
  }, [detailState, roleCanMutate]);

  const updateCreateField = (key: keyof CreateFields, value: string): void => {
    setCreateFields((current) => ({ ...current, [key]: value }));
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const nextErrors = validateCreateAccount(createFields);
    setCreateErrors(nextErrors);
    setNotice(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setMutation("create");
    const result = await accountClient.create(
      {
        email: createFields.email.trim(),
        initialBalance: createFields.initialBalance.trim(),
        name: createFields.name.trim()
      },
      session
    );
    setMutation(null);

    if (!result.ok) {
      setNotice(messageForFailure(result));
      return;
    }

    setCreateFields({ email: "", initialBalance: "", name: "" });
    setNotice({
      status: "success",
      title: "Account Created",
      message: `${result.data.name} is registered in the account service.`
    });
    void navigate(`/accounts/${result.data.id}`);
  };

  const submitLookup = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const nextLookupError = validateAccountId(lookupId);
    setLookupError(nextLookupError);
    setNotice(null);

    if (nextLookupError) {
      return;
    }

    setMutation("lookup");
    void navigate(`/accounts/${lookupId.trim()}`);
    setMutation(null);
  };

  const submitKyc = async (): Promise<void> => {
    if (detailState.status !== "ready") {
      return;
    }

    setMutation("kyc");
    const result = await accountClient.updateKyc(detailState.account.id, kycSelection, session);
    setMutation(null);

    if (!result.ok) {
      setNotice(messageForFailure(result));
      return;
    }

    setNotice({
      status: "success",
      title: "KYC Updated",
      message: `KYC status changed to ${kycSelection}.`
    });
    await loadAccount(detailState.account.id);
  };

  const submitFreeze = async (): Promise<void> => {
    if (detailState.status !== "ready") {
      return;
    }

    setMutation("freeze");
    const result = await accountClient.freeze(detailState.account.id, session);
    setMutation(null);

    if (!result.ok) {
      setNotice(messageForFailure(result));
      return;
    }

    setNotice({
      status: "warning",
      title: "Account Frozen",
      message: `${result.data.name} is now suspended.`
    });
    await loadAccount(detailState.account.id);
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        actions={<StatusChip status={roleCanMutate ? "warning" : "info"}>{role}</StatusChip>}
        description="Create, locate, review, and govern account records through the gateway boundary."
        eyebrow="Account Management"
        title="Account Ecosystem"
      />

      {notice ? <AccountNotice notice={notice} /> : null}

      <ContentGrid>
        {metrics.map((metric) => (
          <MetricCard
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
              <h3 className="text-title-lg font-black text-on-surface">Identity Onboarding</h3>
              <p className="mt-2 text-body-sm text-on-surface-variant">
                Create a gateway account record with a validated opening reserve.
              </p>
              <form className="mt-5 grid gap-4" noValidate onSubmit={(event) => void submitCreate(event)}>
                <Input
                  error={createErrors.name}
                  label="Full Legal Name"
                  name="name"
                  onChange={(event) => updateCreateField("name", event.currentTarget.value)}
                  placeholder="Evelyn Rothschild"
                  value={createFields.name}
                />
                <Input
                  error={createErrors.email}
                  label="Email Address"
                  name="email"
                  onChange={(event) => updateCreateField("email", event.currentTarget.value)}
                  placeholder="evelyn@example.com"
                  type="email"
                  value={createFields.email}
                />
                <Input
                  error={createErrors.initialBalance}
                  inputMode="decimal"
                  label="Initial Reserve USD"
                  name="initialBalance"
                  onChange={(event) => updateCreateField("initialBalance", event.currentTarget.value)}
                  placeholder="500.00"
                  value={createFields.initialBalance}
                />
                <Button className="w-full" loading={mutation === "create"} type="submit">
                  Generate Identity Record
                </Button>
              </form>
            </div>
          </section>

          <section className="grid gap-5 rounded-lg bg-surface-container-low p-4">
            <div className="rounded-lg bg-surface-container-lowest p-5">
              <h3 className="text-title-lg font-black text-on-surface">Account Lookup</h3>
              <p className="mt-2 text-body-sm text-on-surface-variant">
                Resolve account detail and balance by account UUID.
              </p>
              <form className="mt-5 grid gap-4" noValidate onSubmit={submitLookup}>
                <Input
                  error={lookupError}
                  label="Account UUID"
                  name="accountId"
                  onChange={(event) => setLookupId(event.currentTarget.value)}
                  placeholder="123e4567-e89b-12d3-a456-426614174000"
                  value={lookupId}
                />
                <Button className="w-full" loading={mutation === "lookup"} type="submit" variant="secondary">
                  Lookup Account
                </Button>
              </form>
            </div>
          </section>
        </div>

        <AccountDetailPanel
          canMutate={roleCanMutate}
          detailState={detailState}
          kycSelection={kycSelection}
          mutation={mutation}
          onFreeze={() => void submitFreeze()}
          onKycChange={setKycSelection}
          onKycSubmit={() => void submitKyc()}
        />
      </section>
    </div>
  );
};

interface AccountNoticeProps {
  notice: NonNullable<Notice>;
}

const AccountNotice = ({ notice }: AccountNoticeProps): ReactElement => (
  <aside className="rounded-lg bg-surface-container-low p-4" role={notice.status === "error" ? "alert" : "status"}>
    <div className="grid gap-2 rounded-lg bg-surface-container-lowest p-4">
      <StatusChip status={notice.status}>{notice.title}</StatusChip>
      <p className="text-body-sm text-on-surface-variant">{notice.message}</p>
    </div>
  </aside>
);

interface AccountDetailPanelProps {
  canMutate: boolean;
  detailState: DetailState;
  kycSelection: AccountKycStatus;
  mutation: "create" | "lookup" | "kyc" | "freeze" | null;
  onFreeze: () => void;
  onKycChange: (status: AccountKycStatus) => void;
  onKycSubmit: () => void;
}

const AccountDetailPanel = ({
  canMutate,
  detailState,
  kycSelection,
  mutation,
  onFreeze,
  onKycChange,
  onKycSubmit
}: AccountDetailPanelProps): ReactElement => {
  if (detailState.status === "loading") {
    return <Skeleton aria-label="account detail loading" className="min-h-[32rem]" />;
  }

  if (detailState.status === "error") {
    return (
      <EmptyState
        description={detailState.requestId ? `${detailState.message} Reference ${detailState.requestId}.` : detailState.message}
        title="Account detail unavailable"
        tone="error"
      />
    );
  }

  if (detailState.status === "idle") {
    return (
      <EmptyState
        description="Create an account or search by account UUID to load the detail, balance, KYC, and freeze controls."
        title="No account selected"
      />
    );
  }

  const { account, balance, balanceError } = detailState;

  return (
    <section className="grid content-start gap-6 rounded-lg bg-surface-container-low p-4">
      <article className="grid gap-6 rounded-lg bg-surface-container-lowest p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg bg-surface-container-high p-5">
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-headline-sm font-black text-on-surface">{account.name}</h3>
              <StatusChip status={statusForKyc(account.kycStatus)}>KYC {account.kycStatus}</StatusChip>
              <StatusChip status={statusForAccount(account.status)}>{account.status}</StatusChip>
            </div>
            <p className="font-mono text-label-sm text-on-surface-variant">UUID: {account.id}</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-label-sm font-black uppercase text-on-surface-variant">Current Balance</p>
            <p className="mt-1 text-3xl font-black text-on-surface">
              {formatMoney(balance?.balance ?? account.balance)}
            </p>
          </div>
        </div>

        {balanceError ? (
          <AccountNotice
            notice={{
              status: "warning",
              title: "Balance Unavailable",
              message: `The detail record loaded, but the balance endpoint returned ${balanceError}.`
            }}
          />
        ) : null}

        <dl className="grid gap-4 md:grid-cols-2">
          <AccountFact label="Account Holder" value={account.name} />
          <AccountFact label="Contact Identity" value={account.email} />
          <AccountFact label="Created" value={formatDate(account.createdAt)} />
          <AccountFact label="Updated" value={formatDate(account.updatedAt)} />
        </dl>

        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-transparent px-4 py-2 text-sm font-bold text-on-surface shadow-[inset_0_0_0_1px_rgb(169_180_185_/_0.2)] transition hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface"
            to={`/accounts/${account.id}`}
          >
            Open Detail Route
          </Link>
        </div>
      </article>

      <section className="grid gap-4 rounded-lg bg-surface-container-lowest p-5">
        <div>
          <h3 className="text-title-lg font-black text-on-surface">Operator Controls</h3>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            KYC and freeze actions refetch the account after the gateway mutation completes.
          </p>
        </div>
        {canMutate ? (
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <Select
              label="KYC Status"
              name="kycStatus"
              onChange={(event) => onKycChange(event.currentTarget.value as AccountKycStatus)}
              value={kycSelection}
            >
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </Select>
            <div className="flex items-end gap-3">
              <Button loading={mutation === "kyc"} onClick={onKycSubmit}>
                Update KYC
              </Button>
              <Button disabled={account.status === "suspended"} loading={mutation === "freeze"} onClick={onFreeze} variant="danger">
                Freeze
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState
            className="min-h-28"
            description="Customer sessions can review account detail but cannot update KYC or freeze accounts."
            title="Operator access required"
          />
        )}
      </section>
    </section>
  );
};

interface AccountFactProps {
  label: string;
  value: string;
}

const AccountFact = ({ label, value }: AccountFactProps): ReactElement => (
  <div className="grid gap-1 rounded-lg bg-surface-container-low p-4">
    <dt className="text-label-sm font-black uppercase text-on-surface-variant">{label}</dt>
    <dd className="break-words text-body-md font-bold text-on-surface">{value}</dd>
  </div>
);
