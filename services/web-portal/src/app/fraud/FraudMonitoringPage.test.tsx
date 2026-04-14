import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ApiResult } from "../../lib/api/client";
import type { FraudAlert, FraudStats } from "../../lib/api/fraud";
import type { AuthSession } from "../auth/session";
import { FraudMonitoringPage, type FraudClient } from "./FraudMonitoringPage";

const alertId = "523e4567-e89b-12d3-a456-426614174555";
const secondAlertId = "623e4567-e89b-12d3-a456-426614174556";
const accountId = "123e4567-e89b-12d3-a456-426614174000";
const transferId = "223e4567-e89b-12d3-a456-426614174111";
const secondTransferId = "323e4567-e89b-12d3-a456-426614174222";

const alert = (overrides: Partial<FraudAlert> = {}): FraudAlert => ({
  alertId,
  amount: "25000.00",
  createdAt: "2026-04-14T10:00:00.000Z",
  fromAccountId: accountId,
  ruleTriggered: "rapid_drain",
  severity: "critical",
  sourceEventId: "fraud-event-1",
  transferId,
  ...overrides
});

const stats: FraudStats = {
  thisWeek: [
    { count: 2, severity: "critical" },
    { count: 3, severity: "high" },
    { count: 1, severity: "medium" }
  ],
  today: [{ count: 1, severity: "critical" }]
};

const success = <T,>(data: T, status = 200): ApiResult<T> => ({ ok: true, status, data });
const failure = (error: string, status = 400, requestId?: string): ApiResult<never> => ({
  ok: false,
  status,
  error,
  requestId
});

const makeClient = (overrides: Partial<FraudClient> = {}): FraudClient => ({
  getAlert: vi.fn<FraudClient["getAlert"]>().mockResolvedValue(success(alert())),
  getAlerts: vi.fn<FraudClient["getAlerts"]>().mockResolvedValue(
    success([
      alert(),
      alert({
        alertId: secondAlertId,
        ruleTriggered: "velocity_check",
        severity: "high",
        transferId: secondTransferId
      })
    ])
  ),
  getStats: vi.fn<FraudClient["getStats"]>().mockResolvedValue(success(stats)),
  ...overrides
});

const sessionFor = (role: AuthSession["role"]): AuthSession => ({
  accessToken: `token-for-${role}`,
  role
});

const renderFraud = (
  client: FraudClient,
  initialPath = "/fraud",
  role: AuthSession["role"] = "admin"
): void => {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          element={<FraudMonitoringPage fraudClient={client} getSession={() => sessionFor(role)} />}
          path="/fraud"
        />
        <Route
          element={<FraudMonitoringPage fraudClient={client} getSession={() => sessionFor(role)} />}
          path="/fraud/alerts/:alertId"
        />
      </Routes>
    </MemoryRouter>
  );
};

describe("FraudMonitoringPage", () => {
  it("loads fraud KPI cards and the alert table", async () => {
    const client = makeClient();
    renderFraud(client);

    expect(await screen.findByText("Active Fraud Stream")).toBeInTheDocument();
    expect(screen.getByText("Loaded Alerts")).toBeInTheDocument();
    expect(screen.getByText("C 2 / H 3 / M 1 / L 0")).toBeInTheDocument();
    expect(screen.getByText("rapid_drain")).toBeInTheDocument();
    expect(screen.getByText("velocity_check")).toBeInTheDocument();
    expect(screen.getAllByText("critical").length).toBeGreaterThan(0);
  });

  it("sends supported server filters and applies transfer filter client-side", async () => {
    const user = userEvent.setup();
    const client = makeClient();
    renderFraud(client);

    await screen.findByText("Active Fraud Stream");
    await user.selectOptions(screen.getByLabelText(/Severity/i), "critical");
    await user.type(screen.getByLabelText(/Account UUID/i), accountId);
    await user.type(screen.getByLabelText(/Transfer UUID/i), transferId);
    await user.type(screen.getByLabelText(/From Date/i), "2026-04-14");
    await user.type(screen.getByLabelText(/To Date/i), "2026-04-15");
    await user.click(screen.getByRole("button", { name: /Apply Filters/i }));

    expect(client.getAlerts).toHaveBeenLastCalledWith(
      {
        accountId,
        from: "2026-04-14T00:00:00.000Z",
        limit: 20,
        page: 1,
        severity: "critical",
        to: "2026-04-15T23:59:59.999Z"
      },
      expect.objectContaining({ role: "admin" })
    );
    expect(screen.getByText("rapid_drain")).toBeInTheDocument();
    expect(screen.queryByText("velocity_check")).not.toBeInTheDocument();
  });

  it("validates optional filter UUIDs and date range", async () => {
    const user = userEvent.setup();
    const client = makeClient();
    renderFraud(client);

    await screen.findByText("Active Fraud Stream");
    await user.type(screen.getByLabelText(/Account UUID/i), "not-an-account");
    await user.type(screen.getByLabelText(/Transfer UUID/i), "not-a-transfer");
    await user.type(screen.getByLabelText(/From Date/i), "2026-04-15");
    await user.type(screen.getByLabelText(/To Date/i), "2026-04-14");
    await user.click(screen.getByRole("button", { name: /Apply Filters/i }));

    expect(await screen.findByText("Enter a valid account UUID.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid transfer UUID.")).toBeInTheDocument();
    expect(screen.getByText("Start date must be before end date.")).toBeInTheDocument();
    expect(client.getAlerts).toHaveBeenCalledTimes(1);
  });

  it("renders alert detail from the detail route", async () => {
    const client = makeClient();
    renderFraud(client, `/fraud/alerts/${alertId}`);

    expect(await screen.findByText(`Alert ${alertId}`)).toBeInTheDocument();
    expect(client.getAlert).toHaveBeenCalledWith(alertId, expect.objectContaining({ role: "admin" }));
    expect(screen.getAllByText("$25,000.00").length).toBeGreaterThan(0);
    expect(screen.getByText("fraud-event-1")).toBeInTheDocument();
  });

  it("handles admin-only fraud gateway errors explicitly", async () => {
    const client = makeClient({
      getAlerts: vi.fn<FraudClient["getAlerts"]>().mockResolvedValue(failure("forbidden", 403, "req-fraud")),
      getStats: vi.fn<FraudClient["getStats"]>().mockResolvedValue(failure("forbidden", 403, "req-stats"))
    });
    renderFraud(client, "/fraud", "operator");

    expect(await screen.findByText("Fraud alerts unavailable")).toBeInTheDocument();
    expect(screen.getByText("Fraud operations are restricted to admin sessions. Reference req-fraud.")).toBeInTheDocument();
  });

  it("shows empty alert table state", async () => {
    const client = makeClient({
      getAlerts: vi.fn<FraudClient["getAlerts"]>().mockResolvedValue(success([]))
    });
    renderFraud(client);

    expect(await screen.findByText("No fraud alerts matched the current filters")).toBeInTheDocument();
  });

  it("opens detail links from the alert table", async () => {
    const client = makeClient();
    renderFraud(client);

    const row = await screen.findByText("rapid_drain");
    const table = row.closest("table");
    expect(table).not.toBeNull();
    expect(within(table as HTMLTableElement).getAllByRole("link", { name: "Open" })[0]).toHaveAttribute(
      "href",
      `/fraud/alerts/${alertId}`
    );
  });
});
