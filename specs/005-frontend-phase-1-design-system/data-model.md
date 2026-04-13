# Data Model: Frontend Phase 1 Design System Extraction

## DesignToken

Represents a named visual value exposed through the frontend design system.

**Fields**:

- `name`: stable token name, for example `surface`, `surface-container-low`, `surface-container-lowest`, `primary`, `error`, `headline-sm`.
- `category`: one of `color`, `typography`, `radius`, `spacing`, `shadow`, `border`, `z-index`.
- `lightValue`: value used in light mode.
- `darkValue`: value used in dark mode when different.
- `usage`: approved component or layout use.
- `source`: `vault_protocol`, `static_export`, or `derived`.

**Validation rules**:

- `name` must be unique.
- Tokens sourced from static exports must not override a conflicting Vault Protocol rule without a parity decision.
- Color tokens must be semantic or surface-oriented; page-local one-off colors should not become global tokens without repeated use.

## ThemeMode

Represents the active visual theme for the React portal.

**Fields**:

- `mode`: `light` or `dark`.
- `rootClass`: `light` or `dark`.
- `tokens`: resolved token map for the active mode.

**State transitions**:

- `light -> dark`: root class changes and shared components update without remounting as separate dark components.
- `dark -> light`: root class changes and shared components update without replacing page-level implementations.

## ComponentPrimitive

Represents a reusable interactive or display component.

**Fields**:

- `name`: component name, such as `Button`, `Input`, `StatusChip`, or `DataTable`.
- `variants`: allowed visual variants.
- `states`: supported state names, such as `default`, `hover`, `focus`, `disabled`, `loading`, `empty`, or `error`.
- `accessibility`: required labels, roles, keyboard behavior, and focus behavior.
- `themeBehavior`: notes for light/dark rendering.
- `layoutRules`: dimensions or responsive constraints required for layout stability.

**Validation rules**:

- Icon-only primitives require an accessible name.
- Interactive primitives require visible focus states.
- Components must not encode raw per-screen color maps.
- Radius must stay within the approved Vault Protocol language.

## LayoutPrimitive

Represents a reusable structural component for the portal frame.

**Fields**:

- `name`: `AppShell`, `Sidebar`, `TopBar`, `MobileNav`, `PageHeader`, or `ContentGrid`.
- `regions`: named slots such as `navigation`, `header`, `main`, `actions`, or `footer`.
- `responsiveBehavior`: desktop, tablet, and mobile layout rules.
- `themeBehavior`: surface and active-state tokens.
- `navigationState`: active, hover, disabled, and hidden states where relevant.

**Validation rules**:

- Sidebar active state must follow Vault Protocol guidance: tonal active background plus leading accent bar.
- Mobile navigation must not cover unreadable page content.
- Layout primitives must constrain dynamic content to prevent overflow.

## StatusSemantic

Represents a semantic status category used by chips, alerts, rows, and metrics.

**Fields**:

- `status`: `success`, `warning`, `error`, `info`, `neutral`, or `unknown`.
- `containerToken`: background or tonal token.
- `textToken`: foreground token.
- `meaning`: approved use.

**Validation rules**:

- `error` maps to critical/failure states, not decorative emphasis.
- `warning` maps to pending or high-risk states.
- `success` maps to completed/healthy states.
- `info` maps to neutral system messages and links.
- `unknown` must remain readable and not imply success.

## ScreenReference

Represents a static source used to validate design-system parity.

**Fields**:

- `folder`: static export folder name.
- `codePath`: path to `code.html` when present.
- `screenshotPath`: path to `screen.png` when present.
- `theme`: `light`, `dark`, or `variant`.
- `screenFamily`: authentication, dashboard, accounts, transfers, ledger, fraud, notifications, observability, or platform health.
- `patternsUsed`: components or layouts extracted from this reference.

**Validation rules**:

- At least one light and one dark reference must be selected for Phase 1 parity.
- Static references remain references; React primitives become the implementation source of truth.

## ParityDecision

Represents an implementation choice where a static-export pattern is accepted, adapted, or rejected.

**Fields**:

- `reference`: related `ScreenReference`.
- `pattern`: visual or interaction pattern under review.
- `decision`: `accept`, `adapt`, or `reject`.
- `reason`: design-system rationale.
- `replacement`: replacement token/component behavior when adapted or rejected.

**Validation rules**:

- Any conflict with `vault_protocol/DESIGN.md` must result in an explicit `adapt` or `reject` decision.
- Decisions must be documented before deleting static-export parity notes.

## GatewayHealthProbe

Represents the minimal runtime integration required for Phase 1.

**Fields**:

- `apiBaseUrl`: frontend-safe gateway base URL from `VITE_API_BASE_URL`.
- `endpoint`: `GET /health`.
- `status`: `healthy`, `degraded`, or `unavailable`.
- `services`: optional service status map returned by the gateway.
- `errorMessage`: non-blocking message shown when the gateway is unavailable.

**Validation rules**:

- The reference gallery must keep rendering when the gateway call fails.
- Business endpoints such as accounts, transfers, ledger, fraud, and notifications remain out of scope for Phase 1.
- The probe must not require secrets in the frontend bundle.
