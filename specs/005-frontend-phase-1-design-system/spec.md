# Feature Specification: Frontend Phase 1 Design System Extraction

**Feature Branch**: `005-frontend-phase-1-design-system`  
**Created**: 2026-04-13  
**Status**: Draft  
**Input**: User description: "make a plan for phase 1 implementation according to vault_protocol and FRONTEND_IMPLEMENTATION_PLAN.md"

## Clarifications

### Session 2026-04-13

- Q: Should Phase 1 include creation of a frontend workspace if it does not already exist? -> A: Phase 1 may create the minimal `services/web-portal` workspace needed for tokens, primitives, and gallery.
- Q: What visual parity gate should Phase 1 require? -> A: Manual reviewer acceptance only for the reference gallery.
- Q: Which static exports are canonical for Phase 1 parity? -> A: `authentication`, `authentication_dark`, `account_management_1`, and `account_management_dark`.
- Q: What accessibility bar should Phase 1 enforce? -> A: Component-level basics: labels, focus states, keyboard behavior for primitives, and readable semantic colors.
- Q: Should Phase 1 include runtime API integration? -> A: Include a real API client foundation and gateway `/health` call in Phase 1.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Shared Sovereign Ledger Tokens (Priority: P1)

As a frontend implementer, I need the visual rules from `vault_protocol/DESIGN.md` and the static screen exports captured as shared design tokens so every future React screen uses the same surfaces, semantic colors, typography, radius, and shadow rules.

**Why this priority**: Without centralized tokens, each screen port will copy its own Tailwind configuration and the portal will drift away from the Architectural Precision design system.

**Independent Test**: Inspect the portal Tailwind/theme configuration and verify that a light and dark sample surface, button, input, and status chip render using centralized tokens rather than page-local color definitions.

**Acceptance Scenarios**:

1. **Given** the Phase 1 design system is installed, **When** a developer creates a component, **Then** they can reference shared tokens for `surface`, `surface-container-low`, `surface-container-lowest`, `primary`, `tertiary`, `error`, `outline`, and semantic status states.
2. **Given** light and dark themes are configured, **When** the root theme class changes, **Then** the same component instance updates theme colors without switching to a separate dark-only component.

---

### User Story 2 - Reusable Component Primitives (Priority: P1)

As a frontend implementer, I need reusable component primitives for the repeated controls in the static HTML screens so authentication, dashboard, account, transfer, ledger, fraud, notification, observability, and health pages can be built consistently.

**Why this priority**: The static exports repeat buttons, inputs, chips, metrics, tables, skeletons, dialogs, and app-shell regions. Component extraction prevents duplication and makes later phases faster.

**Independent Test**: Render a component gallery containing the primitives and compare them against representative elements in the exported `code.html` and `screen.png` files.

**Acceptance Scenarios**:

1. **Given** the component gallery is open, **When** a reviewer checks primary, secondary, and tertiary buttons, **Then** the variants match the Vault Protocol behavior and use radius no larger than the approved design language.
2. **Given** a status chip renders success, warning, error, and info states, **When** it appears in light or dark mode, **Then** text remains readable and the chip distinguishes metadata from interactive buttons.
3. **Given** a table-like data view renders, **When** rows are separated, **Then** tonal shifts and spacing are used instead of hard divider lines except where accessibility requires a ghost border.

---

### User Story 3 - Shared Portal Layout Primitives (Priority: P2)

As a frontend implementer, I need layout primitives for the shell, sidebar, top bar, mobile nav, page header, and content grid so the future routed portal uses the same operational frame across all screen families.

**Why this priority**: Many exported screens share a Banking Ops shell and navigation pattern. Extracting it early reduces rework during routing and page implementation.

**Independent Test**: Render the shell with placeholder nav items at mobile, tablet, and desktop widths and verify layout stability, active navigation state, and theme switching.

**Acceptance Scenarios**:

1. **Given** the app shell renders at desktop width, **When** a navigation item is active, **Then** the sidebar uses `surface-container-low`, a `primary-container` active state, and a leading accent bar.
2. **Given** the app shell renders at mobile width, **When** navigation is displayed, **Then** text and controls remain within their containers and no page content is hidden behind navigation.

---

### User Story 4 - Reference Parity Baseline (Priority: P3)

As a reviewer, I need a documented parity baseline between the static exports and the React design system so later screen-porting phases can tell whether differences are intentional.

**Why this priority**: The screen folder contains multiple variants per feature area. A baseline prevents later implementation phases from guessing which visual patterns are canonical.

**Independent Test**: Review the parity contract and verify that at least one light and one dark reference composition are built from shared primitives and checked against the static exports.

**Acceptance Scenarios**:

1. **Given** the Phase 1 gallery or reference page exists, **When** a reviewer compares it with `authentication` and one Banking Ops shell screen, **Then** the major token, typography, radius, spacing, and component states are traceable to shared primitives.
2. **Given** a static export uses a pattern that conflicts with `vault_protocol/DESIGN.md`, **When** the pattern is implemented or rejected, **Then** the difference is recorded as an intentional decision.

### Edge Cases

- Static HTML exports include repeated Tailwind configuration blocks; the design system must deduplicate them into one configuration source.
- Some exported screens use border utilities even though the Vault Protocol discourages explicit section lines; these should become ghost borders only where needed for accessibility or form affordance.
- Light and dark variants exist as separate exports; React must support theme switching without separate screen components.
- Material Symbols are linked repeatedly in static exports; the implementation must load icon assets once at the application shell or document a self-hosting decision.
- Long labels, IDs, balances, and status text must not overflow fixed controls, tables, nav items, or metric cards.
- Future API-driven states may have labels not present in the mockups; primitives must support unknown/neutral status without breaking layout.
- If the gateway is unavailable during Phase 1 review, the reference gallery must keep rendering and show a non-blocking degraded/unavailable health state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST centralize the Sovereign Ledger color palette and semantic role tokens in the frontend theme/Tailwind configuration.
- **FR-002**: The system MUST support light and dark modes via shared theme tokens and a root theme class or equivalent theme provider.
- **FR-003**: The system MUST define typography tokens for display, headline, title, body, and label use cases based on Inter.
- **FR-004**: The system MUST define shared radius, spacing, surface, shadow, and ghost-border conventions aligned with `vault_protocol/DESIGN.md`.
- **FR-005**: The system MUST provide reusable primitives for Button, IconButton, Input, Select, StatusChip, MetricCard, DataTable, EmptyState, Skeleton, Toast, and Dialog.
- **FR-006**: The system MUST provide layout primitives for AppShell, Sidebar, TopBar, MobileNav, PageHeader, and ContentGrid.
- **FR-007**: The system MUST preserve the "no hard divider lines" design intent for static layout and data tables, using tonal shifts and spacing by default.
- **FR-008**: The system MUST provide accessible labels and visible focus states for interactive primitives, including icon-only buttons.
- **FR-009**: The system MUST keep component dimensions layout-stable across loading, empty, populated, hover, and disabled states.
- **FR-010**: The system MUST include a component gallery or reference route that demonstrates tokens, primitives, theme switching, and at least one light and one dark composition.
- **FR-011**: The system MUST document any intentional deviations from static exports where the Vault Protocol takes precedence.
- **FR-012**: The system MUST avoid page-local copies of the screen export Tailwind config after a primitive/page is migrated.
- **FR-013**: If no frontend workspace exists, Phase 1 MUST create only the minimal `services/web-portal` workspace required for shared tokens, primitives, layout primitives, and the reference gallery.
- **FR-014**: Phase 1 MUST use manual reviewer acceptance of the reference gallery as the required visual parity gate; automated screenshot or pixel-diff checks are optional follow-up work, not required for Phase 1 acceptance.
- **FR-015**: Phase 1 MUST use `authentication`, `authentication_dark`, `account_management_1`, and `account_management_dark` as the canonical static-export references for the reference gallery and parity decisions.
- **FR-016**: Phase 1 MUST enforce component-level accessibility basics for primitives, including accessible labels, visible focus states, keyboard behavior for interactive components, and readable semantic colors; full WCAG audit is deferred to full screen implementation phases.
- **FR-017**: Phase 1 MUST include a typed frontend API client foundation and a real gateway `GET /health` call for the reference gallery; full banking business endpoint integration remains out of scope for Phase 1.

### Key Entities *(include if feature involves data)*

- **DesignToken**: A named visual value such as color, typography, radius, shadow, or spacing used by the React portal.
- **ThemeMode**: A light or dark token set selected at the root application level.
- **ComponentPrimitive**: A reusable UI building block with variants, states, accessibility rules, and theme behavior.
- **LayoutPrimitive**: A reusable shell or page composition building block for the authenticated portal frame.
- **StatusSemantic**: A reusable mapping for success, warning, error, info, neutral, and unknown states.
- **ScreenReference**: A static HTML/screenshot source used to validate visual parity; Phase 1 canonical references are `authentication`, `authentication_dark`, `account_management_1`, and `account_management_dark`.
- **ParityDecision**: A recorded decision that accepts, adapts, or rejects a static-export pattern.
- **GatewayHealthProbe**: A minimal API-client-backed health request that reads the gateway `/health` response and maps it into healthy, degraded, or unavailable reference-gallery states.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of Phase 1 primitives render in both light and dark modes from the same component implementation.
- **SC-002**: At least 12 component/layout primitives are available from shared exports before the first full screen port begins.
- **SC-003**: At least one light reference composition and one dark reference composition receive manual reviewer acceptance against the chosen static exports.
- **SC-004**: No migrated primitive or reference composition contains a private copy of the old per-screen Tailwind color map.
- **SC-005**: Automated checks include typecheck plus at least one component test or visual smoke test covering theme switching and primitive rendering.
- **SC-006**: Reference gallery review verifies component-level accessibility basics for interactive primitives before Phase 1 is accepted.
- **SC-007**: The reference gallery can display live gateway health when `VITE_API_BASE_URL` points to a running gateway and can display a degraded/unavailable state without crashing when the gateway is down.
