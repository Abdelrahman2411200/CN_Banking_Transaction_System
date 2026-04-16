import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { GatewayHealthState } from "../../lib/api/health";
import type { AuthSession } from "../auth/session";
import { PlatformHealthPage, type PlatformHealthClient } from "./PlatformHealthPage";

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
    fraud: "ok",
    ledger: "unreachable",
    notification: "ok",
    transfer: "degraded"
  },
  status: "degraded"
};

const makeClient = (health: GatewayHealthState = degradedHealth): PlatformHealthClient => ({
  getHealth: vi.fn<PlatformHealthClient["getHealth"]>().mockResolvedValue(health)
});

const renderPlatformHealth = (client: PlatformHealthClient): void => {
  render(
    <PlatformHealthPage
      getSession={() => sessionFor("admin")}
      platformHealthClient={client}
    />
  );
};

describe("PlatformHealthPage", () => {
  it("renders live gateway health and service readiness without fake platform data", async () => {
    const client = makeClient();
    renderPlatformHealth(client);

    expect(await screen.findByText("Gateway Health Summary")).toBeInTheDocument();
    expect(screen.getByText("Runtime Readiness")).toBeInTheDocument();
    expect(screen.getByText("api-gateway")).toBeInTheDocument();
    expect(screen.getByText("account-service")).toBeInTheDocument();
    expect(screen.getByText("transfer-service")).toBeInTheDocument();
    expect(screen.getByText("ledger-service")).toBeInTheDocument();
    expect(screen.getByText("fraud-service")).toBeInTheDocument();
    expect(screen.getByText("notification-service")).toBeInTheDocument();
    expect(screen.getByText("Gateway degraded")).toBeInTheDocument();
    expect(screen.getByText("Unsupported Platform Signals")).toBeInTheDocument();
    expect(screen.getByText("Kubernetes / EKS Rollout State")).toBeInTheDocument();
    expect(screen.getByText("CI/CD Pipeline State")).toBeInTheDocument();
    expect(screen.getByText("Image Vulnerability Scan State")).toBeInTheDocument();
    expect(screen.getByText("Infrastructure Status")).toBeInTheDocument();
    expect(screen.getAllByText("Not live").length).toBe(4);
    expect(screen.queryByText("EKS-US-EAST-1")).not.toBeInTheDocument();
    expect(screen.queryByText("99.998%")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pause pipeline/i })).not.toBeInTheDocument();
    expect(client.getHealth).toHaveBeenCalledTimes(1);
  });

  it("refreshes the readiness source manually", async () => {
    const user = userEvent.setup();
    const client: PlatformHealthClient = {
      getHealth: vi
        .fn<PlatformHealthClient["getHealth"]>()
        .mockResolvedValueOnce(degradedHealth)
        .mockResolvedValueOnce(healthyHealth)
    };
    renderPlatformHealth(client);

    expect(await screen.findByText("Gateway degraded")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Refresh Health/i }));

    expect(await screen.findByText("Gateway healthy")).toBeInTheDocument();
    expect(client.getHealth).toHaveBeenCalledTimes(2);
  });

  it("renders health load failures", async () => {
    const client: PlatformHealthClient = {
      getHealth: vi.fn<PlatformHealthClient["getHealth"]>().mockRejectedValue(new Error("gateway offline"))
    };
    renderPlatformHealth(client);

    expect(await screen.findByText("Platform readiness unavailable")).toBeInTheDocument();
    expect(screen.getByText("gateway offline")).toBeInTheDocument();
  });
});
