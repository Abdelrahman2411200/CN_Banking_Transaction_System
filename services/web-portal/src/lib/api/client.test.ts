import { describe, expect, it, vi } from "vitest";
import { requestJson } from "./client";

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...init.headers },
    ...init
  });

describe("api client", () => {
  it("normalizes gateway errors with request id and retry hints", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { error: "rate_limit_exceeded", retryAfter: 60 },
          { status: 429, headers: { "x-request-id": "req-123" } }
        )
      )
    );

    await expect(requestJson("http://localhost:8080/v1/auth/login")).resolves.toEqual({
      ok: false,
      status: 429,
      error: "rate_limit_exceeded",
      retryAfter: 60,
      requestId: "req-123"
    });

    vi.unstubAllGlobals();
  });

  it("injects authorization and retries one time after refreshing a token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "token_expired" }, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, { status: 200, headers: { "x-request-id": "req-456" } }));

    vi.stubGlobal("fetch", fetchMock);

    const result = await requestJson<{ ok: boolean }>("http://localhost:8080/v1/accounts", {
      accessToken: "expired-token",
      refreshAccessToken: () => Promise.resolve("fresh-token")
    });

    expect(result).toEqual({ ok: true, status: 200, data: { ok: true }, requestId: "req-456" });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8080/v1/accounts",
      expect.objectContaining({
        headers: expect.any(Headers) as Headers
      })
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Headers).toHaveProperty("get");
    expect(((fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Headers).get("Authorization")).toBe(
      "Bearer expired-token"
    );
    expect(((fetchMock.mock.calls[1]?.[1] as RequestInit).headers as Headers).get("Authorization")).toBe(
      "Bearer fresh-token"
    );

    vi.unstubAllGlobals();
  });
});
