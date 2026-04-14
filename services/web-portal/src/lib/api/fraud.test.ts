import { afterEach, describe, expect, it, vi } from "vitest";
import { getFraudAlert, getFraudAlerts, getFraudStats } from "./fraud";

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...init.headers },
    ...init
  });

const alert = {
  alertId: "523e4567-e89b-12d3-a456-426614174555",
  amount: { $numberDecimal: "25000.00" },
  createdAt: "2026-04-14T10:00:00.000Z",
  fromAccountId: "123e4567-e89b-12d3-a456-426614174000",
  ruleTriggered: "rapid_drain",
  severity: "critical",
  sourceEventId: "fraud-event-1",
  transferId: "223e4567-e89b-12d3-a456-426614174111"
};

describe("fraud api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads fraud alerts with supported server-side filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: [alert] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getFraudAlerts(
      {
        accountId: alert.fromAccountId,
        from: "2026-04-14T00:00:00.000Z",
        limit: 20,
        page: 1,
        severity: "critical",
        to: "2026-04-14T23:59:59.999Z"
      },
      {
        baseUrl: "http://gateway.test",
        session: { accessToken: "access-token", role: "admin" }
      }
    );

    expect(result).toMatchObject({
      ok: true,
      data: [{ alertId: alert.alertId, amount: "25000.00", severity: "critical" }]
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `http://gateway.test/v1/fraud/alerts?severity=critical&accountId=${alert.fromAccountId}&from=2026-04-14T00%3A00%3A00.000Z&to=2026-04-14T23%3A59%3A59.999Z&page=1&limit=20`
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((request.headers as Headers).get("Authorization")).toBe("Bearer access-token");
  });

  it("reads fraud alert detail and severity stats", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: true, data: alert }))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            thisWeek: [{ _id: "critical", count: 2 }],
            today: [{ _id: "high", count: 1 }]
          }
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const options = {
      baseUrl: "http://gateway.test",
      session: { accessToken: "access-token", role: "admin" as const }
    };

    await expect(getFraudAlert(alert.alertId, options)).resolves.toMatchObject({
      ok: true,
      data: { ruleTriggered: "rapid_drain" }
    });
    await expect(getFraudStats(options)).resolves.toEqual({
      ok: true,
      status: 200,
      data: {
        thisWeek: [{ count: 2, severity: "critical" }],
        today: [{ count: 1, severity: "high" }]
      },
      requestId: undefined
    });
  });

  it("normalizes admin-only fraud errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { error: "forbidden" },
          { status: 403, headers: { "x-request-id": "req-fraud" } }
        )
      )
    );

    await expect(
      getFraudStats({
        baseUrl: "http://gateway.test",
        session: { accessToken: "access-token", role: "operator" }
      })
    ).resolves.toEqual({ ok: false, status: 403, error: "forbidden", requestId: "req-fraud" });
  });
});
