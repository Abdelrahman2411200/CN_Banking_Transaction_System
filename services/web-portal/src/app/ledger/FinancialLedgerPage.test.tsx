import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ApiResult } from "../../lib/api/client";
import type { LedgerEntry, LedgerStats } from "../../lib/api/ledger";
import type { AuthSession } from "../auth/session";
import { FinancialLedgerPage, type LedgerClient } from "./FinancialLedgerPage";

const accountId = "123e4567-e89b-12d3-a456-426614174000";
const destinationAccountId = "323e4567-e89b-12d3-a456-426614174222";
const transferId = "223e4567-e89b-12d3-a456-426614174111";

const ledgerEntry = (overrides: Partial<LedgerEntry> = {}): LedgerEntry => ({
  accountId,
  amount: "1250.00",
  createdAt: "2026-04-14T10:00:00.000Z",
  entryId: "ledger-entry-1",
  entryType: "debit",
  fromAccountId: accountId,
  sourceEvent: "bank.transfer.completed",
  status: "completed",
  toAccountId: destinationAccountId,
  transferId,
  ...overrides
});

const stats: LedgerStats = {
  entryCount: 2,
  net: 0,
  totalCredits: 1250,
  totalDebits: 1250
};

const success = <T,>(data: T, status = 200): ApiResult<T> => ({ ok: true, status, data });
const failure = (error: string, status = 400, requestId?: string): ApiResult<never> => ({
  ok: false,
  status,
  error,
  requestId
});

const makeClient = (overrides: Partial<LedgerClient> = {}): LedgerClient => ({
  getAccountEntries: vi.fn<LedgerClient["getAccountEntries"]>().mockResolvedValue(
    success([
      ledgerEntry(),
      ledgerEntry({
        accountId: destinationAccountId,
        entryId: "ledger-entry-2",
        entryType: "credit",
        status: "completed"
      })
    ])
  ),
  getStats: vi.fn<LedgerClient["getStats"]>().mockResolvedValue(success(stats)),
  getTransferEntries: vi.fn<LedgerClient["getTransferEntries"]>().mockResolvedValue(success([ledgerEntry()])),
  ...overrides
});

const sessionFor = (role: AuthSession["role"]): AuthSession => ({
  accessToken: `token-for-${role}`,
  role
});

const renderLedger = (
  client: LedgerClient,
  initialPath = "/ledger",
  role: AuthSession["role"] = "operator"
): void => {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          element={<FinancialLedgerPage getSession={() => sessionFor(role)} ledgerClient={client} />}
          path="/ledger"
        />
        <Route
          element={<FinancialLedgerPage getSession={() => sessionFor(role)} ledgerClient={client} />}
          path="/ledger/transfers/:transferId"
        />
      </Routes>
    </MemoryRouter>
  );
};

describe("FinancialLedgerPage", () => {
  it("validates account and transfer UUID lookup fields", async () => {
    const user = userEvent.setup();
    const client = makeClient();
    renderLedger(client);

    await user.click(screen.getByRole("button", { name: /Lookup Account Ledger/i }));
    await user.click(screen.getByRole("button", { name: /Lookup Transfer Audit/i }));

    expect(await screen.findByText("Enter a valid account UUID.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid transfer UUID.")).toBeInTheDocument();
    expect(client.getAccountEntries).not.toHaveBeenCalled();
    expect(client.getTransferEntries).not.toHaveBeenCalled();
  });

  it("loads account ledger entries grouped with stats cards", async () => {
    const user = userEvent.setup();
    const client = makeClient();
    renderLedger(client, "/ledger", "admin");

    await user.type(screen.getByLabelText(/Account UUID/i), accountId);
    await user.click(screen.getByRole("button", { name: /Lookup Account Ledger/i }));

    expect(client.getAccountEntries).toHaveBeenCalledWith(accountId, expect.objectContaining({ role: "admin" }));
    expect(client.getStats).toHaveBeenCalledWith(accountId, expect.objectContaining({ role: "admin" }));
    expect(await screen.findByText("Account Entries")).toBeInTheDocument();
    expect(screen.getByText("Apr 14, 2026")).toBeInTheDocument();
    expect(screen.getAllByText("bank.transfer.completed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$1,250.00").length).toBeGreaterThan(0);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders an empty ledger state", async () => {
    const user = userEvent.setup();
    const client = makeClient({
      getAccountEntries: vi.fn<LedgerClient["getAccountEntries"]>().mockResolvedValue(success([])),
      getStats: vi.fn<LedgerClient["getStats"]>().mockResolvedValue(success({ entryCount: 0, net: 0, totalCredits: 0, totalDebits: 0 }))
    });
    renderLedger(client);

    await user.type(screen.getByLabelText(/Account UUID/i), accountId);
    await user.click(screen.getByRole("button", { name: /Lookup Account Ledger/i }));

    expect(await screen.findByText("No ledger entries")).toBeInTheDocument();
    expect(screen.getByText("The gateway returned an empty ledger for this lookup.")).toBeInTheDocument();
  });

  it("keeps entries visible when account stats are forbidden", async () => {
    const user = userEvent.setup();
    const client = makeClient({
      getStats: vi.fn<LedgerClient["getStats"]>().mockResolvedValue(failure("forbidden", 403, "req-stats"))
    });
    renderLedger(client, "/ledger", "customer");

    await user.type(screen.getByLabelText(/Account UUID/i), accountId);
    await user.click(screen.getByRole("button", { name: /Lookup Account Ledger/i }));

    expect(await screen.findByText("Stats Restricted")).toBeInTheDocument();
    expect(screen.getByText("Ledger stats are restricted for this session. Account entries remain available.")).toBeInTheDocument();
    expect(screen.getByText("Account Entries")).toBeInTheDocument();
    expect(screen.getAllByText("Restricted").length).toBeGreaterThan(0);
  });

  it("renders transfer route lookup failures", async () => {
    const client = makeClient({
      getTransferEntries: vi.fn<LedgerClient["getTransferEntries"]>().mockResolvedValue(failure("not_found", 404, "req-ledger"))
    });
    renderLedger(client, `/ledger/transfers/${transferId}`);

    expect(await screen.findByText("Ledger lookup failed")).toBeInTheDocument();
    expect(screen.getByText("No ledger entries matched that transfer identifier. Reference req-ledger.")).toBeInTheDocument();
  });

  it("loads transfer audit entries from the transfer lookup route", async () => {
    const user = userEvent.setup();
    const client = makeClient();
    renderLedger(client);

    await user.type(screen.getByLabelText(/Transfer UUID/i), transferId);
    await user.click(screen.getByRole("button", { name: /Lookup Transfer Audit/i }));

    expect(await screen.findByText("Transfer Entries")).toBeInTheDocument();
    expect(client.getTransferEntries).toHaveBeenCalledWith(transferId, expect.objectContaining({ role: "operator" }));
    expect(screen.getByText(`Transfer ID`)).toBeInTheDocument();
  });
});
