# Implementation Plan: Phase 1 — Cloud-Native Banking Transaction System

**Branch**: `001-phase-1-rebuild` | **Date**: 2026-03-17 | **Spec**: [spec.md](spec.md)
**Owner**: Sam (full Phase 1 end-to-end)

---

## Summary

Rebuild Phase 1 of the CN Banking Transaction System cleanly under single ownership. Before any code is written, all stale Phase 1 artifacts from the obsolete Mexo/Sam split must be deleted. Phase 1 delivers: a monorepo with two microservices (account-service, transfer-service), shared TypeScript interfaces, PostgreSQL schemas, a SAGA-based transfer flow with compensation, and a Docker Compose stack that starts cleanly in one command. Three specific tests are required: unit (compensation fires), integration (insufficient funds → 422, balances unchanged), integration (happy path → both balances update).

---

## Technical Context

**Language/Version**: TypeScript 5.8, Node.js 22
**Primary Dependencies**: Express 4, pg (PostgreSQL client), Zod (validation), axios (HTTP client), Jest + ts-jest (tests), tsx (dev runner)
**Storage**: PostgreSQL 16 — two separate instances (accounts_db, transfers_db)
**Testing**: Jest 29 with ts-jest; unit and integration tiers
**Target Platform**: Docker Compose (local dev); Linux containers (node:22-alpine)
**Project Type**: Microservices / web-service (REST APIs)
**Performance Goals**: Not specified for Phase 1; correctness is the priority
**Constraints**: `docker-compose up --build` must start cleanly (merge gate); `balance >= 0` enforced at DB level
**Scale/Scope**: Two services, two databases, one shared types package; Phase 1 only

---

## Constitution Check

The project constitution (`/.specify/memory/constitution.md`) is a blank template — no project-specific principles have been ratified. No constitution-based gates apply. The following engineering minimums are self-imposed for this plan:

- All three required tests must pass before marking Phase 1 complete
- No Phase 2+ dependencies (Kafka, Redis, auth, k8s, CI/CD) may be introduced
- `npm run lint` and `npm run typecheck` must pass with zero errors
- Merge gate: `docker-compose up --build` starts cleanly

---

## Project Structure

### Documentation (this feature)

```text
specs/001-phase-1-rebuild/
├── plan.md              ← this file
├── research.md          ← technical decisions
├── data-model.md        ← entity schemas and TypeScript interfaces
├── quickstart.md        ← local dev guide
├── contracts/
│   └── api-contracts.md ← full REST endpoint contracts
├── checklists/
│   └── requirements.md  ← spec quality checklist
└── tasks.md             ← created by /speckit.tasks
```

### Source Code (repository root) — Target State After Phase 1

```text
/                                    ← repo root
├── .env
├── .env.example
├── .gitignore
├── .npmrc
├── CLAUDE.md
├── Makefile
├── README.md
├── docker-compose.yml
├── eslint.config.mjs
├── jest.config.ts
├── package.json
├── tsconfig.base.json
│
├── infra/
│   └── db-init/
│       ├── Dockerfile
│       ├── init.sh
│       └── migrations/
│           ├── accounts/
│           │   └── 001_create_accounts.sql
│           └── transfers/
│               └── 001_create_transfers.sql
│
├── services/
│   ├── account-service/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts         ← Express app entrypoint
│   │       ├── db.ts            ← PostgreSQL pool
│   │       ├── routes.ts        ← All endpoints
│   │       └── __tests__/
│   │           └── routes.test.ts  ← Unit tests (mocked DB)
│   │
│   └── transfer-service/
│       ├── Dockerfile
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts         ← Express app entrypoint
│           ├── db.ts            ← PostgreSQL pool
│           ├── routes.ts        ← Transfer endpoints
│           ├── saga.ts          ← SAGA orchestrator + compensation
│           └── __tests__/
│               └── saga.test.ts ← Unit tests (mocked axios + DB)
│
├── shared/
│   └── types/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts         ← Account, Transfer, SagaState, DTOs, enums
│
└── tests/
    └── integration/
        └── transfer.test.ts     ← Jest integration tests (3 required tests)
```

**Structure Decision**: Monorepo with npm workspaces. Three packages: `@cn-banking/account-service`, `@cn-banking/transfer-service`, `@cn-banking/shared-types`. No additional build tooling beyond native npm workspaces.

---

## Step 0: Repo Audit & Cleanup

This must be completed before any new code is written.

### Files to DELETE

| Path | Reason |
|------|--------|
| `services/account-service/src/index.ts` | Mexo Phase 1 artifact |
| `services/account-service/src/db.ts` | Mexo Phase 1 artifact |
| `services/account-service/src/routes.ts` | Mexo Phase 1 artifact |
| `services/account-service/src/schema.sql` | Mexo Phase 1 artifact (migration lives in infra/) |
| `services/account-service/src/__tests__/routes.test.ts` | Mexo Phase 1 artifact |
| `services/transfer-service/src/index.ts` | Mexo Phase 1 artifact |
| `services/transfer-service/src/db.ts` | Mexo Phase 1 artifact |
| `services/transfer-service/src/routes.ts` | Mexo Phase 1 artifact |
| `services/transfer-service/src/saga.ts` | Mexo Phase 1 artifact |
| `services/transfer-service/src/schema.sql` | Mexo Phase 1 artifact |
| `services/transfer-service/src/__tests__/saga.test.ts` | Mexo Phase 1 artifact |
| `shared/types/src/index.ts` | Mexo Phase 1 artifact — rebuild from data-model.md |
| `tests/integration/_helpers.mjs` | Mexo Phase 1 artifact |
| `tests/integration/api-contract.test.mjs` | Mexo Phase 1 artifact |
| `tests/integration/db-schema.test.mjs` | Mexo Phase 1 artifact |
| `tests/integration/health.test.mjs` | Mexo Phase 1 artifact |
| `tests/integration/transfer.test.ts` | Mexo Phase 1 artifact — rebuild to meet spec requirements |
| `Artifacts/PLAN.md` | Obsolete split plan |
| `Artifacts/Sam/phase-1-implementation-plan.md` | Obsolete partial scope plan |
| `services/account-service/dist/` | Stale build artifact |
| `services/transfer-service/dist/` | Stale build artifact |
| `shared/types/dist/` | Stale build artifact |

### Files to KEEP (no changes required)

| Path | Reason |
|------|--------|
| `docker-compose.yml` | Correct — five services, health checks, dependencies |
| `Makefile` | Correct — four targets match spec |
| `.env.example` | Correct — all env vars documented |
| `.env` | Correct — local defaults |
| `.gitignore` | Correct |
| `.npmrc` | Correct |
| `package.json` | Correct — workspaces, all scripts |
| `tsconfig.base.json` | Correct — path alias, strict settings |
| `jest.config.ts` | Correct — ts-jest, module name mapper |
| `eslint.config.mjs` | Correct — TypeScript ESLint rules |
| `infra/db-init/Dockerfile` | Correct |
| `infra/db-init/init.sh` | Correct — waits for DBs, runs migrations |
| `infra/db-init/migrations/accounts/001_create_accounts.sql` | Correct — matches spec schema |
| `infra/db-init/migrations/transfers/001_create_transfers.sql` | Correct — matches spec schema |
| `services/account-service/Dockerfile` | Correct |
| `services/account-service/package.json` | Correct |
| `services/account-service/tsconfig.json` | Correct |
| `services/transfer-service/Dockerfile` | Correct |
| `services/transfer-service/package.json` | Correct |
| `services/transfer-service/tsconfig.json` | Correct |
| `shared/types/package.json` | Correct |
| `shared/types/tsconfig.json` | Correct |
| `Artifacts/docs/` | Reference documentation — keep |
| `.specify/` | Tooling — keep |
| `.claude/` | Tooling — keep |
| `specs/` | Specifications — keep |
| `CLAUDE.md` | Update after implementation (remove stale phase status) |
| `README.md` | Verify still accurate after rebuild; update if needed |

### Directories to CREATE (new, not present)

| Path | Reason |
|------|--------|
| `services/account-service/src/__tests__/` | New test directory |
| `services/transfer-service/src/__tests__/` | New test directory |

---

## Step 1: Shared Types

**File**: `shared/types/src/index.ts`

Implement all interfaces, DTOs, and type aliases from `data-model.md`:
- `ApiResponse<T>`
- `Account`
- `Transfer`
- `SagaState`
- `CreateAccountDto`, `UpdateKycDto`, `CreateTransferDto`
- `KycStatus`, `AccountStatus`, `TransferStatus`

**Verify**: `npm run typecheck --workspace @cn-banking/shared-types` passes.

---

## Step 2: Account Service

### Step 2a: `services/account-service/src/db.ts`

PostgreSQL connection pool using `pg.Pool`. Reads env vars: `ACCOUNTS_DB_HOST`, `ACCOUNTS_DB_PORT`, `ACCOUNTS_DB_NAME`, `ACCOUNTS_DB_USER`, `ACCOUNTS_DB_PASSWORD`. Pool config: max 20, idleTimeoutMillis 30000, connectionTimeoutMillis 5000.

### Step 2b: `services/account-service/src/routes.ts`

Express router. Implement all endpoints per `contracts/api-contracts.md`:

| Endpoint | Logic |
|----------|-------|
| `GET /health` | Return `{ success: true, data: { status: 'ok' } }` |
| `POST /v1/accounts` | Zod validate body; INSERT; return 201 |
| `GET /v1/accounts/:id` | UUID validate; SELECT; return 200 or 404 |
| `GET /v1/accounts/:id/balance` | UUID validate; SELECT id, balance; return 200 or 404 |
| `PATCH /v1/accounts/:id/kyc` | Zod validate body; UPDATE; return 200 |
| `PATCH /v1/accounts/:id/debit` | Zod validate amount; UPDATE balance - amount; catch 23514 → 422 |
| `PATCH /v1/accounts/:id/credit` | Zod validate amount; UPDATE balance + amount; return 200 |

Error handling:
- pg error `23505` (unique_violation) → 409
- pg error `23514` (check_violation) → 422
- Not found → 404
- Validation failure → 400

### Step 2c: `services/account-service/src/index.ts`

Bootstrap Express app: `express()`, `app.use(express.json())`, mount router, `app.listen(ACCOUNT_SERVICE_PORT)`.

### Step 2d: `services/account-service/src/__tests__/routes.test.ts`

Jest unit tests with mocked `pg.Pool`. Cover:
- Health returns 200
- Create account (201, 400 missing fields, 409 duplicate email)
- Get account (200, 404)
- Get balance (200, 404)
- KYC update (200, 400 invalid status)
- Debit (200, 422 insufficient via pg 23514 mock)
- Credit (200)

---

## Step 3: Transfer Service

### Step 3a: `services/transfer-service/src/db.ts`

PostgreSQL connection pool using env vars: `TRANSFERS_DB_HOST`, `TRANSFERS_DB_PORT`, `TRANSFERS_DB_NAME`, `TRANSFERS_DB_USER`, `TRANSFERS_DB_PASSWORD`. Same pool config as account service.

### Step 3b: `services/transfer-service/src/saga.ts`

`TransferSaga` class. Constructor accepts a PostgreSQL pool and an HTTP client (axios instance) — injection enables unit testing.

**State machine**:

```
execute(dto: CreateTransferDto): Promise<Transfer>

Step 1 — Create record
  INSERT transfers (from_account_id, to_account_id, amount, status='initiated', saga_state={})
  → store transfer.id

Step 2 — Debit source
  PATCH /v1/accounts/{from}/debit { amount }
  On success: UPDATE transfers SET status='debited', saga_state.debit_completed=true
  On failure: UPDATE transfers SET status='failed', saga_state.error=<msg>
              → throw (no compensation needed)

Step 3 — Credit destination
  PATCH /v1/accounts/{to}/credit { amount }
  On success: UPDATE transfers SET status='completed', saga_state.credit_completed=true
              → return transfer
  On failure: → enter compensation

Compensation — Reverse debit
  PATCH /v1/accounts/{from}/credit { amount }   ← reverses the debit
  On success: UPDATE transfers SET status='failed',
                saga_state.compensation_completed=true,
                saga_state.error=<credit-error>
  On failure: UPDATE transfers SET status='failed',
                saga_state.compensation_completed=false,
                saga_state.error=<credit-error + compensation-error>
  → throw with final error
```

### Step 3c: `services/transfer-service/src/routes.ts`

Express router:

| Endpoint | Logic |
|----------|-------|
| `GET /health` | Return `{ success: true, data: { status: 'ok' } }` |
| `POST /v1/transfers` | Zod validate (UUID fields, amount > 0, from ≠ to); instantiate TransferSaga; call execute; return 201 or propagate errors |
| `GET /v1/transfers/:id` | UUID validate; SELECT; return 200 or 404 |

Map SAGA errors to HTTP responses:
- Insufficient funds (caught from account service 422) → 422
- Account not found → 404
- Validation → 400

### Step 3d: `services/transfer-service/src/index.ts`

Bootstrap Express app: mount router, listen on `TRANSFER_SERVICE_PORT`.

### Step 3e: `services/transfer-service/src/__tests__/saga.test.ts`

Jest unit tests with mocked axios + mocked `pg.Pool`. **Required test** (FR-027):

```typescript
it('fires compensation when credit step throws', async () => {
  // Mock: debit succeeds (200), credit throws, compensation (credit source) succeeds
  // Assert:
  //   - debit was called once
  //   - credit (destination) was called once
  //   - compensation (credit source back) was called once
  //   - final transfer status is 'failed'
  //   - saga_state.debit_completed = true
  //   - saga_state.credit_completed = false
  //   - saga_state.compensation_completed = true
})
```

Also cover: happy path, debit failure (no compensation), compensation failure.

---

## Step 4: Integration Tests

**File**: `tests/integration/transfer.test.ts`

Jest integration tests. Uses mocked axios and mocked `pg.Pool` to test the full Express layer end-to-end.

**Required test 1** (FR-028):
```typescript
it('returns 422 and leaves both balances unchanged when source has insufficient funds', async () => {
  // Setup: mock debit returning 422 (pg check_violation or service 422)
  // POST /v1/transfers
  // Assert: response.status === 422
  // Assert: balance of source account unchanged
  // Assert: balance of destination account unchanged
})
```

**Required test 2** (FR-029):
```typescript
it('debits source and credits destination atomically on happy path', async () => {
  // Setup: mock accounts with balances, mock debit + credit succeeding
  // POST /v1/transfers { amount: 250 }
  // Assert: response.status === 201
  // Assert: source balance decreased by 250
  // Assert: destination balance increased by 250
  // Assert: transfer status === 'completed'
})
```

Additional tests: self-transfer (400), invalid UUID (400), transfer not found (404).

---

## Step 5: Verification

Run these commands in order to confirm Phase 1 is complete:

```bash
# 1. Type check — must pass with zero errors
npm run typecheck

# 2. Lint — must pass with zero errors
npm run lint

# 3. Unit + integration tests
npm test

# 4. Build (validates compilation)
npm run build

# 5. Full Docker stack
make up

# 6. Smoke test health endpoints
curl http://localhost:3001/health   # → 200 { success: true }
curl http://localhost:3002/health   # → 200 { success: true }

# 7. Teardown
make down
```

All six steps must succeed. Step 5 (`make up`) is the merge gate.

---

## Migration Plan

No new migrations needed. The existing SQL files in `infra/db-init/migrations/` are correct:

- `migrations/accounts/001_create_accounts.sql` — creates `accounts` table with all required fields and constraints
- `migrations/transfers/001_create_transfers.sql` — creates `transfers` table with JSONB `saga_state` and all constraints

Both migrations are idempotent (`IF NOT EXISTS`). The `db-init` container and `init.sh` script are also correct and require no changes.

---

## Endpoint Plan

### Account Service (port 3001)

| Method | Path | Status Codes | Notes |
|--------|------|-------------|-------|
| GET | `/health` | 200 | |
| POST | `/v1/accounts` | 201, 400, 409 | Zod validation |
| GET | `/v1/accounts/:id` | 200, 400, 404 | UUID validation |
| GET | `/v1/accounts/:id/balance` | 200, 400, 404 | |
| PATCH | `/v1/accounts/:id/kyc` | 200, 400, 404 | |
| PATCH | `/v1/accounts/:id/debit` | 200, 400, 404, 422 | Internal (SAGA only) |
| PATCH | `/v1/accounts/:id/credit` | 200, 400, 404 | Internal (SAGA only) |

### Transfer Service (port 3002)

| Method | Path | Status Codes | Notes |
|--------|------|-------------|-------|
| GET | `/health` | 200 | |
| POST | `/v1/transfers` | 201, 400, 422 | SAGA orchestration |
| GET | `/v1/transfers/:id` | 200, 400, 404 | Includes saga_state |

---

## Test Plan

| Test | Type | File | Required |
|------|------|------|----------|
| Health endpoints return 200 | Unit | `account-service/__tests__/routes.test.ts` | No |
| Create account validation | Unit | `account-service/__tests__/routes.test.ts` | No |
| Duplicate email returns 409 | Unit | `account-service/__tests__/routes.test.ts` | No |
| Debit returns 422 on insufficient funds | Unit | `account-service/__tests__/routes.test.ts` | No |
| **Compensation fires when credit throws** | Unit | `transfer-service/__tests__/saga.test.ts` | **Yes (FR-027)** |
| SAGA happy path | Unit | `transfer-service/__tests__/saga.test.ts` | No |
| Debit failure — no compensation | Unit | `transfer-service/__tests__/saga.test.ts` | No |
| Compensation failure recorded | Unit | `transfer-service/__tests__/saga.test.ts` | No |
| **Insufficient funds → 422, balances unchanged** | Integration | `tests/integration/transfer.test.ts` | **Yes (FR-028)** |
| **Happy path → both balances update** | Integration | `tests/integration/transfer.test.ts` | **Yes (FR-029)** |
| Self-transfer → 400 | Integration | `tests/integration/transfer.test.ts` | No |

---

## Acceptance Criteria

Phase 1 is complete when all of the following are true:

1. `make up` completes without error; both health endpoints return 200
2. `npm test` passes — all three required tests pass (FR-027, FR-028, FR-029)
3. `npm run typecheck` exits 0 — zero TypeScript errors
4. `npm run lint` exits 0 — zero ESLint errors
5. `make down` cleans up all containers and volumes
6. No Phase 2+ code exists in the repository

---

## Assumptions & Risks

### Assumptions

1. The `dist/` directories from the old implementation will not interfere after deletion — `npm ci` in the Docker build will regenerate them if needed.
2. `jest.config.ts` module name mapper already handles `@cn-banking/shared-types` — no changes needed.
3. The existing `docker-compose.yml` health check timing (10s interval, 10 retries) is sufficient for postgres startup on developer machines.
4. `tsx watch` in the Docker CMD is appropriate for Phase 1 dev containers (not a production build).

### Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `package-lock.json` conflicts after deleting node_modules | Low | Run `npm install` from root after cleanup |
| Stale `dist/` referenced by Docker layer cache | Low | `make down` removes volumes; `docker compose build --no-cache` if needed |
| Windows line endings in `init.sh` cause bash errors in Alpine | Medium | Ensure `.gitattributes` enforces LF for `.sh` files, or run `dos2unix` |
| TypeScript strict mode reveals issues in kept config files | Low | All kept config files have been audited; strict mode is already `noImplicitAny` not full strict |

---

## Complexity Tracking

No constitution violations. All patterns are standard for a two-service monorepo:
- SAGA orchestration is the minimum viable pattern for cross-service transactions without Kafka
- Two databases are required by the domain (separate service ownership)
- JSONB saga_state is simpler than a separate state table for Phase 1 volume

---

## Handoff to `/speckit.tasks` and `/speckit.implement`

### What `/speckit.tasks` should generate

Tasks must be ordered by dependency and broken into atomic implementation units. Suggested groupings:

1. **Cleanup** — delete all files in the DELETE list above; verify repo state
2. **Shared types** — implement `shared/types/src/index.ts`
3. **Account service core** — `db.ts`, `routes.ts`, `index.ts`
4. **Account service tests** — `__tests__/routes.test.ts`
5. **Transfer service core** — `db.ts`, `saga.ts`, `routes.ts`, `index.ts`
6. **Transfer service tests** — `__tests__/saga.test.ts`
7. **Integration tests** — `tests/integration/transfer.test.ts`
8. **Verification** — run all checks and smoke test

### What `/speckit.implement` must not do

- Must not introduce any Phase 2+ dependencies
- Must not modify `docker-compose.yml`, `Makefile`, migration SQL files, or any Dockerfile (already correct)
- Must not preserve any deleted code
- Must not skip the cleanup step — cleanup is Step 0, not optional
- Must treat the three required tests (FR-027, FR-028, FR-029) as non-negotiable deliverables

### Reference artifacts

| Artifact | Purpose |
|----------|---------|
| `specs/001-phase-1-rebuild/spec.md` | Authoritative requirements |
| `specs/001-phase-1-rebuild/data-model.md` | Entity schemas and TypeScript interfaces |
| `specs/001-phase-1-rebuild/contracts/api-contracts.md` | Full endpoint contracts with request/response examples |
| `specs/001-phase-1-rebuild/research.md` | Technical decisions and rationale |
| `specs/001-phase-1-rebuild/quickstart.md` | Local dev commands and smoke test |
