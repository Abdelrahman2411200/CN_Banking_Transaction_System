# Phase 16 Static Export Migration Checklist

Source of truth: `stitch_remix_of_cn_banking_react_portal/stitch_remix_of_cn_banking_react_portal/FRONTEND_IMPLEMENTATION_PLAN.md` and `stitch_remix_of_cn_banking_react_portal/stitch_remix_of_cn_banking_react_portal/vault_protocol/DESIGN.md`.

## Migration Rules

- Preserve every original `code.html` and `screen.png` file until React parity is accepted.
- Treat static `code.html` files as visual references only; behavior, routing, state, and gateway integration live in `services/web-portal/src`.
- Keep the Sovereign Ledger system in React tokens and components: Inter typography, tonal surface hierarchy, no decorative divider lines, restrained shadows, semantic status colors, left-aligned operational layouts, and light/dark theme support.
- Route all browser data access through the gateway API client. Do not call internal services directly from React.
- After reviewer acceptance, static exports become archival references and React components become the implementation source of truth.

## Chosen Static Variants

| Screen family | Chosen variant | Supporting variants | React source |
| --- | --- | --- | --- |
| Authentication | `authentication` | `authentication_dark` | `src/app/auth/AuthPages.tsx` |
| Dashboard | `customer_dashboard_1` | `customer_dashboard_2`, `customer_dashboard_dark` | `src/app/dashboard/DashboardPage.tsx` |
| Accounts | `account_management_1` | `account_management_2`, `account_management_dark` | `src/app/accounts/AccountManagementPage.tsx` |
| Transfers | `transfers_1` | `transfers_2`, `transfers_dark` | `src/app/transfers/TransferOperationsPage.tsx` |
| Ledger | `financial_ledger_1` | `financial_ledger_2`, `financial_ledger_dark` | `src/app/ledger/FinancialLedgerPage.tsx` |
| Fraud | `fraud_monitoring_1` | `fraud_monitoring_2`, `fraud_monitoring_dark` | `src/app/fraud/FraudMonitoringPage.tsx` |
| Notifications | `notification_center_1` | `notification_center_2`, `notification_center_dark` | `src/app/notifications/NotificationCenterPage.tsx` |
| Observability | `observability_dashboard_1` | `observability_dashboard_2` | `src/app/observability/ObservabilityDashboardPage.tsx` |
| Platform health | `platform_health_1` | `platform_health_2`, `platform_health_dark` | `src/app/platform/PlatformHealthPage.tsx` |

The same choices are encoded in `src/app/gallery/screenReferences.ts` so tests and the design gallery can surface drift.

## Acceptance Checklist

- [x] All static `code.html` and `screen.png` files remain in place as design references.
- [x] Each screen family has one selected static variant recorded beside the portal source.
- [x] Shared migration decisions are represented in React design-system metadata.
- [x] The design gallery surfaces Phase 16 variant choices and parity decisions.
- [x] Gateway-only integration remains the documented browser API boundary.
- [ ] Reviewer has accepted React visual parity for every screen family.
- [ ] Static exports have been relabeled as archival references after acceptance.

## Current Status

React is the implementation source for behavior and gateway integration. Static exports remain active visual references until reviewer parity acceptance is recorded, then their lifecycle can move to archival reference.