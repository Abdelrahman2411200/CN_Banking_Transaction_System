import type { ReactElement } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { AuthSession, UserRole } from "../auth/session";
import { readStoredSession } from "../auth/session";
import { ForbiddenPage } from "./RoutePages";

export type SessionReader = () => AuthSession | null;

export interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  getSession?: SessionReader;
}

export const ProtectedRoute = ({
  allowedRoles,
  getSession = readStoredSession
}: ProtectedRouteProps): ReactElement => {
  const location = useLocation();
  const session = getSession();

  if (!session) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return <ForbiddenPage attemptedPath={location.pathname} />;
  }

  return <Outlet />;
};
