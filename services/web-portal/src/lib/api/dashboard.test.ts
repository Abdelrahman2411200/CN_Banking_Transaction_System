import { afterEach, describe, expect, it, vi } from "vitest";
import { getDashboardOverview } from "./dashboard";

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...init.headers },
    ...init
  });

const requestUrl = (url: string | URL | Request): string =>
  typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

describe("dashboard api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses documented fallback data when list endpoints are not available", async () => {
    const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const target = requestUrl(url);

      if (target.endsWith("/health")) {
        return Promise.resolve(
          jsonResponse(
            { status: "degraded", services: { account: "ok", transfer: "unreachable" } },
            { status: 207 }
          )
        );
      }

      expect((init?.headers as Headers).get("Authorization")).toBe("Bearer access-token");
      return Promise.resolve(jsonResponse({ error: "not_found" }, { status: 404 }));
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await getDashboardOverview("customer", {
      baseUrl: "http://gateway.test",
      session: { accessToken: "access-token", role: "customer" }
    });

    expect(result).toMatchObject({
      ok: true,
      data: {
        accounts: { source: "mock-fallback" },
        transfers: { source: "mock-fallback" },
        health: { status: "degraded" },
        ledgerStatsNotice: "Ledger stats are available through the admin gateway boundary."
      }
    });

    if (result.ok) {
      expect(result.data.accounts.items.length).toBeGreaterThan(0);
      expect(result.data.transfers.items.length).toBeGreaterThan(0);
    }
  });

  it("normalizes gateway list data and admin ledger stats", async () => {
    const fetchMock = vi.fn((url: string | URL | Request) => {
      const target = requestUrl(url);

      if (target.endsWith("/health")) {
        return Promise.resolve(jsonResponse({ status: "ok", services: { account: "ok", ledger: "ok" } }));
      }

      if (target.endsWith("/v1/accounts")) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            data: [
              {
                id: "acct-1",
                name: "Treasury",
                email: "treasury@example.com",
                balance: "100.25",
                kyc_status: "verified",
                status: "active",
                created_at: "2026-04-13T00:00:00.000Z",
                updated_at: "2026-04-13T01:00:00.000Z"
              }
            ]
          })
        );
      }

      if (target.endsWith("/v1/transfers")) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            data: [
              {
                id: "transfer-1",
                from_account_id: "acct-1",
                to_account_id: "acct-2",
                amount: "42.00",
                status: "completed",
                created_at: "2026-04-13T02:00:00.000Z",
                updated_at: "2026-04-13T02:01:00.000Z"
              }
            ]
          })
        );
      }

      if (target.endsWith("/v1/ledger/stats/acct-1")) {
        return Promise.resolve(
          jsonResponse({ success: true, data: { totalDebits: 20, totalCredits: 45, net: 25, entryCount: 2 } })
        );
      }

      return Promise.resolve(jsonResponse({ error: "not_found" }, { status: 404 }));
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await getDashboardOverview("admin", {
      baseUrl: "http://gateway.test",
      session: { accessToken: "access-token", role: "admin" }
    });

    expect(result).toMatchObject({
      ok: true,
      data: {
        accounts: { items: [{ id: "acct-1", kycStatus: "verified" }], source: "gateway" },
        transfers: { items: [{ id: "transfer-1", fromAccountId: "acct-1" }], source: "gateway" },
        ledgerStats: { net: 25, entryCount: 2 }
      }
    });
  });
});
