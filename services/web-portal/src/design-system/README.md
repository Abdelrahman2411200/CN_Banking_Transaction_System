# Web Portal Design System

The Phase 1 design system extracts the Sovereign Ledger visual language from `vault_protocol/DESIGN.md` before consulting static screen exports.

## Sources

- `vault_protocol/DESIGN.md` is the canonical source for tonal layering, typography, no-line layout rules, status semantics, and component behavior.
- `authentication`, `authentication_dark`, `account_management_1`, and `account_management_dark` are the Phase 1 visual parity references.

## Intentional Adaptations

- Repeated per-screen Tailwind color maps are replaced by shared tokens.
- Hard section dividers are replaced by tonal shifts and spacing unless a ghost border is needed for field affordance or accessibility.
- Light and dark mode use one component implementation with root theme classes.
- Material Symbols are loaded once from the app shell during Phase 1.
