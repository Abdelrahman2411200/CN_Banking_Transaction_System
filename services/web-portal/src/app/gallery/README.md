# Reference Gallery Review

Phase 1 requires manual reviewer acceptance for the reference gallery.

## Canonical References

- `authentication`
- `authentication_dark`
- `account_management_1`
- `account_management_dark`

## Phase 16 Migration

Full static-export migration tracking now lives in `../../../PARITY_CHECKLIST.md` and `screenReferences.ts`.
The checklist records the selected static variant for every screen family, while `screenReferences.ts`
keeps the same data available to React tests and the design gallery.

Until reviewer acceptance, original `code.html` and `screen.png` files remain active visual references.
After acceptance, they should be marked archival and React components remain the implementation source of truth.

## Acceptance Checklist

- Light and dark themes use the same component implementations.
- Tokens are centralized through the design-system files.
- Authentication composition matches the exported form and alert intent.
- Account shell composition matches the Banking Ops shell, metrics, and action intent.
- Borders are adapted to tonal shifts or ghost borders where appropriate.
- Interactive primitives have labels, focus states, and keyboard behavior.
- Gateway health shows healthy, degraded, or unavailable states without blocking the gallery.
