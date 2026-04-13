import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { AuthSession, UserRole } from "../auth/session";
import { readStoredSession } from "../auth/session";
import type { ApiResult } from "../../lib/api/client";
import { ForbiddenPage } from "./RoutePages";

export type SessionReader = () => AuthSession | null;
export type SessionRefresher = () => Promise<ApiResult<AuthSession>>;

export interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  getSession?: SessionReader;
  refreshSession?: SessionRefresher;
}

export const ProtectedRoute = ({
  allowedRoles,
  getSession = readStoredSession,
  refreshSession
}: ProtectedRouteProps): ReactElement => {
  const location = useLocation();
  const [restoredSession, setRestoredSession] = useState<AuthSession | null>(null);
  const [refreshState, setRefreshState] = useState<"idle" | "refreshing" | "restored" | "failed">("idle");
  const session = getSession() ?? restoredSession;

  useEffect(() => {
    let mounted = true;

    if (session || !refreshSession || refreshState !== "idle") {
      return () => {
        mounted = false;
      };
    }

    setRefreshState("refreshing");

    void refreshSession().then((result) => {
      if (!mounted) {
        return;
      }

      if (result.ok) {
        setRestoredSession(result.data);
        setRefreshState("restored");
        return;
      }

      setRefreshState("failed");
    });

    return () => {
      mounted = false;
    };
  }, [refreshSession, session]);

  if (!session && refreshSession && (refreshState === "idle" || refreshState === "refreshing")) {
    return (
      <main className="grid min-h-screen place-items-center bg-surface p-6 text-on-surface" role="status">
        <div className="rounded-lg bg-surface-container-lowest p-5 text-body-md text-on-surface-variant">
          Restoring secure session
        </div>
      </main>
    );
  }

  if (!session) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return <ForbiddenPage attemptedPath={location.pathname} />;
  }

  return <Outlet />;
};
