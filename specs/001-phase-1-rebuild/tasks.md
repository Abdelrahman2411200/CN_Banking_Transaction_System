# Tasks: Phase 1 — Cloud-Native Banking Transaction System

**Input**: Design documents from `/specs/001-phase-1-rebuild/`
**Owner**: Sam (full Phase 1 end-to-end)
**Branch**: `001-phase-1-rebuild`

**Format**: `- [ ] [TaskID] [P?] [Story?] Description with file path`
- **[P]**: Can run in parallel (no dependency on concurrent tasks)
- **[US#]**: Maps to user story from spec.md

> **Three Required Tests** (non-negotiable deliverables):
> - FR-027: Unit — compensation fires when credit step throws (`saga.test.ts`)
> - FR-028: Integration — insufficient funds → 422, both balances unchanged (`transfer.test.ts`)
> - FR-029: Integration — happy-path transfer updates both balances atomically (`transfer.test.ts`)

---

## Phase 1: Repo Audit & Cleanup

**Purpose**: Remove all stale Phase 1 artifacts before any new code is written. The repo must be in a clean, known state before rebuilding.

**⚠️ CRITICAL**: Do not write any new source code until this phase is complete.

### 1a — Delete Mexo Phase 1 Service Implementation

- [ ] T001 Delete `services/account-service/src/index.ts` (Mexo Phase 1 artifact)
- [ ] T002 Delete `services/account-service/src/db.ts` (Mexo Phase 1 artifact)
- [ ] T003 Delete `services/account-service/src/routes.ts` (Mexo Phase 1 artifact)
- [ ] T004 Delete `services/account-service/src/schema.sql` (Mexo Phase 1 artifact — migration lives in `infra/`)
- [ ] T005 Delete `services/transfer-service/src/index.ts` (Mexo Phase 1 artifact)
- [ ] T006 Delete `services/transfer-service/src/db.ts` (Mexo Phase 1 artifact)
- [ ] T007 Delete `services/transfer-service/src/routes.ts` (Mexo Phase 1 artifact)
- [ ] T008 Delete `services/transfer-service/src/saga.ts` (Mexo Phase 1 artifact)
- [ ] T009 Delete `services/transfer-service/src/schema.sql` (Mexo Phase 1 artifact)
- [ ] T010 Delete `shared/types/src/index.ts` (Mexo Phase 1 artifact — will be rebuilt in Phase 3)

### 1b — Delete Mexo Phase 1 Tests

- [ ] T011 [P] Delete `services/account-service/src/__tests__/routes.test.ts` (Mexo Phase 1 artifact)
- [ ] T012 [P] Delete `services/transfer-service/src/__tests__/saga.test.ts` (Mexo Phase 1 artifact)
- [ ] T013 [P] Delete `tests/integration/transfer.test.ts` (Mexo Phase 1 artifact — will be rebuilt in Phase 7)
- [ ] T014 [P] Delete `tests/integration/_helpers.mjs` (Mexo Phase 1 artifact)
- [ ] T015 [P] Delete `tests/integration/api-contract.test.mjs` (Mexo Phase 1 artifact)
- [ ] T016 [P] Delete `tests/integration/db-schema.test.mjs` (Mexo Phase 1 artifact)
- [ ] T017 [P] Delete `tests/integration/health.test.mjs` (Mexo Phase 1 artifact)

### 1c — Delete Stale Build Artifacts & Obsolete Docs

- [ ] T018 [P] Delete `services/account-service/dist/` directory (stale build output)
- [ ] T019 [P] Delete `services/transfer-service/dist/` directory (stale build output)
- [ ] T020 [P] Delete `shared/types/dist/` directory (stale build output)
- [ ] T021 [P] Delete `Artifacts/PLAN.md` (obsolete two-contributor split plan)
- [ ] T022 [P] Delete `Artifacts/Sam/phase-1-implementation-plan.md` (obsolete partial scope plan)

### 1d — Verify Clean State

- [ ] T023 Confirm `services/account-service/src/` contains only the `__tests__/` directory (empty) — no `.ts` source files remain
- [ ] T024 Confirm `services/transfer-service/src/` contains only the `__tests__/` directory (empty) — no `.ts` source files remain
- [ ] T025 Confirm `shared/types/src/` is empty — no `index.ts` remains
- [ ] T026 Confirm `tests/integration/` is empty — no test files remain

**Checkpoint**: Repo contains only infrastructure/config files and spec artifacts. Zero Mexo implementation files remain.

---

## Phase 2: Monorepo & Workspace Setup Verification

**Purpose**: Confirm all shared tooling files are correct and require no changes. These files were audited in the plan and are all correct as-is.

**⚠️ NOTE**: These tasks are VERIFY tasks, not create tasks. If a file needs changes, update it in place.

- [ ] T027 [P] Verify `package.json` — workspace config includes `shared/*` and `services/*`, all npm scripts present (`build`, `dev`, `lint`, `typecheck`, `test`, `test:unit`, `test:integration`)
- [ ] T028 [P] Verify `tsconfig.base.json` — path alias `@cn-banking/shared-types` maps to `shared/types/src/index.ts`, `noImplicitAny: true`, target ES2022
- [ ] T029 [P] Verify `jest.config.ts` — `moduleNameMapper` handles `@cn-banking/shared-types`, `testMatch` covers both `__tests__` and `tests/integration/*.test.ts`
- [ ] T030 [P] Verify `eslint.config.mjs` — typescript-eslint rules active, `ignores` includes `dist/`
- [ ] T031 [P] Verify `.env.example` — all 14 required env vars present (ports, DB hosts, names, users, passwords, ACCOUNT_SERVICE_URL)
- [ ] T032 [P] Verify `services/account-service/package.json` — dependencies include `express`, `pg`, `uuid`, `zod`, `@cn-banking/shared-types`; devDependencies include `@types/express`, `@types/pg`, `@types/uuid`, `ts-jest`
- [ ] T033 [P] Verify `services/transfer-service/package.json` — dependencies include `express`, `pg`, `uuid`, `zod`, `axios`, `@cn-banking/shared-types`; devDependencies include `@types/axios`
- [ ] T034 [P] Verify `shared/types/package.json` — package name is `@cn-banking/shared-types`, no runtime dependencies

**Checkpoint**: All workspace tooling verified correct. `npm install` can be run from repo root.

---

## Phase 3: Shared Types Package (Foundational)

**Purpose**: Define shared TypeScript interfaces required by both services. Must be complete before any service code is written.

**⚠️ CRITICAL**: Both account-service and transfer-service import from `@cn-banking/shared-types`. This phase BLOCKS Phase 4 and Phase 5.

- [ ] T035 Create `shared/types/src/index.ts` — implement `ApiResponse<T>` generic wrapper interface with `success: boolean`, `data?: T`, `error?: { code: string; message: string }`
- [ ] T036 Add to `shared/types/src/index.ts` — implement `Account` interface with fields: `id`, `name`, `email`, `balance`, `kyc_status`, `status`, `created_at`, `updated_at`
- [ ] T037 Add to `shared/types/src/index.ts` — implement `Transfer` interface with fields: `id`, `from_account_id`, `to_account_id`, `amount`, `status`, `saga_state`, `error_message`, `created_at`, `updated_at`
- [ ] T038 Add to `shared/types/src/index.ts` — implement `SagaState` interface with fields: `current_step: string`, `debit_completed: boolean`, `credit_completed: boolean`, `compensation_completed: boolean`, `error: string | null`
- [ ] T039 Add to `shared/types/src/index.ts` — implement DTOs: `CreateAccountDto` (name, email, optional initial_balance), `UpdateKycDto` (kyc_status), `CreateTransferDto` (from_account_id, to_account_id, amount)
- [ ] T040 Add to `shared/types/src/index.ts` — implement type aliases: `KycStatus = 'pending' | 'verified' | 'rejected'`, `AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED'`, `TransferStatus = 'initiated' | 'debited' | 'completed' | 'failed'`
- [ ] T041 Run `npm run typecheck --workspace @cn-banking/shared-types` — must exit 0

**Checkpoint**: `@cn-banking/shared-types` exports all interfaces, DTOs, and type aliases. Typecheck passes.

---

## Phase 4: User Story 1 — Developer Starts the Full System (Priority: P1) 🎯 MVP

**Goal**: `make up` starts all containers cleanly and both health endpoints return 200. This is the merge gate.

**Independent Test**: `curl localhost:3001/health` → 200; `curl localhost:3002/health` → 200

### Infrastructure Verification (US1)

- [ ] T042 [P] [US1] Verify `docker-compose.yml` — five services defined: `account-service` (port 3001), `transfer-service` (port 3002), `postgres-accounts` (port 5433), `postgres-transfers` (port 5434), `db-init`; each has correct `depends_on` and `healthcheck`
- [ ] T043 [P] [US1] Verify `services/account-service/Dockerfile` — copies `package*.json`, `tsconfig.base.json`, `services/account-service`, `shared/types`; runs `npm ci`; CMD is `npm run --workspace @cn-banking/account-service dev`
- [ ] T044 [P] [US1] Verify `services/transfer-service/Dockerfile` — same pattern as account-service Dockerfile, but for transfer-service workspace
- [ ] T045 [P] [US1] Verify `infra/db-init/Dockerfile` — PostgreSQL 16-alpine base; copies `init.sh` and `migrations/`; entrypoint runs `init.sh`
- [ ] T046 [P] [US1] Verify `infra/db-init/init.sh` — waits for both postgres instances using `pg_isready`; runs all `.sql` files from `migrations/accounts/` then `migrations/transfers/`

### Account Service Bootstrap (US1)

- [ ] T047 [US1] Create `services/account-service/src/db.ts` — instantiate `pg.Pool` from env vars: `ACCOUNTS_DB_HOST`, `ACCOUNTS_DB_PORT`, `ACCOUNTS_DB_NAME`, `ACCOUNTS_DB_USER`, `ACCOUNTS_DB_PASSWORD`; pool config: `max: 20`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 5000`; export pool as default
- [ ] T048 [US1] Create `services/account-service/src/routes.ts` — Express Router; implement `GET /health` returning `{ success: true, data: { status: 'ok' } }` with status 200; export router
- [ ] T049 [US1] Create `services/account-service/src/index.ts` — create Express app; `app.use(express.json())`; mount router; `app.listen(process.env.ACCOUNT_SERVICE_PORT ?? 3001)`

### Transfer Service Bootstrap (US1)

- [ ] T050 [P] [US1] Create `services/transfer-service/src/db.ts` — instantiate `pg.Pool` from env vars: `TRANSFERS_DB_HOST`, `TRANSFERS_DB_PORT`, `TRANSFERS_DB_NAME`, `TRANSFERS_DB_USER`, `TRANSFERS_DB_PASSWORD`; same pool config as account-service; export pool as default
- [ ] T051 [P] [US1] Create `services/transfer-service/src/routes.ts` — Express Router; implement `GET /health` returning `{ success: true, data: { status: 'ok' } }` with status 200; export router
- [ ] T052 [P] [US1] Create `services/transfer-service/src/index.ts` — create Express app; `app.use(express.json())`; mount router; `app.listen(process.env.TRANSFER_SERVICE_PORT ?? 3002)`

### Developer Tooling (US1)

- [ ] T053 [US1] Verify `Makefile` — four targets present: `up` runs `docker compose up --build -d`, `test` runs `npm run test`, `down` runs `docker compose down -v`, `logs` runs `docker compose logs -f`
- [ ] T054 [US1] Update `README.md` — ensure local setup section shows exactly three commands: `cp .env.example .env`, `npm install`, `make up`; ensure environment variable table includes all 14 vars from `.env.example`; remove any references to obsolete Mexo/split ownership or old Phase 1 completion claims

**Checkpoint (US1)**: Run `make up` — all five containers start, db-init exits cleanly, `curl localhost:3001/health` and `curl localhost:3002/health` both return HTTP 200.

---

## Phase 5: User Story 2 — Account Management (Priority: P1)

**Goal**: Operators can create accounts, retrieve them, check balances, and update KYC status. Duplicate emails and invalid inputs are rejected correctly.

**Independent Test**: `POST /v1/accounts` → 201; `GET /v1/accounts/:id` → 200; `GET /v1/accounts/:id/balance` → 200; `PATCH /v1/accounts/:id/kyc` → 200; duplicate email → 409; bad input → 400.

### Account Service — Full Route Implementation (US2)

- [ ] T055 [US2] Add `POST /v1/accounts` to `services/account-service/src/routes.ts` — Zod schema: `{ name: z.string().min(1), email: z.string().email(), initial_balance: z.number().min(0).optional().default(0) }`; INSERT INTO accounts; return 201 with full Account; catch pg error `23505` → return 409 `{ success: false, error: { code: 'CONFLICT', message: '...' } }`
- [ ] T056 [US2] Add `GET /v1/accounts/:id` to `services/account-service/src/routes.ts` — validate `:id` is UUID (regex or `z.string().uuid()`); SELECT FROM accounts WHERE id = $1; return 200 with Account or 404 `{ success: false, error: { code: 'NOT_FOUND', message: 'Account not found' } }`; return 400 if UUID invalid
- [ ] T057 [US2] Add `GET /v1/accounts/:id/balance` to `services/account-service/src/routes.ts` — same UUID validation; SELECT id, balance FROM accounts WHERE id = $1; return 200 `{ success: true, data: { id, balance } }` or 404
- [ ] T058 [US2] Add `PATCH /v1/accounts/:id/kyc` to `services/account-service/src/routes.ts` — Zod schema: `{ kyc_status: z.enum(['pending', 'verified', 'rejected']) }`; UPDATE accounts SET kyc_status = $1, updated_at = now() WHERE id = $2; return 200 with updated Account or 404; return 400 on validation failure
- [ ] T059 [US2] Add `PATCH /v1/accounts/:id/debit` to `services/account-service/src/routes.ts` (internal endpoint — SAGA use only) — Zod schema: `{ amount: z.number().positive() }`; UPDATE accounts SET balance = balance - $1, updated_at = now() WHERE id = $2 RETURNING *; catch pg error `23514` (check_violation) → return 422 `{ success: false, error: { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient balance' } }`; return 200 with updated Account
- [ ] T060 [US2] Add `PATCH /v1/accounts/:id/credit` to `services/account-service/src/routes.ts` (internal endpoint — SAGA use only) — Zod schema: `{ amount: z.number().positive() }`; UPDATE accounts SET balance = balance + $1, updated_at = now() WHERE id = $2 RETURNING *; return 200 with updated Account

### Account Service — Unit Tests (US2)

- [ ] T061 [US2] Create `services/account-service/src/__tests__/routes.test.ts` — set up Jest with `jest.mock('pg')` to mock `pg.Pool`; mock `pool.query` to return configurable results per test
- [ ] T062 [US2] Add test to `routes.test.ts` — `GET /health` returns 200 with `{ success: true, data: { status: 'ok' } }`
- [ ] T063 [P] [US2] Add test to `routes.test.ts` — `POST /v1/accounts` with valid body returns 201 and account object
- [ ] T064 [P] [US2] Add test to `routes.test.ts` — `POST /v1/accounts` with missing name returns 400
- [ ] T065 [P] [US2] Add test to `routes.test.ts` — `POST /v1/accounts` with duplicate email (mock pg error code `23505`) returns 409
- [ ] T066 [P] [US2] Add test to `routes.test.ts` — `GET /v1/accounts/:id` with existing ID returns 200
- [ ] T067 [P] [US2] Add test to `routes.test.ts` — `GET /v1/accounts/:id` with non-existent ID (mock empty rows) returns 404
- [ ] T068 [P] [US2] Add test to `routes.test.ts` — `GET /v1/accounts/:id` with non-UUID string returns 400
- [ ] T069 [P] [US2] Add test to `routes.test.ts` — `GET /v1/accounts/:id/balance` returns 200 with `{ id, balance }`
- [ ] T070 [P] [US2] Add test to `routes.test.ts` — `PATCH /v1/accounts/:id/kyc` with `kyc_status: 'verified'` returns 200
- [ ] T071 [P] [US2] Add test to `routes.test.ts` — `PATCH /v1/accounts/:id/kyc` with invalid status returns 400
- [ ] T072 [P] [US2] Add test to `routes.test.ts` — `PATCH /v1/accounts/:id/debit` success returns 200 with updated account
- [ ] T073 [P] [US2] Add test to `routes.test.ts` — `PATCH /v1/accounts/:id/debit` with pg error `23514` (mock) returns 422 with code `INSUFFICIENT_FUNDS`
- [ ] T074 [P] [US2] Add test to `routes.test.ts` — `PATCH /v1/accounts/:id/credit` success returns 200 with updated account

**Checkpoint (US2)**: `npm run test:unit` passes all account-service tests. All seven endpoints respond correctly to valid and invalid inputs.

---

## Phase 6: User Story 3 — Money Transfers with SAGA (Priority: P1)

**Goal**: Transfers debit source and credit destination atomically. If credit fails after debit, compensation fires automatically. Insufficient funds are rejected cleanly.

**Independent Test**: `POST /v1/transfers` with sufficient funds → 201 status=`completed`; with insufficient funds → 422 and both balances unchanged; force credit failure → status=`failed` and source balance restored.

### Transfer Service — SAGA Orchestrator (US3)

- [ ] T075 [US3] Create `services/transfer-service/src/saga.ts` — define `TransferSaga` class with constructor accepting `pool: pg.Pool` and `httpClient: AxiosInstance`; this injection enables mocking in tests; export class
- [ ] T076 [US3] Implement `TransferSaga.execute(dto: CreateTransferDto): Promise<Transfer>` in `services/transfer-service/src/saga.ts` — Step 1: INSERT INTO transfers (from_account_id, to_account_id, amount, status='initiated', saga_state='{}') RETURNING id; store transferId
- [ ] T077 [US3] Implement Step 2 (debit) in `TransferSaga.execute` — `PATCH {ACCOUNT_SERVICE_URL}/v1/accounts/{from_account_id}/debit` with `{ amount }`; on HTTP 200: UPDATE transfers SET status='debited', saga_state=jsonb_set(saga_state, '{debit_completed}', 'true'), updated_at=now() WHERE id=$1; on failure: UPDATE transfers SET status='failed', saga_state with error message, then throw
- [ ] T078 [US3] Implement Step 3 (credit) in `TransferSaga.execute` — `PATCH {ACCOUNT_SERVICE_URL}/v1/accounts/{to_account_id}/credit` with `{ amount }`; on HTTP 200: UPDATE transfers SET status='completed', saga_state.credit_completed=true, updated_at=now(); return final Transfer; on failure: enter compensation
- [ ] T079 [US3] Implement compensation step in `TransferSaga.execute` — on credit failure: `PATCH {ACCOUNT_SERVICE_URL}/v1/accounts/{from_account_id}/credit` with `{ amount }` (reverses the debit); on compensation success: UPDATE transfers SET status='failed', saga_state.compensation_completed=true, error=<credit-error>; on compensation failure: UPDATE transfers SET status='failed', saga_state.compensation_completed=false, error=<credit-error + compensation-error>; throw with final error message
- [ ] T080 [US3] Add `getTransferById(id: string): Promise<Transfer | null>` method to `TransferSaga` — SELECT * FROM transfers WHERE id = $1; return Transfer or null; used by routes

### Transfer Service — Routes (US3)

- [ ] T081 [US3] Add `POST /v1/transfers` to `services/transfer-service/src/routes.ts` — Zod schema: `{ from_account_id: z.string().uuid(), to_account_id: z.string().uuid(), amount: z.number().positive() }` plus `.refine(dto => dto.from_account_id !== dto.to_account_id)`; instantiate `TransferSaga` with db pool and axios instance; call `saga.execute(dto)`; return 201 with Transfer on success; map SAGA errors: 422 for insufficient funds, 400 for validation, 500 for unexpected
- [ ] T082 [US3] Add `GET /v1/transfers/:id` to `services/transfer-service/src/routes.ts` — validate `:id` is UUID; call `saga.getTransferById(id)`; return 200 with Transfer or 404; return 400 if UUID invalid

### Required Unit Tests — FR-027 (US3)

- [ ] T083 [US3] Create `services/transfer-service/src/__tests__/saga.test.ts` — set up Jest with `jest.mock('pg')` and mock `pool.query`; mock axios instance with `jest.fn()` returning configurable responses; create `TransferSaga` with mocked dependencies
- [ ] T084 [US3] **[FR-027 REQUIRED]** Add test to `saga.test.ts` — "compensation fires when credit step throws": mock debit → HTTP 200 (success); mock credit → HTTP 422 (failure); mock compensation credit back → HTTP 200 (success); assert debit was called once; assert credit was called once; assert compensation (credit source back) was called once; assert final transfer status is `'failed'`; assert `saga_state.debit_completed === true`; assert `saga_state.credit_completed === false`; assert `saga_state.compensation_completed === true`
- [ ] T085 [P] [US3] Add test to `saga.test.ts` — "happy path completes successfully": mock debit → 200, credit → 200; assert status is `'completed'`; assert `saga_state.debit_completed === true`; assert `saga_state.credit_completed === true`; assert `saga_state.compensation_completed === false`
- [ ] T086 [P] [US3] Add test to `saga.test.ts` — "debit failure marks transfer failed without compensation": mock debit → HTTP 422; assert status is `'failed'`; assert `saga_state.debit_completed === false`; assert compensation (credit source back) was NOT called
- [ ] T087 [P] [US3] Add test to `saga.test.ts` — "compensation failure records both errors": mock debit → 200, credit → 422, compensation → 500; assert status is `'failed'`; assert `saga_state.compensation_completed === false`; assert error message contains both credit failure and compensation failure details

**Checkpoint (US3 unit)**: `npm run test:unit` passes all transfer-service SAGA tests including FR-027.

---

## Phase 7: Integration Tests (All US — Required by Spec)

**Purpose**: Validate full Express routing, middleware, and error handling across the complete HTTP stack. These three tests are required for Phase 1 completion.

- [ ] T088 Create `tests/integration/transfer.test.ts` — set up Jest with Supertest; mock `pg.Pool` at module level; mock `axios` module to return configurable responses per test; import and mount the transfer-service Express app
- [ ] T089 **[FR-028 REQUIRED]** Add test to `transfer.test.ts` — "insufficient funds returns 422 and both balances are unchanged": mock account balance lookup returning insufficient balance; mock debit endpoint returning 422; `POST /v1/transfers` with amount exceeding balance; assert response status is 422; assert response body has `error.code: 'INSUFFICIENT_FUNDS'`; assert source account balance is unchanged (re-query mock); assert destination account balance is unchanged (re-query mock)
- [ ] T090 **[FR-029 REQUIRED]** Add test to `transfer.test.ts` — "happy-path transfer updates both balances atomically": mock source account with balance 1000; mock debit returning success with balance reduced to 750; mock credit returning success with destination balance increased; `POST /v1/transfers { from_account_id, to_account_id, amount: 250 }`; assert response status is 201; assert transfer status is `'completed'`; assert source balance is 750; assert destination balance is increased by 250
- [ ] T091 [P] Add test to `transfer.test.ts` — "self-transfer returns 400": `POST /v1/transfers` with `from_account_id === to_account_id`; assert response status is 400
- [ ] T092 [P] Add test to `transfer.test.ts` — "invalid UUID returns 400": `GET /v1/transfers/not-a-uuid`; assert response status is 400
- [ ] T093 [P] Add test to `transfer.test.ts` — "transfer not found returns 404": `GET /v1/transfers/{valid-uuid-not-in-db}`; mock empty DB result; assert response status is 404

**Checkpoint (Integration)**: `npm run test:integration` passes all six integration tests including FR-028 and FR-029.

---

## Phase 8: Database Schemas & Migrations Verification

**Purpose**: Confirm migration SQL files are correct and idempotent. These files should already be correct per the audit.

- [ ] T094 [P] Verify `infra/db-init/migrations/accounts/001_create_accounts.sql` — contains `CREATE TABLE IF NOT EXISTS accounts`; columns match data-model.md exactly: `id UUID DEFAULT gen_random_uuid()`, `balance NUMERIC(18,2) CHECK (balance >= 0)`, `kyc_status VARCHAR(16) DEFAULT 'pending'`, `email VARCHAR(255) UNIQUE`, timestamps `TIMESTAMPTZ`; `updated_at` trigger present
- [ ] T095 [P] Verify `infra/db-init/migrations/transfers/001_create_transfers.sql` — contains `CREATE TABLE IF NOT EXISTS transfers`; columns: `amount NUMERIC(18,2) CHECK (amount > 0)`, `status VARCHAR(24) DEFAULT 'initiated'`, `saga_state JSONB NOT NULL DEFAULT '{}'`, `CHECK (from_account_id <> to_account_id)`; `updated_at` trigger present; all idempotent (`IF NOT EXISTS`)

**Checkpoint**: Both migration files are correct. `make up` applies them cleanly via db-init.

---

## Phase 9: Final Verification

**Purpose**: End-to-end validation that Phase 1 meets all acceptance criteria from the spec.

### Static Analysis

- [ ] T096 Run `npm run typecheck` from repo root — must exit 0 with zero TypeScript errors across all workspaces (account-service, transfer-service, shared-types)
- [ ] T097 Run `npm run lint` from repo root — must exit 0 with zero ESLint errors across all workspaces
- [ ] T098 Run `npm run build` from repo root — TypeScript compilation must succeed for all workspaces

### Full Test Suite

- [ ] T099 Run `npm test` from repo root — all unit tests (account-service routes, transfer-service saga) and all integration tests (transfer flow) must pass; FR-027, FR-028, FR-029 all green

### Docker Stack Verification

- [ ] T100 Run `make up` — all five containers must reach healthy status; db-init must exit 0 (migrations applied); account-service and transfer-service must show healthy in `docker compose ps`
- [ ] T101 Smoke test: `curl -s http://localhost:3001/health` → `{ "success": true, "data": { "status": "ok" } }` with HTTP 200
- [ ] T102 Smoke test: `curl -s http://localhost:3002/health` → `{ "success": true, "data": { "status": "ok" } }` with HTTP 200
- [ ] T103 Smoke test: Create two accounts via `POST http://localhost:3001/v1/accounts` with initial_balance 1000 each → both return 201 with unique IDs
- [ ] T104 Smoke test: `POST http://localhost:3002/v1/transfers` with amount 200 between the two accounts → 201, status=`completed`, source balance 800, destination balance 1200
- [ ] T105 Run `make down` — all containers and volumes removed cleanly; `docker compose ps` shows no running containers

**Checkpoint**: All five containers start cleanly, all three required tests pass, typecheck and lint are clean. Phase 1 is complete and the merge gate is satisfied.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Cleanup)**: No dependencies — start immediately
- **Phase 2 (Workspace Verification)**: Can run in parallel with Phase 1 after T023–T026 pass
- **Phase 3 (Shared Types)**: Requires Phase 1 complete (T025 verified clean)
- **Phase 4 (US1 Infrastructure)**: Requires Phase 3 complete (T041 passes)
- **Phase 5 (US2 Account Service)**: Requires Phase 4 complete (health endpoints work, db.ts exists)
- **Phase 6 (US3 Transfer Service)**: Requires Phase 5 complete (debit/credit endpoints exist)
- **Phase 7 (Integration Tests)**: Requires Phase 5 and Phase 6 complete
- **Phase 8 (Migration Verification)**: Can run in parallel with Phases 5–7
- **Phase 9 (Final Verification)**: Requires all prior phases complete

### User Story Dependencies

- **US1 (System Startup)**: Requires Phase 1 + Phase 2 + Phase 3 → Phase 4
- **US2 (Account Management)**: Requires US1 complete → Phase 5
- **US3 (Transfers)**: Requires US2 complete (debit/credit endpoints must exist) → Phase 6 + Phase 7

### Critical Path

```
T001–T026 (Cleanup & Verify)
  → T035–T041 (Shared Types)
    → T047–T054 (US1: Health + Makefile + README)
      → T055–T074 (US2: Account Service)
        → T075–T093 (US3: Transfer Service + All Tests)
          → T094–T105 (Verification)
```

---

## Parallel Opportunities

### Within Phase 1

Tasks T011–T022 (delete tests and artifacts) can all run in parallel after T001–T010 complete.

### Within Phase 3 (Shared Types)

Tasks T035–T040 build the same file sequentially; T041 (typecheck) runs after all are complete.

### Within Phase 4 (US1)

Account-service bootstrap (T047–T049) and transfer-service bootstrap (T050–T052) can run in parallel after T035–T041 complete.

### Within Phase 5 (US2)

Account unit test cases T063–T074 are all independent and can be written in parallel (all in the same file, but each `it()` block is standalone).

### Within Phase 6 (US3)

SAGA saga.test.ts cases T085–T087 can be written in parallel after T083–T084 establish the test harness.

Integration test cases T091–T093 can be written in parallel after T088–T090 establish the test harness.

### Phase 8

T094 and T095 (migration verification) can run fully in parallel with Phases 5–7.

---

## Implementation Strategy

### MVP (US1 only)

1. Complete Phase 1 (Cleanup)
2. Complete Phase 2 (Workspace Verification)
3. Complete Phase 3 (Shared Types)
4. Complete Phase 4 through T053/T054 (US1: health endpoints, Makefile, README)
5. **STOP and validate**: `make up` → both health endpoints return 200

### Incremental Delivery

1. MVP → `make up` works, health endpoints green
2. Add Phase 5 → account creation and retrieval work end-to-end
3. Add Phase 6 → transfers with SAGA work end-to-end
4. Add Phase 7 → all three required tests pass
5. Final Phase 9 → typecheck, lint, full test suite, smoke test

---

## Notes

- Tasks marked [P] involve different files or independent `it()` blocks — safe to implement concurrently
- The three required tests (T084, T089, T090) are non-negotiable — Phase 1 is not complete without them
- Do not modify `docker-compose.yml`, migration SQL files, or any Dockerfile during implementation — they are correct as verified in Phase 2 and Phase 8
- Do not introduce any Phase 2+ dependencies (Kafka, Redis, auth middleware, etc.)
- Commit after each phase checkpoint at minimum
