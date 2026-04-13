# Contract: Primitive Components

## Purpose

Define the expected API and behavior for Phase 1 shared primitives. Exact prop names may follow local React conventions, but the behaviors below are mandatory.

## Required Primitives

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

## Shared Requirements

- Components must render in light and dark mode from the same implementation.
- Components must accept a `className` escape hatch for composition without requiring page-local token definitions.
- Interactive components must support disabled state.
- Interactive components must expose a visible focus state.
- Loading states must not change the component's outer dimensions unless the caller explicitly changes layout.
- Components must not import or duplicate static `code.html` Tailwind configuration.

## Variant Requirements

### Button

Required variants:

- `primary`: `primary` background and `on-primary` text.
- `secondary`: transparent or tonal background with ghost border where needed.
- `tertiary`: text-only interactive action using the info/tertiary semantic token.
- `danger`: destructive action using the error semantic group.

Required states:

- `default`
- `hover`
- `focus`
- `active`
- `disabled`
- `loading`

### IconButton

Rules:

- Must require or derive an accessible name.
- Must preserve stable square dimensions across icon changes.
- Must work with Material Symbols icons used by the static exports.

### Input And Select

Rules:

- Background should default to `surface-container-lowest`.
- Ghost border may be used for field affordance.
- Active state transitions to the primary token.
- Error state uses the error semantic group and exposes an accessible error message.

### StatusChip

Required statuses:

- `success`
- `warning`
- `error`
- `info`
- `neutral`
- `unknown`

Rules:

- Chips are metadata, not buttons, unless explicitly rendered as interactive.
- Container should use a semantic container token or derived opacity token.
- Text must remain readable in both themes.

### MetricCard

Rules:

- Supports label, value, optional delta, optional status, and optional icon.
- Keeps value text within the card at mobile and desktop widths.
- Uses tonal stacking instead of heavy shadows.

### DataTable

Rules:

- Rows use spacing and tonal shift instead of divider lines.
- Hover/focus state may transition to `surface-variant`.
- Supports empty, loading, and error states.
- Must not shift column layout when loading or empty content appears.

### Dialog And Toast

Rules:

- Floating surfaces may use ambient shadows.
- Dialog must trap focus and provide an accessible title.
- Toast must expose status semantics and avoid blocking core interactions.

## Acceptance

The primitive contract is satisfied when all required primitives are exported from a shared module, render in a reference gallery, and are covered by focused typecheck and test coverage.
