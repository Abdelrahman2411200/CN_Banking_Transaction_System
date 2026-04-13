import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage, RegisterPage, type AuthClient } from "../auth/AuthPages";
import { DashboardPage, type DashboardClient } from "../dashboard/DashboardPage";
import { DesignSystemGallery } from "../gallery/DesignSystemGallery";
import { refreshAuthSession } from "../../lib/api/auth";
import { NotFoundPage, RoutePage } from "./RoutePages";
import { PortalLayout } from "./PortalLayout";
import { ProtectedRoute, type SessionReader, type SessionRefresher } from "./ProtectedRoute";
import { adminOperatorRoutes, customerOperatorRoutes } from "./routeConfig";

export interface PortalRoutesProps {
  authClient?: AuthClient;
  dashboardClient?: DashboardClient;
  getSession?: SessionReader;
  logoutSession?: () => Promise<unknown>;
  refreshSession?: SessionRefresher;
}

export const PortalRoutes = ({
  authClient,
  dashboardClient,
  getSession,
  logoutSession,
  refreshSession = refreshAuthSession
}: PortalRoutesProps): ReactElement => (
  <Routes>
    <Route element={<LoginPage authClient={authClient} />} path="/login" />
    <Route element={<RegisterPage authClient={authClient} />} path="/register" />
    <Route element={<DesignSystemGallery />} path="/design-system" />
    <Route element={<Navigate replace to="/dashboard" />} path="/" />
    <Route element={<ProtectedRoute getSession={getSession} refreshSession={refreshSession} />}>
      <Route element={<PortalLayout getSession={getSession} logoutSession={logoutSession} />}>
        {customerOperatorRoutes.map((route) => (
          <Route
            element={
              route.path === "/dashboard"
                ? <DashboardPage dashboardClient={dashboardClient} getSession={getSession} />
                : <RoutePage route={route} />
            }
            key={route.path}
            path={route.path}
          />
        ))}
        <Route element={<ProtectedRoute allowedRoles={["operator", "admin"]} getSession={getSession} refreshSession={refreshSession} />}>
          {adminOperatorRoutes.map((route) => (
            <Route element={<RoutePage route={route} />} key={route.path} path={route.path} />
          ))}
        </Route>
      </Route>
    </Route>
    <Route element={<NotFoundPage />} path="*" />
  </Routes>
);
