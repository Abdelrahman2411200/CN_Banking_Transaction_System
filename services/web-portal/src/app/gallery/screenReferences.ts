export type ScreenTheme = "light" | "dark";
export type ScreenFamily =
  | "authentication"
  | "dashboard"
  | "accounts"
  | "transfers"
  | "ledger"
  | "fraud"
  | "notifications"
  | "observability"
  | "platform-health";
export type ReferenceLifecycle = "active-reference" | "archival-reference";

export interface ScreenReference {
  folder: string;
  codePath: string;
  screenshotPath: string;
  theme: ScreenTheme;
  screenFamily: ScreenFamily;
  patternsUsed: string[];
}

export interface ScreenFamilyVariantChoice {
  screenFamily: ScreenFamily;
  selectedVariant: string;
  supportingVariants: string[];
  routeScope: string;
  rationale: string;
  reactSource: string;
  lifecycle: ReferenceLifecycle;
}

const root = "stitch_remix_of_cn_banking_react_portal/stitch_remix_of_cn_banking_react_portal";

export const staticReferenceFolders = [
  "authentication",
  "authentication_dark",
  "customer_dashboard_1",
  "customer_dashboard_2",
  "customer_dashboard_dark",
  "account_management_1",
  "account_management_2",
  "account_management_dark",
  "transfers_1",
  "transfers_2",
  "transfers_dark",
  "financial_ledger_1",
  "financial_ledger_2",
  "financial_ledger_dark",
  "fraud_monitoring_1",
  "fraud_monitoring_2",
  "fraud_monitoring_dark",
  "notification_center_1",
  "notification_center_2",
  "notification_center_dark",
  "observability_dashboard_1",
  "observability_dashboard_2",
  "platform_health_1",
  "platform_health_2",
  "platform_health_dark"
] as const;

export const canonicalScreenReferences: ScreenReference[] = [
  {
    folder: "authentication",
    codePath: `${root}/authentication/code.html`,
    screenshotPath: `${root}/authentication/screen.png`,
    theme: "light",
    screenFamily: "authentication",
    patternsUsed: ["brand lockup", "form controls", "warning banner", "primary action"]
  },
  {
    folder: "authentication_dark",
    codePath: `${root}/authentication_dark/code.html`,
    screenshotPath: `${root}/authentication_dark/screen.png`,
    theme: "dark",
    screenFamily: "authentication",
    patternsUsed: ["dark theme", "form controls", "semantic alerts", "primary action"]
  },
  {
    folder: "account_management_1",
    codePath: `${root}/account_management_1/code.html`,
    screenshotPath: `${root}/account_management_1/screen.png`,
    theme: "light",
    screenFamily: "accounts",
    patternsUsed: ["Banking Ops shell", "account form", "metric cards", "action buttons"]
  },
  {
    folder: "account_management_dark",
    codePath: `${root}/account_management_dark/code.html`,
    screenshotPath: `${root}/account_management_dark/screen.png`,
    theme: "dark",
    screenFamily: "accounts",
    patternsUsed: ["dark Banking Ops shell", "account form", "status chips", "action buttons"]
  }
];

export const screenFamilyVariantChoices: ScreenFamilyVariantChoice[] = [
  {
    screenFamily: "authentication",
    selectedVariant: "authentication",
    supportingVariants: ["authentication_dark"],
    routeScope: "/login, /register",
    rationale: "The light export carries the clearest form hierarchy; dark is absorbed through shared theme tokens.",
    reactSource: "src/app/auth/AuthPages.tsx",
    lifecycle: "active-reference"
  },
  {
    screenFamily: "dashboard",
    selectedVariant: "customer_dashboard_1",
    supportingVariants: ["customer_dashboard_2", "customer_dashboard_dark"],
    routeScope: "/dashboard",
    rationale: "Variant 1 provides the strongest operational overview and quick-action density.",
    reactSource: "src/app/dashboard/DashboardPage.tsx",
    lifecycle: "active-reference"
  },
  {
    screenFamily: "accounts",
    selectedVariant: "account_management_1",
    supportingVariants: ["account_management_2", "account_management_dark"],
    routeScope: "/accounts, /accounts/:id",
    rationale: "Variant 1 best matches the Banking Ops shell and form/action balance already recreated in React.",
    reactSource: "src/app/accounts/AccountManagementPage.tsx",
    lifecycle: "active-reference"
  },
  {
    screenFamily: "transfers",
    selectedVariant: "transfers_1",
    supportingVariants: ["transfers_2", "transfers_dark"],
    routeScope: "/transfers, /transfers/:id",
    rationale: "Variant 1 centers initiation and saga status without over-indexing on decorative panels.",
    reactSource: "src/app/transfers/TransferOperationsPage.tsx",
    lifecycle: "active-reference"
  },
  {
    screenFamily: "ledger",
    selectedVariant: "financial_ledger_1",
    supportingVariants: ["financial_ledger_2", "financial_ledger_dark"],
    routeScope: "/ledger, /ledger/transfers/:transferId",
    rationale: "Variant 1 keeps audit lookup, immutable language, and transaction rows left aligned.",
    reactSource: "src/app/ledger/FinancialLedgerPage.tsx",
    lifecycle: "active-reference"
  },
  {
    screenFamily: "fraud",
    selectedVariant: "fraud_monitoring_1",
    supportingVariants: ["fraud_monitoring_2", "fraud_monitoring_dark"],
    routeScope: "/fraud, /fraud/alerts/:alertId",
    rationale: "Variant 1 gives severity triage priority while preserving semantic color restraint.",
    reactSource: "src/app/fraud/FraudMonitoringPage.tsx",
    lifecycle: "active-reference"
  },
  {
    screenFamily: "notifications",
    selectedVariant: "notification_center_1",
    supportingVariants: ["notification_center_2", "notification_center_dark"],
    routeScope: "/notifications",
    rationale: "Variant 1 maps directly to a gateway-backed notification timeline.",
    reactSource: "src/app/notifications/NotificationCenterPage.tsx",
    lifecycle: "active-reference"
  },
  {
    screenFamily: "observability",
    selectedVariant: "observability_dashboard_1",
    supportingVariants: ["observability_dashboard_2"],
    routeScope: "/observability",
    rationale: "Variant 1 favors summarized health over raw metrics exposure.",
    reactSource: "src/app/observability/ObservabilityDashboardPage.tsx",
    lifecycle: "active-reference"
  },
  {
    screenFamily: "platform-health",
    selectedVariant: "platform_health_1",
    supportingVariants: ["platform_health_2", "platform_health_dark"],
    routeScope: "/platform-health",
    rationale: "Variant 1 keeps readiness data structured and avoids presenting unsupported platform data as live.",
    reactSource: "src/app/platform/PlatformHealthPage.tsx",
    lifecycle: "active-reference"
  }
];
