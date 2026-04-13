import type { ReactElement } from "react";
import { BrowserRouter } from "react-router-dom";
import { GlobalErrorBoundary } from "./routing/GlobalErrorBoundary";
import { PortalRoutes } from "./routing/PortalRoutes";

const App = (): ReactElement => (
  <GlobalErrorBoundary>
    <BrowserRouter>
      <PortalRoutes />
    </BrowserRouter>
  </GlobalErrorBoundary>
);

export default App;
