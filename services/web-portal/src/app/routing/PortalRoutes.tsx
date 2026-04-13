import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { DesignSystemGallery } from "../gallery/DesignSystemGallery";
import { LoginPage, NotFoundPage, RegisterPage, RoutePage } from "./RoutePages";
import { PortalLayout } from "./PortalLayout";
import { ProtectedRoute, type SessionReader } from "./ProtectedRoute";
import { adminOperatorRoutes, customerOperatorRoutes } from "./routeConfig";

export interface PortalRoutesProps {
  getSession?: SessionReader;
}

export const PortalRoutes = ({ getSession }: PortalRoutesProps): ReactElement => (
  <Routes>
    <Route element={<LoginPage />} path="/login" />
    <Route element={<RegisterPage />} path="/register" />
    <Route element={<DesignSystemGallery />} path="/design-system" />
    <Route element={<Navigate replace to="/dashboard" />} path="/" />
    <Route element={<ProtectedRoute getSession={getSession} />}>
      <Route element={<PortalLayout getSession={getSession} />}>
        {customerOperatorRoutes.map((route) => (
          <Route element={<RoutePage route={route} />} key={route.path} path={route.path} />
        ))}
        <Route element={<ProtectedRoute allowedRoles={["operator", "admin"]} getSession={getSession} />}>
          {adminOperatorRoutes.map((route) => (
            <Route element={<RoutePage route={route} />} key={route.path} path={route.path} />
          ))}
        </Route>
      </Route>
    </Route>
    <Route element={<NotFoundPage />} path="*" />
  </Routes>
);
