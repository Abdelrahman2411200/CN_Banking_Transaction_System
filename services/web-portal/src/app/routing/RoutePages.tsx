import type { ReactElement, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ContentGrid, PageHeader } from "../../components/layout";
import { EmptyState, MetricCard, StatusChip } from "../../components/primitives";
import { cn } from "../../lib/cn";
import type { PortalRoute } from "./routeConfig";

export interface RoutePageProps {
  route: PortalRoute;
}

export const RoutePage = ({ route }: RoutePageProps): ReactElement => (
  <div className="grid gap-6">
    <PageHeader
      actions={<StatusChip status={route.group === "admin" ? "warning" : "info"}>{route.group}</StatusChip>}
      description={route.description}
      eyebrow={route.phase}
      title={route.label}
    />
    <ContentGrid>
      <MetricCard label="Route" status="info" value={route.path} />
      <MetricCard label="Access" status={route.group === "admin" ? "warning" : "success"} value={route.accessLabel} />
      <MetricCard label="Source" status="neutral" value={route.sourceFamily} />
      <MetricCard label="Gateway" status="info" value="API boundary" />
    </ContentGrid>
    <section className="grid gap-3 rounded-lg bg-surface-container-low p-4">
      <div className="rounded-lg bg-surface-container-lowest p-5">
        <StatusChip status="info">Phase 2</StatusChip>
        <h3 className="mt-3 text-title-lg text-on-surface">{route.label}</h3>
        <p className="mt-2 max-w-3xl text-body-md text-on-surface-variant">{route.implementationNote}</p>
      </div>
    </section>
  </div>
);

export const LoginPage = (): ReactElement => (
  <main className="grid min-h-screen place-items-center bg-surface p-6 text-on-surface">
    <section className="grid w-full max-w-md gap-5 rounded-lg bg-surface-container-low p-5">
      <div className="rounded-lg bg-surface-container-lowest p-5">
        <StatusChip status="info">public</StatusChip>
        <h1 className="mt-3 text-headline-sm text-on-surface">Operator access</h1>
        <p className="mt-2 text-body-md text-on-surface-variant">
          Authentication flow is reserved for Phase 4. The route is ready for the gateway-backed form.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <ActionLink to="/register" variant="secondary">Register</ActionLink>
          <ActionLink to="/dashboard">Continue</ActionLink>
        </div>
      </div>
    </section>
  </main>
);

export const RegisterPage = (): ReactElement => (
  <main className="grid min-h-screen place-items-center bg-surface p-6 text-on-surface">
    <section className="grid w-full max-w-md gap-5 rounded-lg bg-surface-container-low p-5">
      <div className="rounded-lg bg-surface-container-lowest p-5">
        <StatusChip status="info">public</StatusChip>
        <h1 className="mt-3 text-headline-sm text-on-surface">Create portal access</h1>
        <p className="mt-2 text-body-md text-on-surface-variant">
          Registration wiring lands with the auth session phase and uses the gateway auth boundary.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <ActionLink to="/login" variant="secondary">Sign in</ActionLink>
        </div>
      </div>
    </section>
  </main>
);

export interface ForbiddenPageProps {
  attemptedPath?: string;
}

export const ForbiddenPage = ({ attemptedPath }: ForbiddenPageProps): ReactElement => (
  <EmptyState
    description={attemptedPath ? `${attemptedPath} requires an operator or admin session.` : undefined}
    title="Route access restricted"
    tone="error"
  />
);

export const NotFoundPage = (): ReactElement => (
  <main className="grid min-h-screen place-items-center bg-surface p-6 text-on-surface">
    <div className="w-full max-w-xl">
      <EmptyState description="Check the route and return to the portal entry point." title="Route not found" />
      <div className="mt-4 flex justify-start">
        <ActionLink to="/dashboard">Return to dashboard</ActionLink>
      </div>
    </div>
  </main>
);

interface ActionLinkProps {
  children: ReactNode;
  to: string;
  variant?: "primary" | "secondary";
}

const actionLinkVariants = {
  primary: "bg-primary text-on-primary hover:brightness-105",
  secondary:
    "bg-transparent text-on-surface shadow-[inset_0_0_0_1px_rgb(169_180_185_/_0.2)] hover:bg-surface-container-low"
} as const;

const ActionLink = ({ children, to, variant = "primary" }: ActionLinkProps): ReactElement => (
  <Link
    className={cn(
      "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface",
      actionLinkVariants[variant]
    )}
    to={to}
  >
    {children}
  </Link>
);
