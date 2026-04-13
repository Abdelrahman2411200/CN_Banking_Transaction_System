import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ApiResult } from "../../lib/api/client";
import type { RegisterResponse } from "../../lib/api/auth";
import type { AuthSession } from "./session";
import { LoginPage, RegisterPage, getPostLoginPath, type AuthClient } from "./AuthPages";

const sessionFor = (role: AuthSession["role"]): AuthSession => ({
  accessToken: `token-for-${role}`,
  refreshToken: `refresh-for-${role}`,
  role,
  subject: `${role}-1`
});

const successRegister: RegisterResponse = {
  email: "new@example.com",
  role: "customer",
  userId: "user-1"
};

const authClient = (overrides: Partial<AuthClient> = {}): AuthClient => ({
  login: vi.fn<AuthClient["login"]>().mockResolvedValue({
    ok: true,
    status: 200,
    data: sessionFor("customer")
  }),
  register: vi.fn<AuthClient["register"]>().mockResolvedValue({
    ok: true,
    status: 201,
    data: successRegister
  }),
  ...overrides
});

const renderAuthRoute = (initialPath: string, client: AuthClient): void => {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<LoginPage authClient={client} />} path="/login" />
        <Route element={<RegisterPage authClient={client} />} path="/register" />
        <Route element={<h1>Customer dashboard</h1>} path="/dashboard" />
        <Route element={<h1>Fraud operations</h1>} path="/fraud" />
      </Routes>
    </MemoryRouter>
  );
};

describe("authentication pages", () => {
  it("validates login fields before calling the gateway", async () => {
    const user = userEvent.setup();
    const client = authClient();
    renderAuthRoute("/login", client);

    await user.click(screen.getByRole("button", { name: /initialize access/i }));

    expect(await screen.findByText("Enter a valid institutional email address.")).toBeInTheDocument();
    expect(screen.getByText("Access keys must be at least 8 characters.")).toBeInTheDocument();
    expect(client.login).not.toHaveBeenCalled();
  });

  it("shows password visibility and loading states", async () => {
    const user = userEvent.setup();
    let resolveLogin: (value: ApiResult<AuthSession>) => void = () => undefined;
    const loginPromise = new Promise<ApiResult<AuthSession>>((resolve) => {
      resolveLogin = resolve;
    });
    const client = authClient({
      login: vi.fn<AuthClient["login"]>().mockReturnValue(loginPromise)
    });
    renderAuthRoute("/login", client);

    await user.type(screen.getByLabelText(/institutional email/i), "admin@example.com");
    await user.type(screen.getByLabelText(/encrypted access key/i), "secret-key");
    await user.click(screen.getByRole("button", { name: /show password/i }));

    expect(screen.getByLabelText(/encrypted access key/i)).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: /initialize access/i }));

    expect(screen.getByRole("button", { name: /authorizing/i })).toBeDisabled();

    resolveLogin({ ok: true, status: 200, data: sessionFor("customer") });
    expect(await screen.findByRole("heading", { name: "Customer dashboard" })).toBeInTheDocument();
  });

  it("redirects admins to the admin landing route after login", async () => {
    const user = userEvent.setup();
    const client = authClient({
      login: vi.fn<AuthClient["login"]>().mockResolvedValue({
        ok: true,
        status: 200,
        data: sessionFor("admin")
      })
    });
    renderAuthRoute("/login", client);

    await user.type(screen.getByLabelText(/institutional email/i), "admin@example.com");
    await user.type(screen.getByLabelText(/encrypted access key/i), "secret-key");
    await user.click(screen.getByRole("button", { name: /initialize access/i }));

    expect(await screen.findByRole("heading", { name: "Fraud operations" })).toBeInTheDocument();
  });

  it("renders invalid credentials, rate-limit, and service-unavailable gateway states", async () => {
    const user = userEvent.setup();
    const client = authClient({
      login: vi
        .fn<AuthClient["login"]>()
        .mockResolvedValueOnce({ ok: false, status: 401, error: "invalid_credentials" })
        .mockResolvedValueOnce({ ok: false, status: 429, error: "rate_limit_exceeded", retryAfter: 60 })
        .mockResolvedValueOnce({ ok: false, status: 503, error: "service_degraded" })
    });
    renderAuthRoute("/login", client);

    await user.type(screen.getByLabelText(/institutional email/i), "admin@example.com");
    await user.type(screen.getByLabelText(/encrypted access key/i), "secret-key");
    await user.click(screen.getByRole("button", { name: /initialize access/i }));

    expect(await screen.findByText("Credentials do not match an active ledger identity.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /initialize access/i }));

    expect(await screen.findByText(/Too many attempts were detected/i)).toBeInTheDocument();
    expect(screen.getByText(/60 seconds/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /initialize access/i }));

    expect(await screen.findByText(/Authentication services are unavailable/i)).toBeInTheDocument();
  });

  it("registers a customer role and returns to login with a notice", async () => {
    const user = userEvent.setup();
    const client = authClient();
    renderAuthRoute("/register", client);

    await user.type(screen.getByLabelText(/full legal name/i), "Amina Ledger");
    await user.type(screen.getByLabelText(/institutional email/i), "new@example.com");
    await user.type(screen.getByLabelText(/encrypted access key/i), "secret-key");
    await user.click(screen.getByRole("button", { name: /create access/i }));

    expect(client.register).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "secret-key",
      role: "customer"
    });
    expect(await screen.findByText("Access profile created. Sign in to continue.")).toBeInTheDocument();
  });

  it("maps role-aware login defaults", () => {
    expect(getPostLoginPath("admin")).toBe("/fraud");
    expect(getPostLoginPath("operator")).toBe("/dashboard");
    expect(getPostLoginPath("customer", "/fraud")).toBe("/dashboard");
    expect(getPostLoginPath("admin", "/observability")).toBe("/observability");
  });
});
