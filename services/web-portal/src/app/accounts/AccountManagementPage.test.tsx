import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ApiResult } from "../../lib/api/client";
import type { AccountBalance, AccountKycStatus, AccountRecord } from "../../lib/api/accounts";
import type { AuthSession } from "../auth/session";
import { AccountManagementPage, type AccountClient } from "./AccountManagementPage";

const accountId = "123e4567-e89b-12d3-a456-426614174000";

const account = (overrides: Partial<AccountRecord> = {}): AccountRecord => ({
  balance: "1000.00",
  createdAt: "2026-04-13T10:00:00.000Z",
  email: "evelyn@example.com",
  id: accountId,
  kycStatus: "pending",
  name: "Evelyn Rothschild",
  status: "active",
  updatedAt: "2026-04-13T11:00:00.000Z",
  ...overrides
});

const balance = (value = "1000.00"): AccountBalance => ({ balance: value, id: accountId });

const success = <T,>(data: T, status = 200): ApiResult<T> => ({ ok: true, status, data });
const failure = (error: string, status = 400): ApiResult<never> => ({ ok: false, status, error });

const makeClient = (overrides: Partial<AccountClient> = {}): AccountClient => ({
  create: vi.fn<AccountClient["create"]>().mockResolvedValue(success(account(), 201)),
  freeze: vi.fn<AccountClient["freeze"]>().mockResolvedValue(success(account({ status: "suspended" }))),
  get: vi.fn<AccountClient["get"]>().mockResolvedValue(success(account())),
  getBalance: vi.fn<AccountClient["getBalance"]>().mockResolvedValue(success(balance())),
  updateKyc: vi.fn<AccountClient["updateKyc"]>().mockResolvedValue(success(account({ kycStatus: "verified" }))),
  ...overrides
});

const sessionFor = (role: AuthSession["role"]): AuthSession => ({
  accessToken: `token-for-${role}`,
  role
});

const renderAccounts = (
  client: AccountClient,
  initialPath = "/accounts",
  role: AuthSession["role"] = "operator"
): void => {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          element={<AccountManagementPage accountClient={client} getSession={() => sessionFor(role)} />}
          path="/accounts"
        />
        <Route
          element={<AccountManagementPage accountClient={client} getSession={() => sessionFor(role)} />}
          path="/accounts/:id"
        />
      </Routes>
    </MemoryRouter>
  );
};

describe("AccountManagementPage", () => {
  it("validates account creation fields before calling the gateway", async () => {
    const user = userEvent.setup();
    const client = makeClient();
    renderAccounts(client);

    await user.click(screen.getByRole("button", { name: /Generate Identity Record/i }));

    expect(await screen.findByText("Enter the account holder's legal name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Use a non-negative USD amount with up to 2 decimals.")).toBeInTheDocument();
    expect(client.create).not.toHaveBeenCalled();
  });

  it("creates an account and loads its detail route", async () => {
    const user = userEvent.setup();
    const client = makeClient();
    renderAccounts(client);

    await user.type(screen.getByLabelText(/Full Legal Name/i), "Evelyn Rothschild");
    await user.type(screen.getByLabelText(/Email Address/i), "evelyn@example.com");
    await user.type(screen.getByLabelText(/Initial Reserve USD/i), "1000.00");
    await user.click(screen.getByRole("button", { name: /Generate Identity Record/i }));

    expect(client.create).toHaveBeenCalledWith(
      { email: "evelyn@example.com", initialBalance: "1000.00", name: "Evelyn Rothschild" },
      expect.objectContaining({ role: "operator" })
    );
    expect(await screen.findByText("Account Created")).toBeInTheDocument();
    expect(await screen.findByText("UUID: 123e4567-e89b-12d3-a456-426614174000")).toBeInTheDocument();
    expect(screen.getAllByText("$1,000.00").length).toBeGreaterThan(0);
  });

  it("surfaces lookup errors from the account gateway", async () => {
    const user = userEvent.setup();
    const client = makeClient({
      get: vi.fn<AccountClient["get"]>().mockResolvedValue(failure("not_found", 404))
    });
    renderAccounts(client);

    await user.type(screen.getByLabelText(/Account UUID/i), accountId);
    await user.click(screen.getByRole("button", { name: /Lookup Account/i }));

    expect(await screen.findByText("Account detail unavailable")).toBeInTheDocument();
    expect(screen.getByText("No account record matched that identifier.")).toBeInTheDocument();
  });

  it("lets operators update KYC and freeze with refetch after mutation", async () => {
    const user = userEvent.setup();
    const client = makeClient({
      freeze: vi.fn<AccountClient["freeze"]>().mockResolvedValue(success(account({ status: "suspended" }))),
      get: vi
        .fn<AccountClient["get"]>()
        .mockResolvedValueOnce(success(account()))
        .mockResolvedValueOnce(success(account({ kycStatus: "verified" })))
        .mockResolvedValueOnce(success(account({ kycStatus: "verified", status: "suspended" }))),
      updateKyc: vi.fn<AccountClient["updateKyc"]>().mockResolvedValue(success(account({ kycStatus: "verified" })))
    });
    renderAccounts(client, `/accounts/${accountId}`, "operator");

    expect(await screen.findByText("UUID: 123e4567-e89b-12d3-a456-426614174000")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/KYC Status/i), "verified" satisfies AccountKycStatus);
    await user.click(screen.getByRole("button", { name: /Update KYC/i }));

    expect(client.updateKyc).toHaveBeenCalledWith(accountId, "verified", expect.objectContaining({ role: "operator" }));
    expect(await screen.findByText("KYC Updated")).toBeInTheDocument();
    expect(await screen.findByText("KYC verified")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Freeze$/i }));

    expect(client.freeze).toHaveBeenCalledWith(accountId, expect.objectContaining({ role: "operator" }));
    expect(await screen.findByText("Account Frozen")).toBeInTheDocument();
    expect((await screen.findAllByText("suspended")).length).toBeGreaterThan(0);
  });

  it("keeps KYC and freeze controls unavailable to customers", async () => {
    const client = makeClient();
    renderAccounts(client, `/accounts/${accountId}`, "customer");

    expect(await screen.findByText("Operator access required")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Update KYC/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Freeze$/i })).not.toBeInTheDocument();
  });
});
