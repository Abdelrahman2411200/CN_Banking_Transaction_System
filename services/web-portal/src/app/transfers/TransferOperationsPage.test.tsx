import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ApiResult } from "../../lib/api/client";
import type { TransferRecord, TransferStatus } from "../../lib/api/transfers";
import type { AuthSession } from "../auth/session";
import { TransferOperationsPage, type TransferClient } from "./TransferOperationsPage";

const sourceAccountId = "123e4567-e89b-12d3-a456-426614174000";
const destinationAccountId = "323e4567-e89b-12d3-a456-426614174222";
const transferId = "223e4567-e89b-12d3-a456-426614174111";

const transfer = (overrides: Partial<TransferRecord> = {}): TransferRecord => ({
  amount: "1250.00",
  createdAt: "2026-04-14T10:00:00.000Z",
  errorMessage: null,
  fromAccountId: sourceAccountId,
  id: transferId,
  sagaState: {
    compensationCompleted: false,
    creditCompleted: false,
    currentStep: "debit",
    debitCompleted: true,
    error: null
  },
  status: "initiated",
  toAccountId: destinationAccountId,
  updatedAt: "2026-04-14T10:01:00.000Z",
  ...overrides
});

const success = <T,>(data: T, status = 200): ApiResult<T> => ({ ok: true, status, data });
const failure = (error: string, status = 400): ApiResult<never> => ({ ok: false, status, error });

const makeClient = (overrides: Partial<TransferClient> = {}): TransferClient => ({
  create: vi.fn<TransferClient["create"]>().mockResolvedValue(success(transfer(), 201)),
  get: vi.fn<TransferClient["get"]>().mockResolvedValue(success(transfer())),
  ...overrides
});

const sessionFor = (role: AuthSession["role"]): AuthSession => ({
  accessToken: `token-for-${role}`,
  role
});

const renderTransfers = (
  client: TransferClient,
  initialPath = "/transfers",
  role: AuthSession["role"] = "operator"
): void => {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          element={<TransferOperationsPage getSession={() => sessionFor(role)} transferClient={client} />}
          path="/transfers"
        />
        <Route
          element={<TransferOperationsPage getSession={() => sessionFor(role)} transferClient={client} />}
          path="/transfers/:id"
        />
      </Routes>
    </MemoryRouter>
  );
};

describe("TransferOperationsPage", () => {
  it("validates transfer fields before calling the gateway", async () => {
    const user = userEvent.setup();
    const client = makeClient();
    renderTransfers(client);

    await user.click(screen.getByRole("button", { name: /Initiate Transfer/i }));

    expect(await screen.findByText("Enter a valid source account UUID.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid destination account UUID.")).toBeInTheDocument();
    expect(screen.getByText("Use a positive USD amount with up to 2 decimals.")).toBeInTheDocument();
    expect(client.create).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Source Account UUID/i), sourceAccountId);
    await user.type(screen.getByLabelText(/Destination Account UUID/i), sourceAccountId);
    await user.type(screen.getByLabelText(/Transfer Amount/i), "10.00");
    await user.click(screen.getByRole("button", { name: /Initiate Transfer/i }));

    expect(await screen.findByText("Destination must use a different account UUID.")).toBeInTheDocument();
    expect(client.create).not.toHaveBeenCalled();
  });

  it("initiates a transfer once and sends the idempotency key", async () => {
    const user = userEvent.setup();
    let resolveCreate: ((result: ApiResult<TransferRecord>) => void) | undefined;
    const create = vi.fn<TransferClient["create"]>().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );
    const client = makeClient({ create });
    renderTransfers(client);

    await user.type(screen.getByLabelText(/Source Account UUID/i), sourceAccountId);
    await user.type(screen.getByLabelText(/Destination Account UUID/i), destinationAccountId);
    await user.type(screen.getByLabelText(/Transfer Amount/i), "1250.00");
    await user.dblClick(screen.getByRole("button", { name: /Initiate Transfer/i }));

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      { amount: "1250.00", fromAccountId: sourceAccountId, toAccountId: destinationAccountId },
      expect.objectContaining({ role: "operator" }),
      expect.stringMatching(/^tx_/)
    );

    resolveCreate?.(success(transfer(), 201));

    expect(await screen.findByText("Transfer Initiated")).toBeInTheDocument();
    expect(await screen.findByText(`UUID: ${transferId}`)).toBeInTheDocument();
  });

  it("surfaces lookup errors from the transfer gateway", async () => {
    const user = userEvent.setup();
    const client = makeClient({
      get: vi.fn<TransferClient["get"]>().mockResolvedValue(failure("not_found", 404))
    });
    renderTransfers(client);

    await user.type(screen.getByLabelText(/Transfer UUID/i), transferId);
    await user.click(screen.getByRole("button", { name: /Monitor Transfer/i }));

    expect(await screen.findByText("Transfer detail unavailable")).toBeInTheDocument();
    expect(screen.getByText("No transfer matched that identifier.")).toBeInTheDocument();
  });

  it.each([
    ["initiated", "debit"],
    ["completed", "completed"],
    ["failed", "credit"],
    ["compensating", "compensation"],
    ["compensation_failed", "compensation"]
  ] satisfies Array<[TransferStatus, TransferRecord["sagaState"]["currentStep"]]>)(
    "renders the %s saga state",
    async (status, currentStep) => {
      const client = makeClient({
        get: vi.fn<TransferClient["get"]>().mockResolvedValue(
          success(
            transfer({
              errorMessage: status === "failed" || status === "compensation_failed" ? "Credit failed" : null,
              sagaState: {
                compensationCompleted: status === "failed",
                creditCompleted: status === "completed",
                currentStep,
                debitCompleted: true,
                error: status === "compensating" ? "Compensation in progress" : null
              },
              status
            })
          )
        )
      });
      renderTransfers(client, `/transfers/${transferId}`);

      expect((await screen.findAllByText(status.replace(/_/g, " "))).length).toBeGreaterThan(0);
      expect(screen.getAllByText(currentStep).length).toBeGreaterThan(0);
    }
  );

  it("refreshes saga state and exposes copy transfer ID feedback", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    const client = makeClient({
      get: vi
        .fn<TransferClient["get"]>()
        .mockResolvedValueOnce(success(transfer()))
        .mockResolvedValueOnce(success(transfer({ status: "completed", sagaState: { ...transfer().sagaState, creditCompleted: true, currentStep: "completed" } })))
    });
    renderTransfers(client, `/transfers/${transferId}`);

    expect((await screen.findAllByText("initiated")).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /Refresh Status/i }));

    expect((await screen.findAllByText("completed")).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /Copy Transfer ID/i }));

    expect(writeText).toHaveBeenCalledWith(transferId);
    expect(await screen.findByText("Transfer ID Ready")).toBeInTheDocument();
  });
});
