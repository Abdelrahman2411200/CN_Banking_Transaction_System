import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GatewayHealthCard } from "./gallery/GatewayHealthCard";

describe("GatewayHealthCard", () => {
  it("renders provided health state", () => {
    render(
      <GatewayHealthCard
        initialState={{ message: "Gateway healthy", services: { account: "ok" }, status: "healthy" }}
      />
    );

    expect(screen.getByText("healthy")).toBeInTheDocument();
    expect(screen.getByText("account")).toBeInTheDocument();
  });

  it("loads health state asynchronously", async () => {
    render(
      <GatewayHealthCard
        loadHealth={() =>
          Promise.resolve({ message: "Gateway degraded", services: { ledger: "unreachable" }, status: "degraded" })
        }
      />
    );

    await waitFor(() => expect(screen.getByText("degraded")).toBeInTheDocument());
    expect(screen.getByText("ledger")).toBeInTheDocument();
  });
});
