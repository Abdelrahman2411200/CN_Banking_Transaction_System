export type ParityDecisionType = "accept" | "adapt" | "reject";

export interface ParityDecision {
  reference: string;
  pattern: string;
  decision: ParityDecisionType;
  reason: string;
  replacement?: string;
}

export const parityDecisions: ParityDecision[] = [
  {
    reference: "vault_protocol/DESIGN.md",
    pattern: "Repeated Tailwind config blocks",
    decision: "adapt",
    reason: "The React portal needs one theme source of truth.",
    replacement: "Shared Tailwind tokens and CSS custom properties"
  },
  {
    reference: "account_management_1",
    pattern: "Explicit section borders",
    decision: "adapt",
    reason: "Vault Protocol prefers tonal shifts and spacing over hard separators.",
    replacement: "Ghost borders only for form affordance and focus"
  },
  {
    reference: "authentication",
    pattern: "Primary authentication action",
    decision: "accept",
    reason: "The primary action maps cleanly to the shared Button primitive."
  },
  {
    reference: "authentication_dark",
    pattern: "Separate dark screen implementation",
    decision: "reject",
    reason: "Theme must switch through the root class with one component implementation.",
    replacement: "Shared light/dark theme token maps"
  },
  {
    reference: "all code.html exports",
    pattern: "Screen-local markup and Tailwind utility duplication",
    decision: "reject",
    reason: "React components are now the implementation source of truth for behavior, routing, state, and gateway access.",
    replacement: "services/web-portal/src app pages, layout components, primitives, and API modules"
  },
  {
    reference: "all screen.png exports",
    pattern: "Visual composition snapshots",
    decision: "accept",
    reason: "Screenshots remain useful for reviewer parity checks while React acceptance is pending.",
    replacement: "Phase 16 parity checklist records the acceptance state by screen family"
  },
  {
    reference: "customer_dashboard_*, transfers_*, ledger_*, fraud_*, notifications_*, observability_*, platform_health_*",
    pattern: "Multiple static variants per family",
    decision: "adapt",
    reason: "Each screen family needs one selected composition plus supporting variants for theme and interaction nuance.",
    replacement: "screenFamilyVariantChoices"
  }
];
