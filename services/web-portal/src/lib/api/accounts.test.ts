import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAccount,
  freezeAccount,
  getAccount,
  getAccountBalance,
  updateAccountKyc
} from "./accounts";

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...init.headers },
    ...init
  });

const account = {
  balance: "1000.00",
  created_at: "2026-04-13T10:00:00.000Z",
  email: "evelyn@example.com",
  id: "123e4567-e89b-12d3-a456-426614174000",
  kyc_status: "pending",
  name: "Evelyn Rothschild",
  status: "active",
  updated_at: "2026-04-13T11:00:00.000Z"
};

describe("accounts api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates accounts through the gateway account boundary", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: account }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createAccount(
      { email: "evelyn@example.com", initialBalance: "1000.00", name: "Evelyn Rothschild" },
      {
        baseUrl: "http://gateway.test",
        session: { accessToken: "access-token", role: "operator" }
      }
    );

    expect(result).toMatchObject({
      ok: true,
      status: 201,
      data: { id: account.id, kycStatus: "pending" }
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://gateway.test/v1/accounts",
      expect.objectContaining({
        body: JSON.stringify({
          email: "evelyn@example.com",
          initial_balance: "1000.00",
          name: "Evelyn Rothschild"
        }),
        method: "POST"
      })
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((request.headers as Headers).get("Authorization")).toBe("Bearer access-token");
  });

  it("reads account detail, balance, KYC, and freeze endpoints", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: true, data: account }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: account.id, balance: "1000.00" } }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { ...account, kyc_status: "verified" } }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { ...account, status: "suspended" } }));
    vi.stubGlobal("fetch", fetchMock);

    const options = {
      baseUrl: "http://gateway.test",
      session: { accessToken: "access-token", role: "admin" as const }
    };

    await expect(getAccount(account.id, options)).resolves.toMatchObject({ ok: true, data: { email: account.email } });
    await expect(getAccountBalance(account.id, options)).resolves.toMatchObject({ ok: true, data: { balance: "1000.00" } });
    await expect(updateAccountKyc({ accountId: account.id, kycStatus: "verified" }, options)).resolves.toMatchObject({
      ok: true,
      data: { kycStatus: "verified" }
    });
    await expect(freezeAccount(account.id, options)).resolves.toMatchObject({
      ok: true,
      data: { status: "suspended" }
    });

    const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]));

    expect(requestedUrls).toEqual([
      `http://gateway.test/v1/accounts/${account.id}`,
      `http://gateway.test/v1/accounts/${account.id}/balance`,
      `http://gateway.test/v1/accounts/${account.id}/kyc`,
      `http://gateway.test/v1/accounts/${account.id}/freeze`
    ]);
  });

  it("normalizes nested account service errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { success: false, error: { code: "CONFLICT", message: "Account with this email already exists" } },
          { status: 409, headers: { "x-request-id": "req-account" } }
        )
      )
    );

    const result = await createAccount(
      { email: "evelyn@example.com", initialBalance: "1000.00", name: "Evelyn Rothschild" },
      { baseUrl: "http://gateway.test", session: { accessToken: "access-token", role: "operator" } }
    );

    expect(result).toEqual({ ok: false, status: 409, error: "conflict", requestId: "req-account" });
  });
});
