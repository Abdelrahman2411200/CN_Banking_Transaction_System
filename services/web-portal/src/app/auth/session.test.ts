import { afterEach, describe, expect, it } from "vitest";
import {
  authStorageKey,
  clearStoredSession,
  parseJwtSession,
  readRefreshToken,
  readStoredSession,
  setInMemorySession,
  writeStoredSession
} from "./session";

const makeToken = (claims: Record<string, unknown>): string => {
  const encodedClaims = btoa(JSON.stringify(claims)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `header.${encodedClaims}.signature`;
};

describe("auth session", () => {
  afterEach(() => {
    clearStoredSession(window.sessionStorage);
    window.sessionStorage.clear();
  });

  it("parses role and subject from a JWT payload", () => {
    expect(parseJwtSession(makeToken({ role: "admin", sub: "user-1" }))).toMatchObject({
      accessToken: expect.any(String) as string,
      role: "admin",
      subject: "user-1"
    });
  });

  it("keeps the access token in memory while persisting refresh metadata", () => {
    const session = {
      accessToken: makeToken({ role: "customer", sub: "user-2" }),
      refreshToken: "refresh-token",
      role: "customer" as const,
      subject: "user-2"
    };

    writeStoredSession(session, window.sessionStorage);

    expect(readStoredSession(window.sessionStorage)).toEqual(session);
    const storedSession = window.sessionStorage.getItem(authStorageKey);
    expect(storedSession).not.toContain(session.accessToken);

    setInMemorySession(null);

    expect(readStoredSession(window.sessionStorage)).toBeNull();
    expect(readRefreshToken(window.sessionStorage)).toBe("refresh-token");
  });
});
