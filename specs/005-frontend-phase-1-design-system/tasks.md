# Tasks: Frontend Phase 1 Design System Extraction

**Input**: Design documents from `/specs/005-frontend-phase-1-design-system/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Included because the spec requires automated checks for theme switching, primitive rendering, and component-level accessibility basics.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on incomplete tasks.
- **[Story]**: Maps to user stories in `spec.md`.
- Every task includes an exact file path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the minimal frontend workspace required for Phase 1.

- [X] T001 Create `services/web-portal/package.json` with Vite React TypeScript scripts for `dev`, `build`, `lint`, `typecheck`, and `test`
- [X] T002 Create `services/web-portal/index.html` with a root mount node and single Material Symbols font reference
- [X] T003 [P] Create `services/web-portal/tsconfig.json` extending `tsconfig.base.json`
- [X] T004 [P] Create `services/web-portal/vite.config.ts` with React and Vitest configuration
- [X] T005 [P] Create `services/web-portal/postcss.config.cjs` for Tailwind CSS processing
- [X] T006 [P] Create `services/web-portal/.env.example` with `VITE_API_BASE_URL=http://localhost:8080`
- [X] T007 [P] Create `services/web-portal/src/test/setup.ts` for Testing Library setup

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish app entry points, global styles, shared utilities, and the minimal gateway health integration required before user stories.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T008 Create `services/web-portal/src/main.tsx` to mount the React app with the initial root theme class
- [X] T009 Create `services/web-portal/src/app/App.tsx` with a placeholder design-system gallery shell
- [X] T010 [P] Create `services/web-portal/src/styles/globals.css` importing Tailwind layers and CSS custom property placeholders
- [X] T011 [P] Create `services/web-portal/src/lib/cn.ts` for class name composition used by primitives
- [X] T012 [P] Create `services/web-portal/src/lib/env.ts` to read `VITE_API_BASE_URL` without exposing secrets
- [X] T013 [P] Create `services/web-portal/src/lib/api/client.ts` with typed request helper and non-throwing error normalization
- [X] T014 Create `services/web-portal/src/lib/api/health.ts` with typed `GET /health` gateway probe returning healthy, degraded, or unavailable states
- [X] T015 [P] Create `services/web-portal/src/lib/api/health.test.ts` covering healthy, degraded, and unavailable `/health` probe states

**Checkpoint**: Frontend workspace can start, compile, and expose a placeholder gallery with health probe utilities ready.

---

## Phase 3: User Story 1 - Shared Sovereign Ledger Tokens (Priority: P1) MVP

**Goal**: Centralize Vault Protocol visual rules as reusable light/dark design tokens.

**Independent Test**: Inspect the theme/Tailwind configuration and verify that a light and dark sample surface, button, input, and status chip can render using centralized tokens rather than page-local colors.

### Tests for User Story 1

- [X] T016 [P] [US1] Create token validation tests in `services/web-portal/src/design-system/tokens.test.ts`
- [X] T017 [P] [US1] Create theme switching tests in `services/web-portal/src/design-system/theme.test.ts`

### Implementation for User Story 1

- [X] T018 [P] [US1] Define Vault Protocol color, surface, typography, radius, shadow, and ghost-border tokens in `services/web-portal/src/design-system/tokens.ts`
- [X] T019 [P] [US1] Define light and dark theme maps with root class names in `services/web-portal/src/design-system/theme.ts`
- [X] T020 [P] [US1] Define status semantic mappings for success, warning, error, info, neutral, and unknown in `services/web-portal/src/design-system/status.ts`
- [X] T021 [US1] Wire design tokens into `services/web-portal/tailwind.config.ts`
- [X] T022 [US1] Wire CSS custom properties and base Inter typography into `services/web-portal/src/styles/globals.css`
- [X] T023 [US1] Export token, theme, and status APIs from `services/web-portal/src/design-system/index.ts`
- [X] T024 [US1] Document token source and Vault Protocol deviations in `services/web-portal/src/design-system/README.md`

**Checkpoint**: User Story 1 is independently testable with centralized tokens and theme switching.

---

## Phase 4: User Story 2 - Reusable Component Primitives (Priority: P1)

**Goal**: Provide shared primitives for repeated controls across the static screens.

**Independent Test**: Render a primitive gallery section and compare buttons, inputs, chips, metrics, tables, skeletons, toasts, and dialogs against representative static exports.

### Tests for User Story 2

- [X] T025 [P] [US2] Create Button and IconButton tests in `services/web-portal/src/components/primitives/button.test.tsx`
- [X] T026 [P] [US2] Create form control tests in `services/web-portal/src/components/primitives/form-controls.test.tsx`
- [X] T027 [P] [US2] Create StatusChip and MetricCard tests in `services/web-portal/src/components/primitives/display.test.tsx`
- [X] T028 [P] [US2] Create DataTable state tests in `services/web-portal/src/components/primitives/data-table.test.tsx`
- [X] T029 [P] [US2] Create Dialog and Toast accessibility tests in `services/web-portal/src/components/primitives/overlay.test.tsx`

### Implementation for User Story 2

- [X] T030 [P] [US2] Implement `Button` and `IconButton` in `services/web-portal/src/components/primitives/Button.tsx`
- [X] T031 [P] [US2] Implement `Input` and `Select` in `services/web-portal/src/components/primitives/FormControls.tsx`
- [X] T032 [P] [US2] Implement `StatusChip` in `services/web-portal/src/components/primitives/StatusChip.tsx`
- [X] T033 [P] [US2] Implement `MetricCard` in `services/web-portal/src/components/primitives/MetricCard.tsx`
- [X] T034 [P] [US2] Implement `DataTable` with loading, empty, error, hover, and focus states in `services/web-portal/src/components/primitives/DataTable.tsx`
- [X] T035 [P] [US2] Implement `EmptyState` and `Skeleton` in `services/web-portal/src/components/primitives/Feedback.tsx`
- [X] T036 [P] [US2] Implement `Toast` in `services/web-portal/src/components/primitives/Toast.tsx`
- [X] T037 [P] [US2] Implement `Dialog` with accessible title and focus behavior in `services/web-portal/src/components/primitives/Dialog.tsx`
- [X] T038 [US2] Export all primitives from `services/web-portal/src/components/primitives/index.ts`
- [X] T039 [US2] Add primitive examples to `services/web-portal/src/app/App.tsx`

**Checkpoint**: User Story 2 is independently testable with all required primitives rendered from shared tokens.

---

## Phase 5: User Story 3 - Shared Portal Layout Primitives (Priority: P2)

**Goal**: Provide the reusable shell and layout frame for future routed portal screens.

**Independent Test**: Render the shell with placeholder nav items at mobile, tablet, and desktop widths and verify layout stability, active navigation state, and theme switching.

### Tests for User Story 3

- [X] T040 [P] [US3] Create AppShell and Sidebar tests in `services/web-portal/src/components/layout/app-shell.test.tsx`
- [X] T041 [P] [US3] Create responsive layout tests in `services/web-portal/src/components/layout/responsive-layout.test.tsx`

### Implementation for User Story 3

- [X] T042 [P] [US3] Implement `AppShell` in `services/web-portal/src/components/layout/AppShell.tsx`
- [X] T043 [P] [US3] Implement `Sidebar` with Vault Protocol active state in `services/web-portal/src/components/layout/Sidebar.tsx`
- [X] T044 [P] [US3] Implement `TopBar` in `services/web-portal/src/components/layout/TopBar.tsx`
- [X] T045 [P] [US3] Implement `MobileNav` with non-overlapping content behavior in `services/web-portal/src/components/layout/MobileNav.tsx`
- [X] T046 [P] [US3] Implement `PageHeader` and `ContentGrid` in `services/web-portal/src/components/layout/PageLayout.tsx`
- [X] T047 [US3] Export all layout primitives from `services/web-portal/src/components/layout/index.ts`
- [X] T048 [US3] Add shell and navigation examples to `services/web-portal/src/app/App.tsx`

**Checkpoint**: User Story 3 is independently testable with shared layout primitives and stable responsive shell behavior.

---

## Phase 6: User Story 4 - Reference Parity Baseline (Priority: P3)

**Goal**: Build a reference gallery and parity record using `authentication`, `authentication_dark`, `account_management_1`, and `account_management_dark`.

**Independent Test**: A reviewer manually accepts the reference gallery by comparing its light/dark auth and account shell compositions against the canonical static exports and confirming documented parity decisions.

### Tests for User Story 4

- [X] T049 [P] [US4] Create reference gallery render test in `services/web-portal/src/app/design-system-gallery.test.tsx`
- [X] T050 [P] [US4] Create gateway health gallery state test in `services/web-portal/src/app/gateway-health-card.test.tsx`

### Implementation for User Story 4

- [X] T051 [P] [US4] Create canonical screen reference metadata in `services/web-portal/src/app/gallery/screenReferences.ts`
- [X] T052 [P] [US4] Create parity decision records for accepted, adapted, and rejected static-export patterns in `services/web-portal/src/app/gallery/parityDecisions.ts`
- [X] T053 [US4] Implement `DesignSystemGallery` composition for auth references in `services/web-portal/src/app/gallery/DesignSystemGallery.tsx`
- [X] T054 [US4] Implement account shell reference composition using layout primitives in `services/web-portal/src/app/gallery/AccountShellReference.tsx`
- [X] T055 [US4] Implement gateway health status card using `GET /health` probe states in `services/web-portal/src/app/gallery/GatewayHealthCard.tsx`
- [X] T056 [US4] Wire `DesignSystemGallery`, `AccountShellReference`, and `GatewayHealthCard` into `services/web-portal/src/app/App.tsx`
- [X] T057 [US4] Add manual reviewer acceptance checklist to `services/web-portal/src/app/gallery/README.md`

**Checkpoint**: User Story 4 is independently testable by manual reviewer acceptance of the reference gallery.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation updates across Phase 1.

- [X] T058 [P] Update `specs/005-frontend-phase-1-design-system/quickstart.md` with final workspace commands and gallery review path
- [X] T059 [P] Update `stitch_remix_of_cn_banking_react_portal/stitch_remix_of_cn_banking_react_portal/FRONTEND_IMPLEMENTATION_PLAN.md` to mark Phase 1 clarified scope and canonical references
- [X] T060 Run `npm run lint -w services/web-portal` and record any follow-up in `specs/005-frontend-phase-1-design-system/tasks.md`
- [X] T061 Run `npm run typecheck -w services/web-portal` and record any follow-up in `specs/005-frontend-phase-1-design-system/tasks.md`
- [X] T062 Run `npm test -w services/web-portal` and record any follow-up in `specs/005-frontend-phase-1-design-system/tasks.md`
- [X] T063 Run `npm run build -w services/web-portal` and record any follow-up in `specs/005-frontend-phase-1-design-system/tasks.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational; MVP scope.
- **User Story 2 (Phase 4)**: Depends on User Story 1 tokens.
- **User Story 3 (Phase 5)**: Depends on User Story 1 tokens and can run in parallel with User Story 2 after token exports stabilize.
- **User Story 4 (Phase 6)**: Depends on User Stories 1, 2, and 3 plus the health probe from Foundational.
- **Polish (Phase 7)**: Depends on all selected user stories.

### User Story Dependencies

- **US1 Shared Sovereign Ledger Tokens**: No dependency on other user stories; MVP.
- **US2 Reusable Component Primitives**: Depends on US1 token exports.
- **US3 Shared Portal Layout Primitives**: Depends on US1 token exports.
- **US4 Reference Parity Baseline**: Depends on US1, US2, and US3 outputs.

### Parallel Opportunities

- T003-T007 can run in parallel after T001.
- T010-T013 and T015 can run in parallel after T008-T009.
- T016-T020 can run in parallel before T021-T024.
- T025-T029 can run in parallel before T030-T039.
- T030-T037 can run in parallel after US2 tests are drafted.
- T040-T046 can run in parallel after US1 token exports stabilize.
- T049-T052 can run in parallel before T053-T057.
- T058-T059 can run in parallel after US4.

---

## Parallel Example: User Story 2

```text
Task: "Create Button and IconButton tests in services/web-portal/src/components/primitives/button.test.tsx"
Task: "Create form control tests in services/web-portal/src/components/primitives/form-controls.test.tsx"
Task: "Create StatusChip and MetricCard tests in services/web-portal/src/components/primitives/display.test.tsx"
Task: "Create DataTable state tests in services/web-portal/src/components/primitives/data-table.test.tsx"
Task: "Create Dialog and Toast accessibility tests in services/web-portal/src/components/primitives/overlay.test.tsx"
```

```text
Task: "Implement Button and IconButton in services/web-portal/src/components/primitives/Button.tsx"
Task: "Implement Input and Select in services/web-portal/src/components/primitives/FormControls.tsx"
Task: "Implement StatusChip in services/web-portal/src/components/primitives/StatusChip.tsx"
Task: "Implement MetricCard in services/web-portal/src/components/primitives/MetricCard.tsx"
Task: "Implement DataTable in services/web-portal/src/components/primitives/DataTable.tsx"
```

---

## Parallel Example: User Story 3

```text
Task: "Implement AppShell in services/web-portal/src/components/layout/AppShell.tsx"
Task: "Implement Sidebar with Vault Protocol active state in services/web-portal/src/components/layout/Sidebar.tsx"
Task: "Implement TopBar in services/web-portal/src/components/layout/TopBar.tsx"
Task: "Implement MobileNav with non-overlapping content behavior in services/web-portal/src/components/layout/MobileNav.tsx"
Task: "Implement PageHeader and ContentGrid in services/web-portal/src/components/layout/PageLayout.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup.
2. Complete Phase 2 foundational app, utilities, and health probe.
3. Complete Phase 3 token and theme extraction.
4. Stop and validate US1 independently with token and theme tests.

### Incremental Delivery

1. Deliver US1 tokens and theme switching.
2. Add US2 component primitives.
3. Add US3 layout primitives.
4. Add US4 reference gallery, gateway health card, parity decisions, and manual acceptance checklist.
5. Run lint, typecheck, tests, and build.

### Parallel Team Strategy

After Foundational and US1 token exports stabilize:

- Developer A: US2 primitive components and tests.
- Developer B: US3 layout primitives and tests.
- Developer C: US4 gallery metadata and parity decision records, then integrates once primitives are ready.

---

## Notes

- `[P]` tasks use different files and can run in parallel within their dependency boundaries.
- `[US1]` maps to Shared Sovereign Ledger Tokens.
- `[US2]` maps to Reusable Component Primitives.
- `[US3]` maps to Shared Portal Layout Primitives.
- `[US4]` maps to Reference Parity Baseline.
- Manual visual reviewer acceptance is required for Phase 1; screenshot and pixel-diff automation are optional follow-up work.
- Full banking business endpoint integration remains out of scope except the gateway `GET /health` probe.
