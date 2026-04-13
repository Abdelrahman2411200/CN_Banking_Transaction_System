import { describe, expect, it, vi } from "vitest";
import { getGatewayHealth, mapGatewayHealth } from "./health";

describe("gateway health", () => {
  it("maps ok gateway responses to healthy state", () => {
    expect(mapGatewayHealth({ status: "ok", services: { account: "ok" } })).toEqual({
      status: "healthy",
      services: { account: "ok" },
      message: "Gateway healthy"
    });
  });

  it("maps degraded gateway responses to degraded state", () => {
    expect(mapGatewayHealth({ status: "degraded", services: { ledger: "unreachable" } })).toEqual({
      status: "degraded",
      services: { ledger: "unreachable" },
      message: "Gateway degraded"
    });
  });

  it("maps failed requests to unavailable state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(getGatewayHealth("http://localhost:8080")).resolves.toMatchObject({
      status: "unavailable",
      message: "offline"
    });

    vi.unstubAllGlobals();
  });
});
