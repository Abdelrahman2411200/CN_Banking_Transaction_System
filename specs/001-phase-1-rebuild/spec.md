# Feature Specification: Phase 1 — Cloud-Native Banking Transaction System

**Feature Branch**: `001-phase-1-rebuild`
**Created**: 2026-03-17
**Status**: Draft
**Owner**: Sam (full Phase 1 end-to-end)

## Context & Cleanup Requirement

The existing repository contains stale Phase 1 artifacts from a now-obsolete two-contributor split. That split is cancelled. Sam owns all Phase 1 work end-to-end.

**Before any implementation begins**, the following cleanup is required:

- Remove all Mexo Phase 1 implementation files (account-service business logic, transfer-service business logic, SAGA implementation, and related tests).
- Remove or replace all Sam Phase 1 partial files that conflict with a clean rebuild.
- Remove `Artifacts/PLAN.md` and `Artifacts/Sam/phase-1-implementation-plan.md` — both are obsolete.
- Do not preserve old Phase 1 code simply because it exists. The goal is a clean, single-owner rebuild from scratch.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Developer Starts the Full System Locally (Priority: P1)

A developer clones the repository and brings up the entire banking system — both services, both databases, and migrations — with a single command. They can verify the system is healthy immediately after startup and tear it down cleanly when done.

**Why this priority**: Everything else depends on the system starting cleanly. This is the merge gate for Phase 1.

**Independent Test**: Run `make up`, then check `localhost:3001/health` and `localhost:3002/health` — both return HTTP 200.

**Acceptance Scenarios**:

1. **Given** a clean clone with a `.env` file, **When** the developer runs `make up`, **Then** all containers start without error, both databases are initialized with their schemas, and both services pass their health checks within 60 seconds.
2. **Given** the system is running, **When** the developer runs `make down`, **Then** all containers and volumes are removed cleanly.
3. **Given** the system is running, **When** the developer runs `make logs`, **Then** a live log stream from all services is displayed.
4. **Given** the system is running, **When** the developer runs `make test`, **Then** the full test suite executes and results are reported.
5. **Given** a developer without prior context, **When** they read the root README, **Then** they can set up and run the system using the three documented commands plus the env variable reference.

---

### User Story 2 — Account Holder Creates and Manages a Bank Account (Priority: P1)

A bank customer (or an operator acting on their behalf) opens a new account, retrieves account details, updates KYC status, and checks their balance.

**Why this priority**: Accounts must exist before transfers can happen. This is the foundational domain entity for the entire system.

**Independent Test**: POST to `/v1/accounts` and GET the returned account ID — the account is retrievable with correct fields and a non-negative balance.

**Acceptance Scenarios**:

1. **Given** a valid name, email, and initial balance, **When** a create-account request is submitted, **Then** the system returns 201 with the new account including a unique ID, the provided data, and a balance matching the initial deposit.
2. **Given** an existing account ID, **When** a get-account request is submitted, **Then** the system returns 200 with the full account record.
3. **Given** an existing account ID, **When** a get-balance request is submitted, **Then** the system returns 200 with only the current balance.
4. **Given** an existing account ID and a valid KYC status value, **When** a KYC update request is submitted, **Then** the system returns 200 with the updated KYC status.
5. **Given** a create-account request with a duplicate email, **When** submitted, **Then** the system returns 409 and no account is created.
6. **Given** a create-account request with missing or malformed required fields, **When** submitted, **Then** the system returns 400 before any database operation.

---

### User Story 3 — Bank Customer Transfers Money Between Accounts (Priority: P1)

A bank customer initiates a transfer from one account to another. The system debits the source and credits the destination as a coordinated operation. If anything goes wrong after the debit succeeds, the debit is automatically reversed so no money is lost.

**Why this priority**: The core transactional capability of the system. Correctness — especially the compensation path — is non-negotiable.

**Independent Test**: Create two accounts, POST a transfer, then GET both account balances — source is debited and destination is credited by the exact amount.

**Acceptance Scenarios**:

1. **Given** two accounts with sufficient funds in the source, **When** a transfer is initiated, **Then** the transfer record is created, source balance decreases by the amount, destination balance increases by the amount, and the transfer status is `completed`.
2. **Given** a transfer where the credit step fails after the debit step succeeds, **When** the failure occurs, **Then** the system automatically reverses the debit (compensation fires), both balances return to their pre-transfer values, and the transfer status is `failed`.
3. **Given** a source account with insufficient funds, **When** a transfer is initiated, **Then** the system returns 422, neither balance is modified, and the transfer is marked `failed`.
4. **Given** an existing transfer ID, **When** a get-transfer request is submitted, **Then** the system returns the transfer record including its current status and full SAGA state history.
5. **Given** a transfer request where source and destination are the same account, **When** submitted, **Then** the system returns 400 and no transfer record is created.

---

### Edge Cases

- What happens when a debit or credit targets a non-existent account ID? → 404 is returned; no state is changed.
- What happens when the compensation step itself fails after a failed credit? → The transfer is marked `failed`, both the credit failure and the compensation failure are recorded in the SAGA state for auditability. The inconsistency is surfaced, not silently swallowed.
- What happens when a transfer amount is zero or negative? → Rejected at input validation with 400 before any database or service call.
- What happens when an account ID in the transfer request is not a valid UUID format? → 400 validation error returned immediately.
- What happens when the `balance >= 0` constraint is violated at the database level? → The database rejects the write; the account service translates this to a 422 response.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Monorepo & Tooling

- **FR-001**: The repository MUST use a monorepo structure with `services/`, `shared/`, and `infra/` directories managed as npm workspaces.
- **FR-002**: Shared TypeScript interfaces — `Account`, `Transfer`, and `ApiResponse` — MUST be defined in `shared/types/` and importable by both services via a workspace alias.
- **FR-003**: ESLint and strict TypeScript checking MUST be configured at the repository root and enforced across all packages with zero errors before merge.
- **FR-004**: A root `Makefile` MUST provide exactly four targets: `make up`, `make test`, `make down`, `make logs`.
- **FR-005**: A root `README` MUST describe local setup in three commands and document all required environment variables.

#### Infrastructure

- **FR-006**: A `docker-compose.yml` MUST define exactly five services: `account-service`, `transfer-service`, `postgres-accounts`, `postgres-transfers`, and `db-init`.
- **FR-007**: `postgres-accounts` and `postgres-transfers` MUST be separate database instances, each with a health check that the dependent services wait on.
- **FR-008**: `db-init` MUST run SQL migrations for both databases on container startup, wait for both databases to be healthy before running, and exit cleanly after completion. Migrations MUST be idempotent (`IF NOT EXISTS`).
- **FR-009**: Both `account-service` and `transfer-service` containers MUST declare Docker health checks targeting their `/health` endpoint.

#### Account Service (port 3001)

- **FR-010**: Account service MUST expose `GET /health` returning HTTP 200.
- **FR-011**: Account service MUST expose `POST /v1/accounts` to create a new account; returns 201 on success.
- **FR-012**: Account service MUST expose `GET /v1/accounts/:id` to retrieve an account by ID; returns 404 if not found.
- **FR-013**: Account service MUST expose `GET /v1/accounts/:id/balance` to return the current balance.
- **FR-014**: Account service MUST expose `PATCH /v1/accounts/:id/kyc` to update KYC status; valid values are `pending`, `verified`, and `rejected`.
- **FR-015**: The accounts database schema MUST include a `CHECK` constraint enforcing `balance >= 0` at the database level.
- **FR-016**: Account service MUST return 422 when a debit operation would result in a negative balance.
- **FR-017**: Account service MUST return 409 when account creation is attempted with an email that already exists.
- **FR-018**: Account service MUST validate all inputs and return 400 for missing or malformed fields, including invalid UUID path parameters.

#### Transfer Service (port 3002)

- **FR-019**: Transfer service MUST expose `GET /health` returning HTTP 200.
- **FR-020**: Transfer service MUST expose `POST /v1/transfers` to initiate a transfer; returns 201 on success.
- **FR-021**: Transfer service MUST expose `GET /v1/transfers/:id` to retrieve a transfer record including its SAGA state.
- **FR-022**: Transfer service MUST implement SAGA orchestration in three steps: (1) create transfer record with `initiated` status, (2) debit source account and advance status to `debited`, (3) credit destination account and advance status to `completed`.
- **FR-023**: If the credit step fails after the debit step succeeds, the transfer service MUST execute a compensation step (reverse the debit by crediting the source account back), then mark the transfer `failed`.
- **FR-024**: SAGA state transitions — including which steps completed, which failed, and any error details — MUST be persisted to the transfers database so the full history is auditable after the fact.
- **FR-025**: Transfer service MUST reject self-transfers (source and destination are the same account) with 400.
- **FR-026**: Transfer service MUST reject transfer amounts that are zero or negative with 400.

#### Tests

- **FR-027**: A unit test MUST verify that the compensation step (debit reversal) fires correctly when the credit step throws an error, and that the correct sequence of service calls is made.
- **FR-028**: An integration test MUST verify that a transfer with insufficient funds returns 422 and that both account balances are identical before and after the failed attempt.
- **FR-029**: An integration test MUST verify that a successful transfer results in the source account balance decreasing by the transfer amount and the destination account balance increasing by the same amount.

### Key Entities

- **Account**: Represents a bank customer's account. Key attributes: unique identifier, owner name, email (unique across all accounts), balance (non-negative, fixed-precision), KYC status (`pending`, `verified`, `rejected`), account status (`ACTIVE`, `FROZEN`, `CLOSED`), creation and update timestamps.
- **Transfer**: Represents a money movement between two accounts. Key attributes: unique identifier, source account reference, destination account reference, amount (positive, fixed-precision), status (`initiated`, `debited`, `completed`, `failed`), SAGA state, error message, creation and update timestamps.
- **SagaState**: Embedded within a Transfer. Tracks: current step name, whether each step (debit, credit, compensation) completed successfully, and any error message captured at each failure point.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `docker-compose up --build` completes without error and both health endpoints return HTTP 200 — verifiable within 60 seconds of the command completing.
- **SC-002**: A happy-path transfer results in the source balance decreasing and the destination balance increasing by exactly the transfer amount, with zero discrepancy.
- **SC-003**: An insufficient-funds transfer leaves both account balances byte-for-byte identical to their values before the attempt.
- **SC-004**: When the credit step fails, the compensation step fires and restores the source balance to its exact pre-transfer value in 100% of triggered compensation scenarios.
- **SC-005**: All three required tests pass in a clean environment: unit test for compensation, integration test for insufficient funds, integration test for happy-path transfer.
- **SC-006**: `npm run lint` and `npm run typecheck` report zero errors across the entire repository.

---

## Assumptions

- Environment variables are provided via a `.env` file copied from `.env.example`. No credentials are hardcoded.
- The `GET /health` endpoint does not require authentication.
- Internal debit and credit endpoints on the account service (called only by the transfer service SAGA) are protected by Docker network isolation in Phase 1; no additional auth is required.
- Account balances are stored as fixed-precision decimal values to prevent floating-point rounding errors.
- All transfers are single-currency; multi-currency conversion is out of scope.
- UUIDs are used for all entity primary keys.
- All timestamps are stored and returned in UTC.
- The transfer service communicates with the account service over HTTP within the Docker network.

---

## Out of Scope (Phase 1)

The following must not be introduced during Phase 1:

- Ledger service, fraud service, notification service, or API gateway
- Kafka, Redis, or any message broker or cache layer
- JWT authentication or authorization middleware
- Kubernetes manifests, Terraform, or any cloud infrastructure
- Observability tooling (Prometheus, Grafana, Loki, Alertmanager)
- CI/CD pipelines (GitHub Actions or similar)
- Multi-currency support
- Rate limiting or idempotency middleware
