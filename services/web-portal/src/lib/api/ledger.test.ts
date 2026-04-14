import { afterEach, describe, expect, it, vi } from "vitest";
import { getAccountLedger, getLedgerStats, getTransferLedger } from "./ledger";

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...init.headers },
    ...init
  });

const entry = {
  accountId: "123e4567-e89b-12d3-a456-426614174000",
  amount: { $numberDecimal: "1250.00" },
  createdAt: "2026-04-14T10:00:00.000Z",
  entryId: "ledger-entry-1",
  entryType: "debit",
  fromAccountId: "123e4567-e89b-12d3-a456-426614174000",
  sourceEvent: "bank.transfer.completed",
  status: "completed",
  toAccountId: "323e4567-e89b-12d3-a456-426614174222",
  transferId: "223e4567-e89b-12d3-a456-426614174111"
};

describe("ledger api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads account ledger entries through the gateway", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: [entry] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getAccountLedger(entry.accountId, {
      baseUrl: "http://gateway.test",
      session: { accessToken: "access-token", role: "operator" }
    });

    expect(result).toMatchObject({
      ok: true,
      data: [{ amount: "1250.00", entryId: "ledger-entry-1", entryType: "debit" }]
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`http://gateway.test/v1/ledger/${entry.accountId}`);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(request.method).toBeUndefined();
    expect((request.headers as Headers).get("Authorization")).toBe("Bearer access-token");
  });

  it("reads transfer-scoped entries and account stats", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: true, data: [{ ...entry, entryType: "credit", amount: "1250.00" }] }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { entryCount: 2, net: 0, totalCredits: 1250, totalDebits: 1250 } }));
    vi.stubGlobal("fetch", fetchMock);

    const options = {
      baseUrl: "http://gateway.test",
      session: { accessToken: "access-token", role: "admin" as const }
    };

    await expect(getTransferLedger(entry.transferId, options)).resolves.toMatchObject({
      ok: true,
      data: [{ amount: "1250.00", entryType: "credit" }]
    });
    await expect(getLedgerStats(entry.accountId, options)).resolves.toEqual({
      ok: true,
      status: 200,
      data: { entryCount: 2, net: 0, totalCredits: 1250, totalDebits: 1250 },
      requestId: undefined
    });

    const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(requestedUrls).toEqual([
      `http://gateway.test/v1/ledger/transfer/${entry.transferId}`,
      `http://gateway.test/v1/ledger/stats/${entry.accountId}`
    ]);
  });

  it("normalizes forbidden stats errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { success: false, error: { code: "FORBIDDEN", message: "Admin role required" } },
          { status: 403, headers: { "x-request-id": "req-ledger" } }
        )
      )
    );

    await expect(
      getLedgerStats(entry.accountId, {
        baseUrl: "http://gateway.test",
        session: { accessToken: "access-token", role: "customer" }
      })
    ).resolves.toEqual({ ok: false, status: 403, error: "forbidden", requestId: "req-ledger" });
  });
});
