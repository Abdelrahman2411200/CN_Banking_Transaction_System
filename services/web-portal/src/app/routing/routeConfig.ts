import type { UserRole } from "../auth/session";

export type RouteGroup = "customer" | "admin";

export interface PortalRoute {
  path: string;
  label: string;
  icon: string;
  phase: string;
  group: RouteGroup;
  allowedRoles: UserRole[];
  accessLabel: string;
  sourceFamily: string;
  description: string;
  implementationNote: string;
  showInNav: boolean;
}

const customerOperatorRoles: UserRole[] = ["customer", "operator", "admin"];
const adminOperatorRoles: UserRole[] = ["operator", "admin"];
const adminOnlyRoles: UserRole[] = ["admin"];

export const publicRoutes = [
  { path: "/login", label: "Login" },
  { path: "/register", label: "Register" }
] as const;

export const customerOperatorRoutes: PortalRoute[] = [
  {
    path: "/dashboard",
    label: "Dashboard",
    icon: "dashboard",
    phase: "Customer Overview",
    group: "customer",
    allowedRoles: customerOperatorRoles,
    accessLabel: "Customer / operator",
    sourceFamily: "customer_dashboard_*",
    description: "Account summaries, recent transfers, service state, and role-aware quick actions.",
    implementationNote: "This route will connect to accounts, transfers, ledger stats, and health data in Phase 5.",
    showInNav: true
  },
  {
    path: "/accounts",
    label: "Accounts",
    icon: "account_balance",
    phase: "Account Management",
    group: "customer",
    allowedRoles: customerOperatorRoles,
    accessLabel: "Customer / operator",
    sourceFamily: "account_management_*",
    description: "Account creation, lookup, KYC, balance, and freeze workflows.",
    implementationNote: "This route will use the account gateway endpoints in Phase 6.",
    showInNav: true
  },
  {
    path: "/accounts/:id",
    label: "Account Detail",
    icon: "account_balance_wallet",
    phase: "Account Management",
    group: "customer",
    allowedRoles: customerOperatorRoles,
    accessLabel: "Customer / operator",
    sourceFamily: "account_management_*",
    description: "Account detail panel for status, KYC, and balance review.",
    implementationNote: "This route will resolve the account ID through the gateway in Phase 6.",
    showInNav: false
  },
  {
    path: "/transfers",
    label: "Transfers",
    icon: "swap_horiz",
    phase: "Transfer Operations",
    group: "customer",
    allowedRoles: customerOperatorRoles,
    accessLabel: "Customer / operator",
    sourceFamily: "transfers_*",
    description: "Transfer initiation, validation, idempotency, and saga monitoring.",
    implementationNote: "This route will wire transfer initiation and lookup in Phase 7.",
    showInNav: true
  },
  {
    path: "/transfers/:id",
    label: "Transfer Detail",
    icon: "receipt_long",
    phase: "Transfer Operations",
    group: "customer",
    allowedRoles: customerOperatorRoles,
    accessLabel: "Customer / operator",
    sourceFamily: "transfers_*",
    description: "Transfer status, saga state, and retry/copy affordances.",
    implementationNote: "This route will refresh transfer status from the gateway in Phase 7.",
    showInNav: false
  },
  {
    path: "/ledger",
    label: "Ledger",
    icon: "menu_book",
    phase: "Financial Ledger",
    group: "customer",
    allowedRoles: customerOperatorRoles,
    accessLabel: "Customer / operator",
    sourceFamily: "financial_ledger_*",
    description: "Ledger lookup, grouped entries, transfer audit lookup, and stats cards.",
    implementationNote: "This route will render account and transfer ledger data in Phase 8.",
    showInNav: true
  },
  {
    path: "/ledger/transfers/:transferId",
    label: "Transfer Ledger",
    icon: "fact_check",
    phase: "Financial Ledger",
    group: "customer",
    allowedRoles: customerOperatorRoles,
    accessLabel: "Customer / operator",
    sourceFamily: "financial_ledger_*",
    description: "Ledger view scoped to a single transfer identifier.",
    implementationNote: "This route will use the transfer ledger lookup endpoint in Phase 8.",
    showInNav: false
  }
];

export const adminOperatorRoutes: PortalRoute[] = [
  {
    path: "/fraud",
    label: "Fraud",
    icon: "policy",
    phase: "Fraud Monitoring",
    group: "admin",
    allowedRoles: adminOnlyRoles,
    accessLabel: "Admin",
    sourceFamily: "fraud_monitoring_*",
    description: "Fraud KPIs, alert table, severity status, and alert detail navigation.",
    implementationNote: "This route will connect to fraud alerts and stats in Phase 9.",
    showInNav: true
  },
  {
    path: "/fraud/alerts/:alertId",
    label: "Fraud Alert",
    icon: "gpp_maybe",
    phase: "Fraud Monitoring",
    group: "admin",
    allowedRoles: adminOnlyRoles,
    accessLabel: "Admin",
    sourceFamily: "fraud_monitoring_*",
    description: "Alert detail view for transfer and account references.",
    implementationNote: "This route will render fraud alert details in Phase 9.",
    showInNav: false
  },
  {
    path: "/notifications",
    label: "Notifications",
    icon: "notifications",
    phase: "Notification Center",
    group: "admin",
    allowedRoles: adminOnlyRoles,
    accessLabel: "Admin",
    sourceFamily: "notification_center_*",
    description: "Read-only notification timeline with refresh and empty states.",
    implementationNote: "This route will read notification records from the gateway in Phase 10.",
    showInNav: true
  },
  {
    path: "/observability",
    label: "Observability",
    icon: "monitoring",
    phase: "Observability Dashboard",
    group: "admin",
    allowedRoles: adminOperatorRoles,
    accessLabel: "Operator / admin",
    sourceFamily: "observability_dashboard_*",
    description: "Gateway-facing operational health and service reachability summary.",
    implementationNote: "This route will summarize health and metrics decisions in Phase 11.",
    showInNav: true
  },
  {
    path: "/platform-health",
    label: "Platform Health",
    icon: "health_and_safety",
    phase: "Platform Health",
    group: "admin",
    allowedRoles: adminOnlyRoles,
    accessLabel: "Admin",
    sourceFamily: "platform_health_*",
    description: "Runtime readiness surface backed only by live platform data where available.",
    implementationNote: "This route will keep unsupported deployment data out of the live UI in Phase 12.",
    showInNav: true
  }
];

export const protectedRoutes = [...customerOperatorRoutes, ...adminOperatorRoutes];
