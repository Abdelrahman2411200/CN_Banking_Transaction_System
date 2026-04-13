import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "./AppShell";
import type { NavItem } from "./Sidebar";

const navItems: NavItem[] = [
  { href: "#dashboard", icon: "dashboard", label: "Dashboard", active: true },
  { href: "#accounts", icon: "account_balance", label: "Accounts" }
];

describe("AppShell", () => {
  it("renders primary and mobile navigation with active item", () => {
    render(
      <AppShell navItems={navItems} title="Design System">
        <p>Gallery content</p>
      </AppShell>
    );

    expect(screen.getAllByText("Dashboard")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Design System" })).toBeInTheDocument();
    expect(screen.getByText("Gallery content")).toBeInTheDocument();
  });
});
