import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { AuthSession } from "../auth/session";
import { PortalRoutes } from "./PortalRoutes";
import { adminOperatorRoutes, customerOperatorRoutes, publicRoutes } from "./routeConfig";

const sessionFor = (role: AuthSession["role"]): AuthSession => ({
  accessToken: `token-for-${role}`,
  role
});

const renderRoute = (path: string, session: AuthSession | null = sessionFor("operator")) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <PortalRoutes getSession={() => session} refreshSession={() => Promise.resolve({ ok: false, status: 401, error: "refresh_token_required" })} />
    </MemoryRouter>
  );

describe("PortalRoutes", () => {
  it("defines the Phase 2 public and protected route groups", () => {
    expect(publicRoutes.map((route) => route.path)).toEqual(["/login", "/register"]);
    expect(customerOperatorRoutes.map((route) => route.path)).toEqual(
      expect.arrayContaining([
        "/dashboard",
        "/accounts",
        "/accounts/:id",
        "/transfers",
        "/transfers/:id",
        "/ledger",
        "/ledger/transfers/:transferId"
      ])
    );
    expect(adminOperatorRoutes.map((route) => route.path)).toEqual(
      expect.arrayContaining(["/fraud", "/fraud/alerts/:alertId", "/notifications", "/observability", "/platform-health"])
    );
  });

  it("redirects protected routes to login when no session is present", async () => {
    renderRoute("/dashboard", null);

    expect(await screen.findByRole("heading", { name: "Architectural Access" })).toBeInTheDocument();
  });

  it("restores protected routes by refreshing the session before redirecting", async () => {
    const refreshSession = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: sessionFor("operator")
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <PortalRoutes getSession={() => null} refreshSession={refreshSession} />
      </MemoryRouter>
    );

    expect(screen.getByRole("status")).toHaveTextContent("Restoring secure session");
    expect(await screen.findByRole("heading", { name: "Banking Ops" })).toBeInTheDocument();
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it("redirects to login when session refresh fails", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <PortalRoutes
          getSession={() => null}
          refreshSession={() => Promise.resolve({ ok: false, status: 401, error: "invalid_refresh_token" })}
        />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Architectural Access" })).toBeInTheDocument();
  });

  it("keeps the design-system gallery available as the manual parity gate", () => {
    renderRoute("/design-system", null);

    expect(screen.getByRole("heading", { name: "Design System Gallery" })).toBeInTheDocument();
  });

  it("renders the app shell and active route for authenticated users", () => {
    renderRoute("/transfers/transfer-123", sessionFor("operator"));

    expect(screen.getByRole("heading", { name: "Banking Ops" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Transfer Detail" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /transfers/i })[0]).toHaveAttribute("aria-current", "page");
  });

  it("hides and blocks admin routes for customer sessions", () => {
    renderRoute("/fraud", sessionFor("customer"));

    expect(screen.getByText("Route access restricted")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /fraud/i })).not.toBeInTheDocument();
  });

  it("renders not found routes", () => {
    renderRoute("/missing-route", sessionFor("admin"));

    expect(screen.getByText("Route not found")).toBeInTheDocument();
  });

  it("logs out from the app shell", async () => {
    const user = userEvent.setup();
    const logoutSession = vi.fn().mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <PortalRoutes getSession={() => sessionFor("admin")} logoutSession={logoutSession} />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    expect(logoutSession).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Signed out. Re-authenticate to access the ledger.")).toBeInTheDocument();
  });
});
