import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createAccount } from "./accounts";
import { loginUser, registerUser } from "./auth";
import { requestJson } from "./client";
import { getGatewayHealth } from "./health";
import type { AuthSession } from "../../app/auth/session";

const baseUrl = "http://gateway.test";
const accountId = "123e4567-e89b-12d3-a456-426614174000";

const session: AuthSession = {
  accessToken: "contract-token",
  role: "operator",
  subject: "operator-contract"
};

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe("gateway contract tests", () => {
  it("handles success envelopes through gateway-only account APIs", async () => {
    server.use(
      http.post(`${baseUrl}/v1/accounts`, async ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer contract-token");
        expect(await request.json()).toEqual({
          email: "evelyn@example.com",
          initial_balance: "1000.00",
          name: "Evelyn Rothschild"
        });

        return HttpResponse.json(
          {
            data: {
              balance: "1000.00",
              created_at: "2026-04-13T10:00:00.000Z",
              email: "evelyn@example.com",
              id: accountId,
              kyc_status: "pending",
              name: "Evelyn Rothschild",
              status: "active",
              updated_at: "2026-04-13T10:00:00.000Z"
            },
            success: true
          },
          { status: 201, headers: { "x-request-id": "req-success" } }
        );
      })
    );

    const result = await createAccount(
      { email: "evelyn@example.com", initialBalance: "1000.00", name: "Evelyn Rothschild" },
      { baseUrl, session }
    );

    expect(result).toMatchObject({
      data: {
        balance: "1000.00",
        id: accountId,
        kycStatus: "pending"
      },
      ok: true,
      requestId: "req-success",
      status: 201
    });
  });

  it("normalizes validation failures from auth registration", async () => {
    server.use(
      http.post(`${baseUrl}/v1/auth/register`, () =>
        HttpResponse.json(
          { error: { code: "VALIDATION_FAILED", message: "Email is invalid" } },
          { status: 400, headers: { "x-request-id": "req-validation" } }
        )
      )
    );

    await expect(
      registerUser({ email: "bad", password: "secret-key", role: "customer" }, { baseUrl })
    ).resolves.toEqual({
      error: "validation_failed",
      ok: false,
      requestId: "req-validation",
      retryAfter: undefined,
      status: 400
    });
  });

  it("preserves forbidden admin route responses", async () => {
    server.use(
      http.get(`${baseUrl}/v1/fraud/alerts`, () =>
        HttpResponse.json({ error: "forbidden" }, { status: 403, headers: { "x-request-id": "req-forbidden" } })
      )
    );

    await expect(
      requestJson(`${baseUrl}/v1/fraud/alerts`, { accessToken: "customer-token" })
    ).resolves.toEqual({
      error: "forbidden",
      ok: false,
      requestId: "req-forbidden",
      retryAfter: undefined,
      status: 403
    });
  });

  it("maps degraded gateway health without treating it as unavailable", async () => {
    server.use(
      http.get(`${baseUrl}/health`, () =>
        HttpResponse.json({
          services: {
            "api-gateway": "ok",
            "ledger-service": "degraded"
          },
          status: "degraded"
        })
      )
    );

    await expect(getGatewayHealth(baseUrl)).resolves.toEqual({
      message: "Gateway degraded",
      services: {
        "api-gateway": "ok",
        "ledger-service": "degraded"
      },
      status: "degraded"
    });
  });

  it("normalizes rate limits with retry hints", async () => {
    server.use(
      http.post(`${baseUrl}/v1/auth/login`, () =>
        HttpResponse.json(
          { error: "rate_limit_exceeded" },
          { status: 429, headers: { "retry-after": "45", "x-request-id": "req-rate" } }
        )
      )
    );

    await expect(loginUser({ email: "operator@example.com", password: "secret-key" }, { baseUrl })).resolves.toEqual({
      error: "rate_limit_exceeded",
      ok: false,
      requestId: "req-rate",
      retryAfter: 45,
      status: 429
    });
  });
});
