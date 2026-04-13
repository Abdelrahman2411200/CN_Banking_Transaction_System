import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
      <PortalRoutes getSession={() => session} />
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

  it("redirects protected routes to login when no session is present", () => {
    renderRoute("/dashboard", null);

    expect(screen.getByRole("heading", { name: "Operator access" })).toBeInTheDocument();
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
});
