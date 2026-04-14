import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AccountManagementPage, type AccountClient } from "../accounts/AccountManagementPage";
import { LoginPage, RegisterPage, type AuthClient } from "../auth/AuthPages";
import { DashboardPage, type DashboardClient } from "../dashboard/DashboardPage";
import { DesignSystemGallery } from "../gallery/DesignSystemGallery";
import { FinancialLedgerPage, type LedgerClient } from "../ledger/FinancialLedgerPage";
import { FraudMonitoringPage, type FraudClient } from "../fraud/FraudMonitoringPage";
import { TransferOperationsPage, type TransferClient } from "../transfers/TransferOperationsPage";
import { refreshAuthSession } from "../../lib/api/auth";
import { NotFoundPage, RoutePage } from "./RoutePages";
import { PortalLayout } from "./PortalLayout";
import { ProtectedRoute, type SessionReader, type SessionRefresher } from "./ProtectedRoute";
import { adminOperatorRoutes, customerOperatorRoutes } from "./routeConfig";

export interface PortalRoutesProps {
  accountClient?: AccountClient;
  authClient?: AuthClient;
  dashboardClient?: DashboardClient;
  fraudClient?: FraudClient;
  ledgerClient?: LedgerClient;
  transferClient?: TransferClient;
  getSession?: SessionReader;
  logoutSession?: () => Promise<unknown>;
  refreshSession?: SessionRefresher;
}

export const PortalRoutes = ({
  accountClient,
  authClient,
  dashboardClient,
  fraudClient,
  ledgerClient,
  transferClient,
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
                : route.path === "/accounts" || route.path === "/accounts/:id"
                  ? <AccountManagementPage accountClient={accountClient} getSession={getSession} />
                : route.path === "/transfers" || route.path === "/transfers/:id"
                  ? <TransferOperationsPage getSession={getSession} transferClient={transferClient} />
                : route.path === "/ledger" || route.path === "/ledger/transfers/:transferId"
                  ? <FinancialLedgerPage getSession={getSession} ledgerClient={ledgerClient} />
                : <RoutePage route={route} />
            }
            key={route.path}
            path={route.path}
          />
        ))}
        <Route element={<ProtectedRoute allowedRoles={["operator", "admin"]} getSession={getSession} refreshSession={refreshSession} />}>
          {adminOperatorRoutes.map((route) => (
            <Route
              element={<ProtectedRoute allowedRoles={route.allowedRoles} getSession={getSession} refreshSession={refreshSession} />}
              key={route.path}
            >
              <Route
                element={
                  route.path === "/fraud" || route.path === "/fraud/alerts/:alertId"
                    ? <FraudMonitoringPage fraudClient={fraudClient} getSession={getSession} />
                    : <RoutePage route={route} />
                }
                path={route.path}
              />
            </Route>
          ))}
        </Route>
      </Route>
    </Route>
    <Route element={<NotFoundPage />} path="*" />
  </Routes>
);
