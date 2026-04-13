import type { ReactElement } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppShell, type NavItem } from "../../components/layout";
import { Button, StatusChip } from "../../components/primitives";
import { logoutUser } from "../../lib/api/auth";
import type { UserRole } from "../auth/session";
import { readStoredSession } from "../auth/session";
import type { SessionReader } from "./ProtectedRoute";
import { adminOperatorRoutes, customerOperatorRoutes } from "./routeConfig";

const adminOperatorRoles: UserRole[] = ["admin", "operator"];

const isActiveRoute = (pathname: string, href: string): boolean =>
  pathname === href || pathname.startsWith(`${href}/`);

export interface PortalLayoutProps {
  getSession?: SessionReader;
  logoutSession?: () => Promise<unknown>;
}

export const PortalLayout = ({
  getSession = readStoredSession,
  logoutSession = logoutUser
}: PortalLayoutProps): ReactElement => {
  const location = useLocation();
  const navigate = useNavigate();
  const session = getSession();
  const role = session?.role ?? "customer";
  const roleCanViewAdminRoutes = adminOperatorRoles.includes(role);
  const routes = roleCanViewAdminRoutes
    ? [...customerOperatorRoutes, ...adminOperatorRoutes]
    : customerOperatorRoutes;

  const navItems: NavItem[] = routes
    .filter((route) => route.showInNav)
    .map((route) => ({
      active: isActiveRoute(location.pathname, route.path),
      href: route.path,
      icon: route.icon,
      label: route.label
    }));

  const handleLogout = async (): Promise<void> => {
    await logoutSession();
    void navigate("/login", {
      replace: true,
      state: { authNotice: "Signed out. Re-authenticate to access the ledger." }
    });
  };

  return (
    <AppShell
      actions={
        <>
          <StatusChip status="info">{role}</StatusChip>
          <Button onClick={() => void handleLogout()} variant="secondary">Sign out</Button>
        </>
      }
      navItems={navItems}
      title="Banking Ops"
    >
      <Outlet />
    </AppShell>
  );
};
