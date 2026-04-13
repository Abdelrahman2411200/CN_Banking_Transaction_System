# Contract: Visual Parity Baseline

## Purpose

Define how Phase 1 verifies that the React design-system primitives remain faithful to the Vault Protocol and the provided static screen exports.

## Required References

Phase 1 must use these canonical static-export references:

- `authentication`
- `authentication_dark`
- `account_management_1`
- `account_management_dark`

## Review Dimensions

Reviewers should compare:

- token names and rendered colors;
- typography scale and weight;
- surface layering and tonal nesting;
- button variants;
- input affordance and focus state;
- status chip semantics;
- table/list row separation;
- layout stability at responsive widths;
- icon usage and sizing;
- light/dark theme parity.

## Decision Categories

Each visual difference must be recorded as:

- `accept`: React implementation should match the export.
- `adapt`: React implementation should preserve intent but change details to follow Vault Protocol or accessibility.
- `reject`: React implementation should not carry the static-export pattern forward.

## Required Deviations

The following deviations are expected when static exports conflict with Vault Protocol or frontend guidance:

- Replace repeated per-screen Tailwind config blocks with shared theme tokens.
- Replace decorative or excessive borders with tonal shifts and spacing.
- Load Material Symbols once rather than duplicating font links per page.
- Avoid one-off layout styles that make dynamic content overflow.
- Use a shared theme mechanism instead of separate dark screen implementations.

## Acceptance

The visual parity baseline is accepted when a reference route or component gallery demonstrates the chosen primitives in light and dark mode, documented parity decisions explain any meaningful difference from the static exports, and a manual reviewer accepts the gallery. Automated screenshot or pixel-diff checks are optional follow-up work for Phase 1.
