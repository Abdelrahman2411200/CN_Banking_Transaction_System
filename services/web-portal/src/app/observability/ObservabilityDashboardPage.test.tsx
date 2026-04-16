import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { GatewayHealthState } from "../../lib/api/health";
import type { AuthSession } from "../auth/session";
import { ObservabilityDashboardPage, type ObservabilityClient } from "./ObservabilityDashboardPage";

const sessionFor = (role: AuthSession["role"]): AuthSession => ({
  accessToken: `token-for-${role}`,
  role
});

const healthyHealth: GatewayHealthState = {
  message: "Gateway healthy",
  services: {
    account: "ok",
    fraud: "ok",
    ledger: "ok",
    notification: "ok",
    transfer: "ok"
  },
  status: "healthy"
};

const degradedHealth: GatewayHealthState = {
  message: "Gateway degraded",
  services: {
    account: "ok",
    fraud: "degraded",
    ledger: "unreachable",
    notification: "ok",
    transfer: "ok"
  },
  status: "degraded"
};

const makeClient = (health: GatewayHealthState = degradedHealth): ObservabilityClient => ({
  getHealth: vi.fn<ObservabilityClient["getHealth"]>().mockResolvedValue(health)
});

const renderObservability = (
  client: ObservabilityClient,
  role: AuthSession["role"] = "admin"
): void => {
  render(
    <ObservabilityDashboardPage
      getSession={() => sessionFor(role)}
      observabilityClient={client}
    />
  );
};

describe("ObservabilityDashboardPage", () => {
  it("renders the live gateway health summary and service map", async () => {
    const client = makeClient();
    renderObservability(client);

    expect(await screen.findByText("Service Map Integrity")).toBeInTheDocument();
    expect(screen.getByText("api-gateway")).toBeInTheDocument();
    expect(screen.getByText("account-service")).toBeInTheDocument();
    expect(screen.getByText("transfer-service")).toBeInTheDocument();
    expect(screen.getByText("ledger-service")).toBeInTheDocument();
    expect(screen.getByText("fraud-service")).toBeInTheDocument();
    expect(screen.getByText("notification-service")).toBeInTheDocument();
    expect(screen.getByText("Gateway degraded")).toBeInTheDocument();
    expect(screen.getByText("Raw `/metrics` stays out of the browser")).toBeInTheDocument();
    expect(screen.getByText(/defaults to summarized/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /query logs/i })).not.toBeInTheDocument();
    expect(client.getHealth).toHaveBeenCalledTimes(1);
  });

  it("refreshes health manually", async () => {
    const user = userEvent.setup();
    const client: ObservabilityClient = {
      getHealth: vi
        .fn<ObservabilityClient["getHealth"]>()
        .mockResolvedValueOnce(degradedHealth)
        .mockResolvedValueOnce(healthyHealth)
    };
    renderObservability(client);

    expect(await screen.findByText("Gateway degraded")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Refresh Health/i }));

    expect(await screen.findByText("Gateway healthy")).toBeInTheDocument();
    expect(client.getHealth).toHaveBeenCalledTimes(2);
  });

  it("hides sensitive operational detail for non-admin sessions", async () => {
    renderObservability(makeClient(healthyHealth), "operator");

    expect(await screen.findByText("Admin operational detail hidden")).toBeInTheDocument();
    expect(screen.getByText(/Sensitive telemetry, log search, and raw metrics are hidden/i)).toBeInTheDocument();
    expect(screen.queryByText("Operational Detail Policy")).not.toBeInTheDocument();
  });

  it("renders health load failures", async () => {
    const client: ObservabilityClient = {
      getHealth: vi.fn<ObservabilityClient["getHealth"]>().mockRejectedValue(new Error("gateway offline"))
    };
    renderObservability(client);

    expect(await screen.findByText("Health overview unavailable")).toBeInTheDocument();
    expect(screen.getByText("gateway offline")).toBeInTheDocument();
  });
});
