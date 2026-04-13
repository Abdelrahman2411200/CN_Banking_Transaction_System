# Contract: Design Tokens

## Purpose

Define the shared token contract for the Phase 1 React portal design system. Tokens must translate the Vault Protocol and static screen exports into a central source of truth.

## Token Categories

### Surface Tokens

Required tokens:

- `surface`
- `surface-bright`
- `surface-dim`
- `surface-container-lowest`
- `surface-container-low`
- `surface-container`
- `surface-container-high`
- `surface-container-highest`
- `surface-variant`

Rules:

- App backgrounds use `surface`.
- Sidebar and secondary navigation zones use `surface-container-low`.
- Focus/workspace areas use `surface-container-highest` or the nearest approved tonal layer.
- Actual data cards and paper-like transaction areas use `surface-container-lowest`.
- Hard divider lines are not the default separation mechanism.

### Semantic Color Tokens

Required semantic groups:

- `primary`
- `secondary`
- `tertiary`
- `error`
- `success`
- `warning`
- `info`
- `neutral`
- `outline`
- `outline-variant`

Rules:

- `error` is reserved for failed validation or critical alerts.
- `warning` is reserved for pending approval or risk flags.
- `success` is reserved for completed transactions and healthy states.
- `info` maps to system notifications and neutral data links; this may use `tertiary`.
- `outline-variant` may be used as a ghost border at low opacity when accessibility or form affordance requires it.

### Typography Tokens

Required families/scales:

- `font-body`: Inter
- `font-heading`: Inter
- `display-lg`, `display-md`, `display-sm`
- `headline-lg`, `headline-md`, `headline-sm`
- `title-lg`, `title-md`, `title-sm`
- `body-lg`, `body-md`, `body-sm`
- `label-md`, `label-sm`

Rules:

- Use display styles only for high-level dashboard summaries.
- Use `headline-sm` for major section headers unless a screen-specific composition requires a larger hierarchy.
- Use `body-md` as the default data entry and description size.
- Use label styles for metadata, timestamps, and compact table annotations.

### Radius And Shadow Tokens

Required radius tokens:

- `radius-sm`
- `radius-md`
- `radius-lg`
- `radius-pill`

Rules:

- Buttons and cards should stay within the restrained radius language of the static exports.
- Status chips may use `radius-pill`.
- Floating surfaces may use larger but still restrained radius only when needed.

Shadow rules:

- Static layout regions should rely on tonal stacking, not shadows.
- Floating elements such as dialogs, menus, and tooltips may use ambient shadows.
- Shadow color must not be pure black; use a tinted surface/on-surface value.

## Noncompliance

A component or screen is noncompliant if it:

- defines a private copy of the full screen export Tailwind color map;
- uses unrelated decorative gradients or one-off brand colors;
- uses hard borders as the primary layout separator;
- implements light and dark as separate components instead of a theme-mode variant;
- uses 100% black where `on-surface` or an approved high-contrast token should be used.
