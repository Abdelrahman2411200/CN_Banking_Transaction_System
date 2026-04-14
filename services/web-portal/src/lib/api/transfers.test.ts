import { afterEach, describe, expect, it, vi } from "vitest";
import { createTransfer, getTransfer } from "./transfers";

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...init.headers },
    ...init
  });

const transfer = {
  amount: "1250.00",
  created_at: "2026-04-14T10:00:00.000Z",
  error_message: null,
  from_account_id: "123e4567-e89b-12d3-a456-426614174000",
  id: "223e4567-e89b-12d3-a456-426614174111",
  saga_state: {
    compensation_completed: false,
    credit_completed: false,
    current_step: "debit",
    debit_completed: true,
    error: null
  },
  status: "initiated",
  to_account_id: "323e4567-e89b-12d3-a456-426614174222",
  updated_at: "2026-04-14T10:01:00.000Z"
};

describe("transfers api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates transfers through the gateway with an Idempotency-Key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: transfer }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createTransfer(
      {
        amount: "1250.00",
        fromAccountId: transfer.from_account_id,
        toAccountId: transfer.to_account_id
      },
      {
        baseUrl: "http://gateway.test",
        idempotencyKey: "tx_test_key",
        session: { accessToken: "access-token", role: "operator" }
      }
    );

    expect(result).toMatchObject({
      ok: true,
      status: 201,
      data: {
        amount: "1250.00",
        fromAccountId: transfer.from_account_id,
        id: transfer.id,
        sagaState: { currentStep: "debit", debitCompleted: true },
        status: "initiated",
        toAccountId: transfer.to_account_id
      }
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://gateway.test/v1/transfers",
      expect.objectContaining({
        body: JSON.stringify({
          amount: "1250.00",
          from_account_id: transfer.from_account_id,
          to_account_id: transfer.to_account_id
        }),
        method: "POST"
      })
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(request.headers);
    expect(headers.get("Idempotency-Key")).toBe("tx_test_key");
  });

  it("reads transfer detail and normalizes compensation failure errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          data: {
            ...transfer,
            error_message: "Credit failed; compensation failed",
            saga_state: {
              compensation_completed: false,
              credit_completed: false,
              current_step: "compensation",
              debit_completed: true,
              error: "Credit failed; compensation failed"
            },
            status: "compensation_failed"
          }
        })
      )
    );

    await expect(
      getTransfer(transfer.id, {
        baseUrl: "http://gateway.test",
        session: { accessToken: "access-token", role: "admin" }
      })
    ).resolves.toMatchObject({
      ok: true,
      data: {
        errorMessage: "Credit failed; compensation failed",
        sagaState: { currentStep: "compensation" },
        status: "compensation_failed"
      }
    });
  });

  it("normalizes transfer service errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { success: false, error: { code: "INSUFFICIENT_FUNDS", message: "Insufficient funds for transfer" } },
          { status: 422, headers: { "x-request-id": "req-transfer" } }
        )
      )
    );

    const result = await createTransfer(
      {
        amount: "999999.00",
        fromAccountId: transfer.from_account_id,
        toAccountId: transfer.to_account_id
      },
      { baseUrl: "http://gateway.test", idempotencyKey: "tx_test_key", session: { accessToken: "access-token", role: "operator" } }
    );

    expect(result).toEqual({ ok: false, status: 422, error: "insufficient_funds", requestId: "req-transfer" });
  });
});
