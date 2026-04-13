# Implementation Plan: Frontend Phase 1 Design System Extraction

**Branch**: `005-frontend-phase-1-design-system` | **Date**: 2026-04-13 | **Spec**: `specs/005-frontend-phase-1-design-system/spec.md`  
**Input**: Feature specification from `/specs/005-frontend-phase-1-design-system/spec.md`

**Note**: This plan was generated for the `speckit-plan` workflow using `vault_protocol/DESIGN.md` and `FRONTEND_IMPLEMENTATION_PLAN.md` as source material.

## Summary

Extract the Sovereign Ledger frontend design system from the static Stitch Remix screen exports into a reusable React/Tailwind foundation. The implementation will centralize color, typography, radius, spacing, surface, shadow, and ghost-border rules; support light/dark theming through shared tokens; provide component primitives and layout primitives; include a minimal API client with a real gateway `/health` probe; and establish a manual-review visual parity baseline using `authentication`, `authentication_dark`, `account_management_1`, and `account_management_dark` so later screen-porting phases can build without duplicated screen-local Tailwind configuration.

The technical approach is to add or use the planned React portal workspace, define Tailwind and CSS custom-property tokens based on the Vault Protocol, implement the shared primitives as typed React components, and verify them through a component gallery/reference route plus automated checks.

## Technical Context

**Language/Version**: TypeScript 5.8, React 19, Node.js 20 workspace runtime  
**Primary Dependencies**: Vite, React, Tailwind CSS, Material Symbols for icon parity, Testing Library/Vitest for primitive tests  
**Storage**: N/A for Phase 1; theme preference may use browser local storage in a later shell/session phase if desired  
**Testing**: TypeScript typecheck, ESLint, Vitest + Testing Library for primitive behavior, optional Playwright screenshot smoke checks for reference compositions  
**Target Platform**: Browser-based React portal served locally during development and later deployable as static assets/containerized frontend  
**Project Type**: Frontend web application inside the existing Node.js monorepo  
**Performance Goals**: Reusable primitives render without unnecessary layout shifts; theme switching should avoid a full page reload; token usage should avoid duplicating large per-screen Tailwind config blocks  
**Constraints**: Preserve Vault Protocol "Architectural Precision"; avoid hard divider lines by default; support light/dark themes from one component implementation; keep fonts/icons loaded once; keep text inside responsive containers; do not expose backend secrets in frontend config  
**Scale/Scope**: Phase 1 covers shared tokens, 10 component primitives, 6 layout primitives, status semantics, a minimal API client health probe, and canonical auth/account reference compositions; it does not implement full banking business endpoint integration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The current constitution file still contains placeholder principle text rather than enforceable project-specific gates. No actionable constitution violations are identified. This plan applies the active repository guidance instead:

- Use existing Node.js 20 / TypeScript 5.8 workspace conventions.
- Keep changes scoped to the frontend design-system feature.
- Add test coverage proportional to shared UI risk.
- Do not commit secrets or place runtime secrets in frontend configuration.

**Gate status:** PASS, with no complexity exceptions.

## Project Structure

### Documentation (this feature)

```text
specs/005-frontend-phase-1-design-system/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- design-token-contract.md
|   |-- primitive-component-contract.md
|   `-- visual-parity-contract.md
`-- tasks.md
```

### Source Code (repository root)

```text
stitch_remix_of_cn_banking_react_portal/
`-- stitch_remix_of_cn_banking_react_portal/
    |-- vault_protocol/
    |   `-- DESIGN.md
    |-- authentication*/
    |-- customer_dashboard*/
    |-- account_management*/
    |-- transfers*/
    |-- financial_ledger*/
    |-- fraud_monitoring*/
    |-- notification_center*/
    |-- observability_dashboard*/
    |-- platform_health*/
    `-- FRONTEND_IMPLEMENTATION_PLAN.md

services/
`-- web-portal/                 # planned frontend workspace if Phase 0 has not already created it
    |-- package.json
    |-- index.html
    |-- vite.config.ts
    |-- tailwind.config.ts
    |-- src/
    |   |-- app/
    |   |-- components/
    |   |   |-- primitives/
    |   |   `-- layout/
    |   |-- design-system/
    |   |   |-- tokens.ts
    |   |   |-- theme.ts
    |   |   `-- status.ts
    |   |-- styles/
    |   |   `-- globals.css
    |   `-- test/
    `-- tests/
        |-- components/
        `-- visual/
```

**Structure Decision**: Use a `services/web-portal` workspace to match the current root `package.json` workspace pattern (`services/*`, `shared/*`) and to keep the browser-facing portal near the existing `api-gateway`. Phase 1 source should concentrate design-system code under `src/design-system`, primitive components under `src/components/primitives`, and layout primitives under `src/components/layout`.

## Phase 0: Outline & Research

Research resolved the open technical choices for the design-system extraction:

- Theme mechanism: Tailwind tokens backed by CSS custom properties and a root `light`/`dark` class.
- Component implementation: typed React primitives with variant props, using local utilities for class composition.
- Icon handling: load Material Symbols once at app root initially; consider self-hosting during deployment hardening.
- Visual parity strategy: component gallery/reference route using `authentication`, `authentication_dark`, `account_management_1`, and `account_management_dark`, accepted by manual reviewer approval rather than strict screenshot diffing.
- Runtime integration: include only a typed API client foundation plus gateway `GET /health` probe for healthy, degraded, and unavailable gallery states.
- Border policy: tonal shifts and spacing by default; ghost borders only for form affordances, focus, or accessibility.

**Output**: `research.md`

## Phase 1: Design & Contracts

Design artifacts for this phase:

- `data-model.md`: design tokens, theme modes, component primitives, layout primitives, status semantics, screen references, parity decisions, and gateway health probe.
- `contracts/design-token-contract.md`: token naming and usage contract for colors, surfaces, typography, radius, shadows, and ghost borders.
- `contracts/primitive-component-contract.md`: component primitive API expectations, states, accessibility requirements, and layout stability rules.
- `contracts/visual-parity-contract.md`: requirements for comparing React primitives/compositions against the static screen exports.
- `quickstart.md`: setup and verification steps for implementing and checking Phase 1 locally.

**Output**: `data-model.md`, `contracts/*`, `quickstart.md`, updated Codex agent context.

## Constitution Check Post-Design

The design artifacts keep the work in one frontend workspace, introduce no unrelated backend changes, require focused component/typecheck validation, and avoid frontend secrets. No constitution text provides stricter project-specific gates.

**Gate status:** PASS, with no complexity exceptions.

## Complexity Tracking

No constitution violations or intentional complexity exceptions are required for Phase 1.
