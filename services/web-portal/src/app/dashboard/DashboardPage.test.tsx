import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { DashboardOverview } from "../../lib/api/dashboard";
import type { DashboardClient } from "./DashboardPage";
import { DashboardPage } from "./DashboardPage";

const overview: DashboardOverview = {
  accounts: {
    items: [
      {
        id: "acct-1",
        name: "Primary Checking",
        email: "customer@example.com",
        balance: "1000.00",
        kycStatus: "verified",
        status: "active",
        createdAt: "2026-04-13T10:00:00.000Z",
        updatedAt: "2026-04-13T10:00:00.000Z"
      },
      {
        id: "acct-2",
        name: "Exception Review",
        email: "risk@example.com",
        balance: "0.00",
        kycStatus: "pending",
        status: "suspended",
        createdAt: "2026-04-13T10:00:00.000Z",
        updatedAt: "2026-04-13T11:00:00.000Z"
      }
    ],
    notice: "Documented mock fallback active because this gateway list endpoint is not available yet.",
    source: "mock-fallback"
  },
  transfers: {
    items: [
      {
        id: "transfer-1",
        fromAccountId: "acct-1",
        toAccountId: "acct-2",
        amount: "250.00",
        status: "failed",
        createdAt: "2026-04-13T12:00:00.000Z",
        updatedAt: "2026-04-13T12:01:00.000Z"
      }
    ],
    notice: "Documented mock fallback active because this gateway list endpoint is not available yet.",
    source: "mock-fallback"
  },
  health: {
    message: "Gateway degraded",
    services: { account: "ok", transfer: "unreachable" },
    status: "degraded"
  },
  ledgerStatsNotice: "Ledger stats are available through the admin gateway boundary."
};

const renderDashboard = (client: DashboardClient, role: "customer" | "operator" | "admin" = "customer"): void => {
  render(
    <MemoryRouter>
      <DashboardPage
        dashboardClient={client}
        getSession={() => ({ accessToken: `token-for-${role}`, role })}
      />
    </MemoryRouter>
  );
};

describe("DashboardPage", () => {
  it("renders loading, fallback, degraded-health, and role-aware customer content", async () => {
    const client = vi.fn<DashboardClient>().mockResolvedValue({ ok: true, status: 200, data: overview });

    renderDashboard(client, "customer");

    expect(screen.getByLabelText("dashboard liquidity loading")).toBeInTheDocument();
    expect(await screen.findByText("Dashboard list endpoints pending")).toBeInTheDocument();
    expect(screen.getAllByText("Gateway degraded").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Send Transfer/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Review Fraud/i })).not.toBeInTheDocument();
    expect(screen.getByText("transfer-1")).toBeInTheDocument();
    expect(screen.getByText("Ledger stats are available through the admin gateway boundary.")).toBeInTheDocument();
  });

  it("renders operator quick actions and operational metrics", async () => {
    const client = vi.fn<DashboardClient>().mockResolvedValue({ ok: true, status: 200, data: overview });

    renderDashboard(client, "operator");

    expect(await screen.findByRole("link", { name: /Review Fraud/i })).toBeInTheDocument();
    expect(screen.getByText("Operational Alerts")).toBeInTheDocument();
  });

  it("renders empty account and transfer states", async () => {
    const client = vi.fn<DashboardClient>().mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        ...overview,
        accounts: { items: [], source: "gateway" },
        transfers: { items: [], source: "gateway" },
        health: { message: "Gateway healthy", services: {}, status: "healthy" }
      }
    });

    renderDashboard(client);

    expect(await screen.findByText("No recent transfer activity")).toBeInTheDocument();
    expect(screen.getByText("No accounts returned")).toBeInTheDocument();
    expect(screen.getByText("No service details reported")).toBeInTheDocument();
  });

  it("renders gateway errors", async () => {
    const client = vi.fn<DashboardClient>().mockResolvedValue({
      ok: false,
      status: 500,
      error: "internal_error",
      requestId: "req-dashboard"
    });

    renderDashboard(client);

    expect(await screen.findByText("Dashboard data unavailable")).toBeInTheDocument();
    expect(screen.getByText("internal_error. Request req-dashboard.")).toBeInTheDocument();
  });
});
