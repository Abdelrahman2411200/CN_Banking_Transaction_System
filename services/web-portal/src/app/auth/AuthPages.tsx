import type { FormEvent, ReactElement } from "react";
import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, FieldLabel, StatusChip } from "../../components/primitives";
import { applyTheme, type ThemeMode } from "../../design-system";
import type { ApiResult } from "../../lib/api/client";
import {
  loginUser,
  registerUser,
  type LoginRequest,
  type RegisterRequest,
  type RegisterResponse
} from "../../lib/api/auth";
import { cn } from "../../lib/cn";
import type { AuthSession, UserRole } from "./session";

export interface AuthClient {
  login: (input: LoginRequest) => Promise<ApiResult<AuthSession>>;
  register: (input: RegisterRequest) => Promise<ApiResult<RegisterResponse>>;
}

export interface AuthPageProps {
  authClient?: AuthClient;
}

interface LocationState {
  authNotice?: string;
  from?: string;
}

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
}

type AuthMode = "login" | "register";

const defaultAuthClient: AuthClient = {
  login: loginUser,
  register: registerUser
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const adminPaths = ["/fraud", "/notifications", "/observability", "/platform-health"];

export const getPostLoginPath = (role: UserRole, from?: string): string => {
  const requestedPath = from && from !== "/login" && from !== "/register" ? from : undefined;
  const requestedAdminOnly = requestedPath ? adminPaths.some((path) => requestedPath.startsWith(path)) : false;

  if (requestedPath && (!requestedAdminOnly || role === "admin" || role === "operator")) {
    return requestedPath;
  }

  if (role === "admin") {
    return "/fraud";
  }

  return "/dashboard";
};

const messageForFailure = (failure: ApiResult<unknown>): { title: string; message: string; status: "error" | "warning" } => {
  if (failure.ok) {
    return { title: "Request complete", message: "Access request completed.", status: "warning" };
  }

  if (failure.status === 429 || failure.error === "rate_limit_exceeded") {
    const wait = failure.retryAfter ? ` Please wait ${failure.retryAfter} seconds before retrying.` : "";
    return {
      title: "Security Threshold Reached",
      message: `Too many attempts were detected.${wait}`,
      status: "warning"
    };
  }

  if (failure.error === "invalid_credentials") {
    return {
      title: "Access Denied",
      message: "Credentials do not match an active ledger identity.",
      status: "error"
    };
  }

  if (failure.error === "email_already_registered") {
    return {
      title: "Identity Already Registered",
      message: "This email address is already registered in the production environment.",
      status: "error"
    };
  }

  if (failure.status === 0 || failure.status === 503 || failure.error === "service_degraded") {
    return {
      title: "Gateway Unavailable",
      message: "Authentication services are unavailable. Try again after the gateway recovers.",
      status: "error"
    };
  }

  return {
    title: "Authentication Request Failed",
    message: failure.requestId
      ? `The gateway rejected the request. Reference ${failure.requestId}.`
      : "The gateway rejected the request.",
    status: "error"
  };
};

export const LoginPage = ({ authClient = defaultAuthClient }: AuthPageProps): ReactElement => (
  <AuthPage authClient={authClient} mode="login" />
);

export const RegisterPage = ({ authClient = defaultAuthClient }: AuthPageProps): ReactElement => (
  <AuthPage authClient={authClient} mode="register" />
);

const AuthPage = ({ authClient, mode }: AuthPageProps & { mode: AuthMode }): ReactElement => {
  const client = authClient ?? defaultAuthClient;
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState | null;
  const [theme, setTheme] = useState<ThemeMode>(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light"
  );
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Extract<UserRole, "customer" | "admin">>("customer");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [statusMessage, setStatusMessage] = useState<ReturnType<typeof messageForFailure> | null>(null);

  const formId = `auth-${mode}`;
  const isRegister = mode === "register";
  const nextTheme = theme === "light" ? "dark" : "light";

  const helperText = useMemo(
    () =>
      isRegister
        ? "Create a gateway-backed access profile for controlled portal entry."
        : "Authenticate with your institutional identity to access the ledger.",
    [isRegister]
  );

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};

    if (isRegister && fullName.trim().length < 2) {
      errors.fullName = "Enter the registered legal name for this access profile.";
    }

    if (!emailPattern.test(email.trim())) {
      errors.email = "Enter a valid institutional email address.";
    }

    if (password.length < 8) {
      errors.password = "Access keys must be at least 8 characters.";
    }

    return errors;
  };

  const toggleTheme = (): void => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const submitAuth = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const nextErrors = validate();
    setFieldErrors(nextErrors);
    setStatusMessage(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      if (isRegister) {
        const result = await client.register({ email: email.trim(), password, role });

        if (!result.ok) {
          setStatusMessage(messageForFailure(result));
          return;
        }

        void navigate("/login", {
          replace: true,
          state: { authNotice: "Access profile created. Sign in to continue." } satisfies LocationState
        });
        return;
      }

      const result = await client.login({ email: email.trim(), password });

      if (!result.ok) {
        setStatusMessage(messageForFailure(result));
        return;
      }

      void navigate(getPostLoginPath(result.data.role, locationState?.from), { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  const notice = locationState?.authNotice;

  return (
    <main className="grid min-h-screen bg-surface px-4 py-6 text-on-surface sm:px-6">
      <section className="mx-auto grid w-full max-w-[460px] content-center gap-6">
        <header className="grid gap-3 text-left">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-on-primary">
            <span aria-hidden="true" className="material-symbols-outlined text-3xl">
              account_balance
            </span>
          </div>
          <div className="grid gap-2">
            <StatusChip status="info">Sovereign Ledger</StatusChip>
            <h1 className="text-headline-sm uppercase text-on-surface">Architectural Access</h1>
            <p className="text-body-md text-on-surface-variant">{helperText}</p>
          </div>
        </header>

        <div className="grid gap-3" aria-live="polite">
          {notice ? <AuthNotice title="Access Profile Ready" message={notice} status="success" /> : null}
          {statusMessage ? <AuthNotice {...statusMessage} /> : null}
        </div>

        <section className="grid gap-6 rounded-lg bg-surface-container-low p-4">
          <div className="rounded-lg bg-surface-container-lowest p-5 sm:p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <nav aria-label="Authentication mode" className="flex gap-2">
                <AuthTab active={mode === "login"} to="/login">Login</AuthTab>
                <AuthTab active={mode === "register"} to="/register">Register</AuthTab>
              </nav>
              <Button onClick={toggleTheme} type="button" variant="tertiary">
                Use {nextTheme}
              </Button>
            </div>

            <form className="grid gap-5" id={formId} noValidate onSubmit={submitAuth}>
              {isRegister ? (
                <AuthInput
                  autoComplete="name"
                  error={fieldErrors.fullName}
                  label="Full Legal Name"
                  name="name"
                  onChange={setFullName}
                  placeholder="Enter your full name"
                  value={fullName}
                />
              ) : null}
              <AuthInput
                autoComplete="email"
                error={fieldErrors.email}
                label="Institutional Email"
                name="email"
                onChange={setEmail}
                placeholder="name@sovereign-ledger.io"
                type="email"
                value={email}
              />
              <AuthInput
                autoComplete={isRegister ? "new-password" : "current-password"}
                error={fieldErrors.password}
                label="Encrypted Access Key"
                name="password"
                onChange={setPassword}
                placeholder="Enter your access key"
                rightAction={
                  <button
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 rounded-md text-on-surface-variant transition -translate-y-1/2 hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    onClick={() => setShowPassword((current) => !current)}
                    type="button"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-xl">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                }
                type={showPassword ? "text" : "password"}
                value={password}
              />

              {isRegister ? <RoleSelection role={role} setRole={setRole} /> : null}

              <Button className="min-h-12 w-full" loading={submitting} type="submit">
                {submitting ? "Authorizing" : isRegister ? "Create Access" : "Initialize Access"}
              </Button>
            </form>
          </div>
        </section>

        <footer className="flex flex-wrap gap-4 text-label-sm uppercase text-on-surface-variant">
          <span>Compliance</span>
          <span>Privacy Ops</span>
          <span>SLA Support</span>
        </footer>
      </section>
    </main>
  );
};

interface AuthNoticeProps {
  title: string;
  message: string;
  status: "error" | "warning" | "success";
}

const AuthNotice = ({ message, status, title }: AuthNoticeProps): ReactElement => (
  <aside className="rounded-lg bg-surface-container-low p-4" role={status === "error" ? "alert" : "status"}>
    <div className="grid gap-2 rounded-lg bg-surface-container-lowest p-4">
      <StatusChip status={status}>{title}</StatusChip>
      <p className="text-body-sm text-on-surface-variant">{message}</p>
    </div>
  </aside>
);

interface AuthTabProps {
  active: boolean;
  children: string;
  to: string;
}

const AuthTab = ({ active, children, to }: AuthTabProps): ReactElement => (
  <Link
    aria-current={active ? "page" : undefined}
    className={cn(
      "rounded-lg px-3 py-2 text-sm font-black text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface",
      active && "bg-primary-container text-on-primary-container"
    )}
    to={to}
  >
    {children}
  </Link>
);

interface AuthInputProps {
  autoComplete?: string;
  error?: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  placeholder: string;
  rightAction?: ReactElement;
  type?: "email" | "password" | "text";
  value: string;
}

const AuthInput = ({
  autoComplete,
  error,
  label,
  name,
  onChange,
  placeholder,
  rightAction,
  type = "text",
  value
}: AuthInputProps): ReactElement => {
  const inputId = `auth-${name}`;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="grid gap-2">
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <div className="relative">
        <input
          aria-describedby={errorId}
          aria-invalid={Boolean(error)}
          autoComplete={autoComplete}
          className={cn(
            "min-h-12 w-full rounded-lg bg-surface-container-low px-4 py-3 text-sm text-on-surface shadow-[inset_0_0_0_1px_rgb(169_180_185_/_0.2)] transition placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary",
            rightAction && "pr-12",
            error && "focus:ring-error"
          )}
          id={inputId}
          name={name}
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder={placeholder}
          type={type}
          value={value}
        />
        {rightAction}
      </div>
      {error ? (
        <p className="text-xs font-semibold text-error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
};

interface RoleSelectionProps {
  role: Extract<UserRole, "customer" | "admin">;
  setRole: (role: Extract<UserRole, "customer" | "admin">) => void;
}

const RoleSelection = ({ role, setRole }: RoleSelectionProps): ReactElement => (
  <fieldset className="grid gap-3">
    <legend className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Operational Role</legend>
    <div className="grid grid-cols-2 gap-3">
      {(["customer", "admin"] as const).map((value) => (
        <label className="cursor-pointer" key={value}>
          <input
            checked={role === value}
            className="sr-only peer"
            name="role"
            onChange={() => setRole(value)}
            type="radio"
            value={value}
          />
          <span className="grid min-h-24 place-items-center gap-2 rounded-lg bg-surface-container-low p-3 text-center shadow-[inset_0_0_0_1px_rgb(169_180_185_/_0.15)] transition peer-checked:bg-primary-container peer-checked:text-on-primary-container peer-focus-visible:ring-2 peer-focus-visible:ring-primary">
            <span aria-hidden="true" className="material-symbols-outlined">
              {value === "admin" ? "shield_person" : "person"}
            </span>
            <span className="text-label-md uppercase">{value}</span>
          </span>
        </label>
      ))}
    </div>
  </fieldset>
);
