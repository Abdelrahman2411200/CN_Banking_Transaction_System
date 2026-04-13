# Research: Frontend Phase 1 Design System Extraction

## Decision: Use Tailwind Tokens Backed By CSS Custom Properties

**Rationale**: The static screen exports already use Tailwind utility classes and repeated Tailwind config color maps. Keeping Tailwind preserves visual parity and developer familiarity, while CSS custom properties allow light/dark mode switching from a single component implementation.

**Alternatives considered**:

- Static Tailwind color values only: rejected because dark mode would duplicate variants and make theme switching harder.
- CSS modules without Tailwind: rejected because it discards the existing export language and increases porting effort.
- Runtime component library theming package: rejected for Phase 1 because the Vault Protocol has a specific bespoke token system and does not need a heavy external design framework.

## Decision: Theme With A Root `light` / `dark` Class

**Rationale**: The exported HTML files already use `html class="light"` and Tailwind `darkMode: "class"`. Preserving class-based theming minimizes migration risk and allows the same React primitive to render both themes.

**Alternatives considered**:

- System-only `prefers-color-scheme`: rejected because operators may need explicit theme control.
- Separate dark components/pages: rejected because it duplicates the screen exports and violates the Phase 1 goal.

## Decision: Extract Tokens From `vault_protocol/DESIGN.md` First, Then Static Screens

**Rationale**: The Vault Protocol is the canonical design intent. Static screens are valuable references, but some use border utilities and repeated imports that should be normalized during React extraction.

**Alternatives considered**:

- Copy tokens directly from every screen: rejected because it would preserve duplicated per-page configuration.
- Invent a new palette: rejected because the user explicitly asked to plan according to Vault Protocol and the existing frontend plan.

## Decision: Build Typed React Primitives With Variant Props

**Rationale**: Buttons, inputs, chips, metrics, tables, dialogs, skeletons, and shell layout appear across many screens. Typed primitives make allowed variants explicit and reduce page-level Tailwind drift.

**Alternatives considered**:

- Raw Tailwind snippets per page: rejected because it repeats the static export problem.
- Third-party component kit: rejected for Phase 1 because the Vault Protocol requires a custom high-density fintech aesthetic and strict tonal hierarchy.

## Decision: Use Tonal Separation By Default And Ghost Borders Only As Fallback

**Rationale**: Vault Protocol explicitly prefers tonal shifts and negative space over hard divider lines. Inputs and accessibility-critical states may still need subtle ghost borders.

**Alternatives considered**:

- Keep all borders from static exports: rejected because it conflicts with the design north star.
- Remove every border completely: rejected because forms, focus states, and high-contrast needs may require a visible edge.

## Decision: Establish A Component Gallery Or Reference Route In Phase 1

**Rationale**: Later screen work needs an objective baseline for primitives and theme behavior. A gallery/reference route makes review easier before the full portal pages exist.

**Alternatives considered**:

- Wait until the first full page port: rejected because component issues would be discovered too late.
- Use screenshots only without a runnable reference: rejected because interaction, focus, disabled, loading, and theme states need live verification.

## Decision: Load Material Symbols Once For Initial Parity

**Rationale**: Static exports rely on Material Symbols. Loading them once at app root gives parity while avoiding repeated per-screen font imports.

**Alternatives considered**:

- Replace icons immediately: rejected because it would add visual differences unrelated to Phase 1.
- Self-host icons immediately: deferred to deployment hardening, where CSP and asset strategy can be decided with the hosting target.
