import { afterEach, describe, expect, it, vi } from "vitest";
import { clearStoredSession, readStoredSession } from "../../app/auth/session";
import { loginUser, logoutUser, refreshAuthSession, registerUser } from "./auth";

const makeToken = (claims: Record<string, unknown>): string => {
  const encodedClaims = btoa(JSON.stringify(claims)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `header.${encodedClaims}.signature`;
};

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...init.headers },
    ...init
  });

describe("auth api", () => {
  afterEach(() => {
    clearStoredSession(window.sessionStorage);
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("logs in through the gateway and writes an in-memory session", async () => {
    const accessToken = makeToken({ role: "admin", sub: "admin-1" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { accessToken, refreshToken: "refresh-token", expiresIn: 900 },
          { status: 200, headers: { "x-request-id": "req-login" } }
        )
      )
    );

    const result = await loginUser(
      { email: "admin@example.com", password: "secret" },
      { baseUrl: "http://localhost:8080", storage: window.sessionStorage }
    );

    expect(result).toMatchObject({
      ok: true,
      status: 200,
      requestId: "req-login",
      data: { accessToken, refreshToken: "refresh-token", role: "admin", subject: "admin-1" }
    });
    expect(readStoredSession(window.sessionStorage)).toMatchObject({ accessToken, role: "admin" });
  });

  it("registers through the gateway without writing a session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ userId: "user-1", email: "new@example.com", role: "customer" }, { status: 201 })
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await registerUser(
      { email: "new@example.com", password: "secret", role: "customer" },
      { baseUrl: "http://localhost:8080" }
    );

    expect(result).toMatchObject({
      ok: true,
      status: 201,
      data: { userId: "user-1", email: "new@example.com", role: "customer" }
    });
    expect(readStoredSession(window.sessionStorage)).toBeNull();
  });

  it("refreshes a session without rotating the refresh token", async () => {
    const originalToken = makeToken({ role: "customer", sub: "customer-1" });
    const refreshedToken = makeToken({ role: "customer", sub: "customer-1" });

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(jsonResponse({ accessToken: originalToken, refreshToken: "refresh-token", expiresIn: 900 }))
        .mockResolvedValueOnce(jsonResponse({ accessToken: refreshedToken, expiresIn: 900 }))
    );

    await loginUser(
      { email: "customer@example.com", password: "secret" },
      { baseUrl: "http://localhost:8080", storage: window.sessionStorage }
    );

    const result = await refreshAuthSession({ baseUrl: "http://localhost:8080", storage: window.sessionStorage });

    expect(result).toMatchObject({
      ok: true,
      data: { accessToken: refreshedToken, refreshToken: "refresh-token", role: "customer" }
    });
  });

  it("sends auth headers on logout and clears the session", async () => {
    const accessToken = makeToken({ role: "admin", sub: "admin-2" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ accessToken, refreshToken: "refresh-token", expiresIn: 900 }))
      .mockResolvedValueOnce(new Response(null, { status: 204, headers: { "x-request-id": "req-logout" } }));

    vi.stubGlobal("fetch", fetchMock);

    await loginUser(
      { email: "admin@example.com", password: "secret" },
      { baseUrl: "http://localhost:8080", storage: window.sessionStorage }
    );

    const result = await logoutUser({ baseUrl: "http://localhost:8080", storage: window.sessionStorage });
    const logoutRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;

    expect(result).toEqual({ ok: true, status: 204, data: null, requestId: "req-logout" });
    expect((logoutRequest.headers as Headers).get("Authorization")).toBe(`Bearer ${accessToken}`);
    expect(readStoredSession(window.sessionStorage)).toBeNull();
  });
});
