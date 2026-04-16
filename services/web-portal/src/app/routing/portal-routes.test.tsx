import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { AuthSession } from "../auth/session";
import { PortalRoutes } from "./PortalRoutes";
import { adminOperatorRoutes, customerOperatorRoutes, publicRoutes } from "./routeConfig";
import type { DashboardClient } from "../dashboard/DashboardPage";
import type { FraudClient } from "../fraud/FraudMonitoringPage";
import type { LedgerClient } from "../ledger/FinancialLedgerPage";
import type { NotificationClient } from "../notifications/NotificationCenterPage";
import type { ObservabilityClient } from "../observability/ObservabilityDashboardPage";
import type { PlatformHealthClient } from "../platform/PlatformHealthPage";
import type { TransferClient } from "../transfers/TransferOperationsPage";

const sessionFor = (role: AuthSession["role"]): AuthSession => ({
  accessToken: `token-for-${role}`,
  role
});

const dashboardClient: DashboardClient = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  data: {
    accounts: { items: [], source: "gateway" },
    transfers: { items: [], source: "gateway" },
    health: { message: "Gateway healthy", services: {}, status: "healthy" }
  }
});

const transferClient: TransferClient = {
  create: vi.fn(),
  get: vi.fn().mockResolvedValue({
    ok: false,
    status: 400,
    error: "validation_failed"
  })
};

const ledgerClient: LedgerClient = {
  getAccountEntries: vi.fn(),
  getStats: vi.fn(),
  getTransferEntries: vi.fn().mockResolvedValue({
    ok: false,
    status: 400,
    error: "validation_failed"
  })
};

const fraudClient: FraudClient = {
  getAlert: vi.fn(),
  getAlerts: vi.fn().mockResolvedValue({
    ok: false,
    status: 403,
    error: "forbidden"
  }),
  getStats: vi.fn().mockResolvedValue({
    ok: false,
    status: 403,
    error: "forbidden"
  })
};

const notificationClient: NotificationClient = {
  getNotifications: vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    data: {
      channels: ["email"],
      mode: "event-consumer",
      persistence: "none",
      records: [],
      subscribedTopics: ["bank.transfer.completed"]
    }
  })
};

const observabilityClient: ObservabilityClient = {
  getHealth: vi.fn().mockResolvedValue({
    message: "Gateway healthy",
    services: {
      account: "ok",
      fraud: "ok",
      ledger: "ok",
      notification: "ok",
      transfer: "ok"
    },
    status: "healthy"
  })
};

const platformHealthClient: PlatformHealthClient = {
  getHealth: vi.fn().mockResolvedValue({
    message: "Gateway healthy",
    services: {
      account: "ok",
      fraud: "ok",
      ledger: "ok",
      notification: "ok",
      transfer: "ok"
    },
    status: "healthy"
  })
};

const renderRoute = (path: string, session: AuthSession | null = sessionFor("operator")) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <PortalRoutes
        dashboardClient={dashboardClient}
        fraudClient={fraudClient}
        getSession={() => session}
        ledgerClient={ledgerClient}
        notificationClient={notificationClient}
        observabilityClient={observabilityClient}
        platformHealthClient={platformHealthClient}
        refreshSession={() => Promise.resolve({ ok: false, status: 401, error: "refresh_token_required" })}
        transferClient={transferClient}
      />
    </MemoryRouter>
  );

describe("PortalRoutes", () => {
  it("defines the Phase 2 public and protected route groups", () => {
    expect(publicRoutes.map((route) => route.path)).toEqual(["/login", "/register"]);
    expect(customerOperatorRoutes.map((route) => route.path)).toEqual(
      expect.arrayContaining([
        "/dashboard",
        "/accounts",
        "/accounts/:id",
        "/transfers",
        "/transfers/:id",
        "/ledger",
        "/ledger/transfers/:transferId"
      ])
    );
    expect(adminOperatorRoutes.map((route) => route.path)).toEqual(
      expect.arrayContaining(["/fraud", "/fraud/alerts/:alertId", "/notifications", "/observability", "/platform-health"])
    );
  });

  it("redirects protected routes to login when no session is present", async () => {
    renderRoute("/dashboard", null);

    expect(await screen.findByRole("heading", { name: "Architectural Access" })).toBeInTheDocument();
  });

  it("restores protected routes by refreshing the session before redirecting", async () => {
    const refreshSession = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: sessionFor("operator")
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <PortalRoutes dashboardClient={dashboardClient} getSession={() => null} refreshSession={refreshSession} />
      </MemoryRouter>
    );

    expect(screen.getByRole("status")).toHaveTextContent("Restoring secure session");
    expect(await screen.findByRole("heading", { name: "Banking Ops" })).toBeInTheDocument();
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it("redirects to login when session refresh fails", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <PortalRoutes
          getSession={() => null}
          refreshSession={() => Promise.resolve({ ok: false, status: 401, error: "invalid_refresh_token" })}
        />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Architectural Access" })).toBeInTheDocument();
  });

  it("keeps the design-system gallery available as the manual parity gate", () => {
    renderRoute("/design-system", null);

    expect(screen.getByRole("heading", { name: "Design System Gallery" })).toBeInTheDocument();
  });

  it("renders the app shell and active route for authenticated users", async () => {
    renderRoute("/ledger/transfers/223e4567-e89b-12d3-a456-426614174111", sessionFor("operator"));

    expect(screen.getByRole("heading", { name: "Banking Ops" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Transfer Ledger" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /ledger/i })[0]).toHaveAttribute("aria-current", "page");
    expect(await screen.findByText("Ledger lookup failed")).toBeInTheDocument();
  });

  it("hides and blocks admin routes for customer sessions", () => {
    renderRoute("/fraud", sessionFor("customer"));

    expect(screen.getByText("Route access restricted")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /fraud/i })).not.toBeInTheDocument();
  });

  it("keeps fraud routes admin-only for operator sessions", () => {
    renderRoute("/fraud", sessionFor("operator"));

    expect(screen.getByText("Route access restricted")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /fraud/i })).not.toBeInTheDocument();
  });

  it("keeps notifications admin-only and renders the admin timeline route", async () => {
    const { unmount } = renderRoute("/notifications", sessionFor("operator"));

    expect(screen.getByText("Route access restricted")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /notifications/i })).not.toBeInTheDocument();
    unmount();

    renderRoute("/notifications", sessionFor("admin"));

    expect(await screen.findByRole("heading", { name: "Notification Hub" })).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: /notifications/i })
        .some((link) => link.getAttribute("aria-current") === "page")
    ).toBe(true);
  });

  it("renders observability for operators without admin-only detail", async () => {
    renderRoute("/observability", sessionFor("operator"));

    expect(await screen.findByRole("heading", { name: "Operational Health" })).toBeInTheDocument();
    expect(screen.getByText("Admin operational detail hidden")).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: /observability/i })
        .some((link) => link.getAttribute("aria-current") === "page")
    ).toBe(true);
  });

  it("keeps platform health admin-only and renders the admin readiness route", async () => {
    const { unmount } = renderRoute("/platform-health", sessionFor("operator"));

    expect(screen.getByText("Route access restricted")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /platform health/i })).not.toBeInTheDocument();
    unmount();

    renderRoute("/platform-health", sessionFor("admin"));

    expect(await screen.findByRole("heading", { name: "Runtime Readiness" })).toBeInTheDocument();
    expect(screen.getByText("Unsupported Platform Signals")).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: /platform health/i })
        .some((link) => link.getAttribute("aria-current") === "page")
    ).toBe(true);
  });

  it("renders not found routes", () => {
    renderRoute("/missing-route", sessionFor("admin"));

    expect(screen.getByText("Route not found")).toBeInTheDocument();
  });

  it("logs out from the app shell", async () => {
    const user = userEvent.setup();
    const logoutSession = vi.fn().mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <PortalRoutes getSession={() => sessionFor("admin")} logoutSession={logoutSession} />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    expect(logoutSession).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Signed out. Re-authenticate to access the ledger.")).toBeInTheDocument();
  });
});
