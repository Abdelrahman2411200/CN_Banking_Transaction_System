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
  }
];
