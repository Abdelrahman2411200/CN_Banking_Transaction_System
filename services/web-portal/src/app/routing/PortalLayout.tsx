import type { ReactElement } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppShell, type NavItem } from "../../components/layout";
import { StatusChip } from "../../components/primitives";
import type { UserRole } from "../auth/session";
import { readStoredSession } from "../auth/session";
import type { SessionReader } from "./ProtectedRoute";
import { adminOperatorRoutes, customerOperatorRoutes } from "./routeConfig";

const adminOperatorRoles: UserRole[] = ["admin", "operator"];

const isActiveRoute = (pathname: string, href: string): boolean =>
  pathname === href || pathname.startsWith(`${href}/`);

export interface PortalLayoutProps {
  getSession?: SessionReader;
}

export const PortalLayout = ({ getSession = readStoredSession }: PortalLayoutProps): ReactElement => {
  const location = useLocation();
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

  return (
    <AppShell actions={<StatusChip status="info">{role}</StatusChip>} navItems={navItems} title="Banking Ops">
      <Outlet />
    </AppShell>
  );
};
