# CN Banking React Portal Frontend Implementation Plan

**Created:** 2026-04-13  
**Source screen folder:** `stitch_remix_of_cn_banking_react_portal/stitch_remix_of_cn_banking_react_portal`  
**Design north star:** `vault_protocol/DESIGN.md`, "The Sovereign Ledger" / "Architectural Precision"  
**Backend target:** existing API gateway on `/health`, `/metrics`, `/v1/auth`, `/v1/accounts`, `/v1/transfers`, `/v1/ledger`, `/v1/fraud`, and `/v1/notifications`

## Current Frontend Assets

The folder contains static Tailwind HTML exports and screenshots for the portal, with multiple visual variants per product area:

| Product area | Source folders | Intended route |
| --- | --- | --- |
| Authentication | `authentication`, `authentication_dark` | `/login`, `/register` |
| Customer dashboard | `customer_dashboard_1`, `customer_dashboard_2`, `customer_dashboard_dark` | `/dashboard` |
| Account management | `account_management_1`, `account_management_2`, `account_management_dark` | `/accounts` and `/accounts/:id` |
| Transfers | `transfers_1`, `transfers_2`, `transfers_dark` | `/transfers` and `/transfers/:id` |
| Financial ledger | `financial_ledger_1`, `financial_ledger_2`, `financial_ledger_dark` | `/ledger` and `/ledger/transfers/:transferId` |
| Fraud monitoring | `fraud_monitoring_1`, `fraud_monitoring_2`, `fraud_monitoring_dark` | `/fraud` and `/fraud/alerts/:alertId` |
| Notification center | `notification_center_1`, `notification_center_2`, `notification_center_dark` | `/notifications` |
| Observability dashboard | `observability_dashboard_1`, `observability_dashboard_2` | `/observability` |
| Platform health | `platform_health_1`, `platform_health_2`, `platform_health_dark` | `/platform-health` |
| Design system | `vault_protocol/DESIGN.md` | shared design reference |

The repository does not currently define a React frontend workspace in the root `package.json`; it is focused on service workspaces under `shared/*` and `services/*`. The plan therefore starts by creating the frontend workspace before porting the screens.

## Frontend Product Goal

Build a production-ready React portal for CN Banking operators and customers that converts the static screen exports into a typed, routed, tested application connected to the existing banking API gateway. The portal should preserve the Sovereign Ledger visual direction while replacing duplicated static HTML with reusable components, shared tokens, and API-driven state.

## Non-Negotiables

- Keep design consistent with `vault_protocol/DESIGN.md`: Inter typography, tonal surface hierarchy, restrained shadows, semantic status color, and data-first layouts.
- Use the static HTML screens as visual references, not as a final architecture. Extract reusable React components and data models.
- Support both light and dark variants through a theme system instead of separate page implementations.
- Treat authenticated and admin-only surfaces as separate route concerns.
- Use the gateway as the browser-facing API boundary; do not call internal services directly from the frontend.
- Keep secrets out of the frontend bundle. Only expose safe public runtime config such as the gateway base URL.
- Add tests and visual checks as each screen becomes functional.

## Recommended Stack

- React 19 or React 18 with TypeScript.
- Vite for the portal app unless a server-rendered requirement appears later.
- React Router for route-level navigation and protected route guards.
- TanStack Query for server state, caching, refetching, retries, and loading/error states.
- React Hook Form plus Zod for form state and validation.
- Tailwind CSS with project tokens extracted from the screen exports and design spec.
- Material Symbols for icon parity with the static screens, preferably loaded once at the app shell level.
- MSW for frontend API mocks and contract-driven screen tests.
- Vitest and Testing Library for unit/component tests.
- Playwright for end-to-end flows and screenshot regression checks.

## Phase 0: Frontend Workspace Setup

**Goal:** create the React portal foundation without disturbing the existing service workspaces.

- Add a new workspace, for example `services/web-portal` or `apps/web-portal`, and include it in root `package.json` workspaces.
- Scaffold Vite + React + TypeScript.
- Add scripts for `dev`, `build`, `lint`, `typecheck`, `test`, and `test:e2e`.
- Configure ESLint, TypeScript, Tailwind, PostCSS, and path aliases.
- Add `.env.example` entries for frontend-safe configuration:
  - `VITE_API_BASE_URL=http://localhost:8080`
  - `VITE_APP_ENV=local`
- Add a Dockerfile for the portal only after the local app build is stable.
- Decide whether local Compose should serve the portal in dev or whether developers should run it with `npm run dev -w <portal-workspace>`.

**Exit criteria:**

- Portal starts locally.
- Empty route renders.
- `npm run lint`, `npm run typecheck`, and portal build pass for the new workspace.

## Phase 1: Design System Extraction

**Goal:** turn repeated screen-level Tailwind config into shared tokens and primitives.

**Clarified Phase 1 scope:** this phase may create the minimal `services/web-portal` workspace if it does not already exist. The required visual parity gate is manual reviewer acceptance of the reference gallery, using `authentication`, `authentication_dark`, `account_management_1`, and `account_management_dark` as canonical static references. It also includes a typed frontend API client foundation and a real gateway `GET /health` probe, while full banking business endpoint integration remains out of scope.

- Extract color tokens from the exported screens into `tailwind.config.ts`.
- Encode semantic tokens for surface, primary, secondary, tertiary, error, warning, success, and outline states.
- Add typography tokens for display, headline, title, body, and label scales.
- Add radius tokens capped to the existing screen language.
- Create theme support using a root `light` / `dark` class.
- Create shared primitives:
  - `Button`
  - `IconButton`
  - `Input`
  - `Select`
  - `StatusChip`
  - `MetricCard`
  - `DataTable`
  - `EmptyState`
  - `Skeleton`
  - `Toast`
  - `Dialog`
- Create layout primitives:
  - `AppShell`
  - `Sidebar`
  - `TopBar`
  - `MobileNav`
  - `PageHeader`
  - `ContentGrid`

**Exit criteria:**

- Tokens are centralized.
- At least one light and one dark reference page can be recreated from shared primitives.
- No page owns a private copy of the old Tailwind color map.

## Phase 2: App Shell And Routing

**Goal:** build the portal skeleton shared by all authenticated screens.

- Define route groups:
  - Public: `/login`, `/register`
  - Customer/operator: `/dashboard`, `/accounts`, `/accounts/:id`, `/transfers`, `/transfers/:id`, `/ledger`, `/ledger/transfers/:transferId`
  - Admin/operator: `/fraud`, `/fraud/alerts/:alertId`, `/notifications`, `/observability`, `/platform-health`
- Implement protected route guards based on JWT presence and role claim.
- Add sidebar navigation with active route state:
  - Dashboard
  - Accounts
  - Transfers
  - Ledger
  - Fraud
  - Notifications
  - Observability
  - Platform Health
- Add responsive behavior for mobile and tablet.
- Add global error boundary and not-found page.

**Exit criteria:**

- All planned routes exist and navigate.
- Admin-only routes are hidden or blocked for non-admin users.
- App shell is responsive and layout-stable.

## Phase 3: API Client And Auth Session

**Goal:** connect the frontend to the API gateway safely and predictably.

- Create a typed API client around the gateway base URL.
- Implement auth endpoints:
  - `POST /v1/auth/register`
  - `POST /v1/auth/login`
  - `POST /v1/auth/refresh`
  - `POST /v1/auth/logout`
- Store the access token in memory where feasible and keep refresh handling deliberately scoped.
- Add authorization header injection.
- Add refresh-on-401 behavior with loop protection.
- Normalize gateway/service errors:
  - `invalid_credentials`
  - `forbidden`
  - `not_found`
  - rate-limited responses
  - service degradation from `/health`
- Add request ID display or logging support if the gateway returns one.

**Exit criteria:**

- Login, refresh, logout, and protected route restoration work locally.
- Auth errors match the existing authentication screen states.
- No secret values are bundled.

## Phase 4: Authentication Screens

**Goal:** port `authentication` and `authentication_dark` into functional React flows.

- Build login form with email/password validation.
- Build registration form with role selection where appropriate for local/admin setup.
- Add screen states already represented by the mockup:
  - invalid credentials
  - rate limit / 429 waiting message
  - service unavailable
  - loading submission
- Add password visibility toggle and accessible field errors.
- Add redirect after login based on role.
- Add logout behavior from the app shell.

**Exit criteria:**

- User can register, log in, refresh session, and log out through the gateway.
- Authentication screens match the source screenshots at desktop and mobile widths.
- Unit/component tests cover success and failure states.

## Phase 5: Dashboard And Overview

**Goal:** port `customer_dashboard_*` into the main landing surface after login.

- Create dashboard data model from available APIs:
  - account summaries from `/v1/accounts`
  - recent transfers from `/v1/transfers`
  - service state from `/health`
  - ledger summary where available from `/v1/ledger/stats/:accountId`
- Add fallback mock adapters if a list endpoint is missing or returns only single-resource views.
- Build metric cards, recent transaction timeline, service status, and quick actions.
- Add role-aware content:
  - customer: own accounts, recent transfer activity
  - admin/operator: system overview and operational alerts

**Exit criteria:**

- Dashboard renders from API data or documented mock fallbacks.
- Empty, loading, error, and degraded-health states are visible.
- Route is covered by Playwright smoke test.

## Phase 6: Account Management

**Goal:** port `account_management_*` into account creation, lookup, KYC, balance, and freeze flows.

- Implement account endpoints:
  - `POST /v1/accounts`
  - `GET /v1/accounts/:id`
  - `GET /v1/accounts/:id/balance`
  - `PATCH /v1/accounts/:id/kyc`
  - `POST /v1/accounts/:id/freeze`
- Build account creation form with name, email, and initial balance.
- Build account search/lookup by account ID.
- Build account detail panel showing balance, status, KYC status, created/updated timestamps.
- Add admin/operator actions for KYC and freeze.
- Add optimistic UI only for safe actions; otherwise refetch after mutations.

**Exit criteria:**

- Create, lookup, KYC update, balance view, and freeze flows are functional.
- Form validation matches shared money/email/account constraints.
- Tests cover the main mutation flows and error messages.

## Phase 7: Transfer Operations

**Goal:** port `transfers_*` into transfer initiation and saga monitoring.

- Implement transfer endpoints:
  - `POST /v1/transfers`
  - `GET /v1/transfers/:id`
- Generate and send an `Idempotency-Key` for `POST /v1/transfers`.
- Build transfer form:
  - from account ID
  - to account ID
  - amount
- Add validation for positive money and different account IDs.
- Build transfer status detail:
  - initiated
  - completed
  - failed
  - compensating
  - compensation failed
- Add saga state visualization from the transfer response.
- Add retry/copy transfer ID affordances.

**Exit criteria:**

- Transfers can be initiated through the gateway.
- Saga state is visible and refreshable.
- Duplicate submit protection is tested.

## Phase 8: Financial Ledger

**Goal:** port `financial_ledger_*` into an audit and ledger lookup surface.

- Implement ledger endpoints:
  - `GET /v1/ledger/:accountId`
  - `GET /v1/ledger/transfer/:transferId`
  - `GET /v1/ledger/stats/:accountId`
- Build account ledger view with entries grouped by time.
- Build transfer ID lookup.
- Build stats cards for debits, credits, net balance movement, and entry count.
- Add immutable/audit language in UI copy without overclaiming cryptographic guarantees unless backend supports it.
- Add export affordance as a later enhancement unless the backend has an export endpoint.

**Exit criteria:**

- Ledger pages render account and transfer audit data.
- Admin-only stats behavior is handled gracefully for forbidden users.
- Tests cover empty ledger, forbidden stats, and lookup failure.

## Phase 9: Fraud Monitoring

**Goal:** port `fraud_monitoring_*` into the admin fraud operations surface.

- Implement fraud endpoints:
  - `GET /v1/fraud/alerts`
  - `GET /v1/fraud/alerts/:alertId`
  - `GET /v1/fraud/stats`
- Build fraud KPI strip:
  - total alerts
  - severity mix
  - high/critical count
  - recent alert activity
- Build alert table with severity chips and transfer/account references.
- Build alert detail drawer or page.
- Add filters for severity, account ID, transfer ID, and date range if API support exists; otherwise filter client-side for the currently loaded page only.
- Add admin route protection.

**Exit criteria:**

- Fraud alert list and detail view render from API data.
- Admin-only errors are handled explicitly.
- Severity coloring is accessible in light and dark themes.

## Phase 10: Notification Center

**Goal:** port `notification_center_*` into an admin notification timeline.

- Implement notification endpoint:
  - `GET /v1/notifications`
- Build live notification timeline from returned records.
- Add channel/status chips if present in backend data.
- Add empty state for no notifications.
- Add manual refresh.
- Defer creation/resend actions unless backend endpoints exist.

**Exit criteria:**

- Notification timeline renders and refreshes.
- Missing unsupported actions are documented instead of faked.
- Tests cover empty and populated states.

## Phase 11: Observability Dashboard

**Goal:** port `observability_dashboard_*` into a gateway-facing operational page.

- Use `/health` for service reachability.
- Use `/metrics` only if the browser-facing deployment allows it and the data exposure is acceptable.
- Prefer summarized health over raw Prometheus text in the default UI.
- Add service map for:
  - api-gateway
  - account-service
  - transfer-service
  - ledger-service
  - fraud-service
  - notification-service
- Add degraded/unreachable handling from the gateway health response.
- For logs/query UI shown in the static screen, either connect to a real log backend later or label it as future work in the implementation backlog.

**Exit criteria:**

- Health overview is live and refreshable.
- Metrics exposure decision is documented.
- The page does not leak sensitive operational detail to non-admin users.

## Phase 12: Platform Health

**Goal:** port `platform_health_*` into a deployment/runtime readiness surface.

- Use `/health` as the first live source.
- Add placeholders only for data not available from the current backend:
  - Kubernetes/EKS rollout state
  - CI/CD pipeline state
  - image vulnerability scan state
  - infrastructure status
- If live platform data is required, plan backend/admin gateway endpoints before wiring the UI.
- Keep this route admin-only.

**Exit criteria:**

- Service health portion is live.
- Unsupported platform cards are either removed or clearly tracked as future backend work.
- No fake production readiness data is displayed as live.

## Phase 13: Responsive, Accessibility, And Visual QA

**Goal:** make the portal usable beyond the desktop screenshots.

- Test key breakpoints:
  - 360px mobile
  - 768px tablet
  - 1024px small desktop
  - 1440px desktop
- Ensure text never overflows cards, nav items, tables, or form controls.
- Add keyboard navigation for app shell, dialogs, menus, filters, and forms.
- Add visible focus states that fit the design system.
- Add accessible names for icon-only buttons.
- Check color contrast for status chips in both themes.
- Add Playwright screenshot baselines for one representative route per product area.

**Exit criteria:**

- App is keyboard navigable.
- No major responsive overflow in core routes.
- Screenshot smoke tests cover all main screen families.

## Phase 14: Testing Strategy

**Goal:** make the portal safe to evolve.

- Unit tests:
  - token/session helpers
  - API client error normalization
  - Zod schemas and form transforms
- Component tests:
  - login/register forms
  - account creation
  - transfer initiation
  - data table states
  - status chip semantics
- MSW contract tests:
  - success responses
  - validation failures
  - forbidden admin routes
  - gateway degraded health
  - rate limit responses
- Playwright E2E:
  - login and logout
  - create account
  - initiate transfer
  - lookup ledger entry
  - admin fraud/notifications access
  - health dashboard renders
- Visual regression:
  - dashboard
  - accounts
  - transfers
  - ledger
  - fraud
  - notifications
  - platform health

**Exit criteria:**

- Portal test suite is included in root CI or a dedicated frontend CI job.
- Critical user flows have E2E coverage.
- Mock API fixtures are versioned with the portal.

## Phase 15: Build, Deployment, And Operations

**Goal:** deploy the portal consistently with the existing cloud deployment direction.

- Build static assets with Vite.
- Choose deployment target:
  - serve static build from Nginx container in Kubernetes
  - or deploy to S3/CloudFront if the infrastructure plan expands to frontend hosting
- Add frontend Dockerfile and Kubernetes manifests if using EKS.
- Add ingress route or host for the portal, separate from API if needed.
- Add content security policy compatible with Material Symbols and font loading, or self-host the font assets.
- Add runtime configuration strategy for API base URL.
- Add Trivy/image scan coverage for the portal image if containerized.
- Add cache headers for static assets.

**Exit criteria:**

- Production build is reproducible.
- Deployed portal can reach the API gateway through the intended public/internal route.
- CI/CD validates lint, typecheck, tests, build, and image scan.

## Phase 16: Cleanup And Migration From Static Exports

**Goal:** keep the static screen folder useful without letting it become the source of truth forever.

- Preserve original `code.html` and `screen.png` files as design references until React parity is accepted.
- Track which variant was chosen for each screen family.
- Move shared design decisions into the React app tokens/components.
- Add a parity checklist beside the portal source or in this plan.
- Once the React implementation is accepted, mark the static exports as archival references.

**Exit criteria:**

- React components are the implementation source of truth.
- Static exports are no longer needed to understand behavior.
- Remaining design deltas are documented as intentional.

## Suggested Build Order

1. Workspace setup.
2. Design tokens and app shell.
3. Auth and session management.
4. Dashboard skeleton.
5. Accounts.
6. Transfers.
7. Ledger.
8. Fraud.
9. Notifications.
10. Observability.
11. Platform health.
12. Responsive/a11y pass.
13. E2E and visual regression.
14. Deployment packaging.

## Backend Gaps To Confirm During Implementation

- Whether list endpoints exist for accounts and transfers; current shared contracts strongly identify single-resource account/transfer operations.
- Whether `/metrics` should be browser-accessible in production.
- Whether platform health should show real Kubernetes/CI/CD data, which likely requires additional admin backend endpoints.
- Whether notifications support actions such as resend, mark read, or acknowledgement; current visible gateway route is read-only.
- Whether fraud alert filters are server-side or should be local-only for the first portal iteration.
- Whether customer self-service and admin/operator use the same app shell or need role-specific navigation.

## Definition Of Done For The Whole Frontend

- All screen families are implemented as routed React pages.
- Light and dark themes are supported from shared tokens.
- Auth, accounts, transfers, ledger, fraud, notifications, and health use the API gateway.
- Unsupported static-screen actions are either removed or backed by real backend work items.
- Responsive behavior is validated across mobile, tablet, and desktop.
- Accessibility basics are covered: labels, focus states, keyboard navigation, contrast, and error announcements.
- CI runs lint, typecheck, unit/component tests, E2E smoke tests, and production build.
- Deployment path is documented and verified against the chosen hosting target.
