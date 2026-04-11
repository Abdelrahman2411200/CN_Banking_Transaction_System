# Tasks: Phase 2 - Event Backbone, Ledger, Fraud, and Notifications

**Input**: Design documents from `/specs/phase-2-plan/phase.md`
**Supporting context**: `/specs/phase-2-plan/code-review.md`
**Assumption**: `phase.md` is the combined spec + implementation plan for this feature.

**Tests**: Tests are required for this feature because `phase.md` includes an explicit Phase 2 test plan.

**Organization**: Tasks are grouped by user story so each Phase 2 capability can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel when dependencies are already satisfied
- **[US#]**: Maps each task to a specific user story
- Every task below includes an exact file path for implementation traceability

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare repo-level infrastructure, workspaces, and developer workflows for Kafka, MongoDB, and the new Phase 2 services.

- [x] T001 Update `docker-compose.yml` to add `zookeeper`, `kafka`, `kafka-init`, `mongodb`, `ledger-service`, `fraud-service`, and `notification-service` with the Phase 2 ports, topic bootstrap, and healthcheck wiring
- [x] T002 [P] Update `.env.example` with Kafka broker settings, MongoDB settings, topic/group configuration, and service ports for `ledger-service`, `fraud-service`, and `notification-service`
- [x] T003 [P] Update `package.json` with any root scripts and workspace wiring needed for Phase 2 build, test, and local compose flows
- [x] T004 [P] Update `README.md` with Phase 2 startup instructions, topic inventory, and service/API overview
- [x] T005 [P] Create `services/ledger-service/package.json` for the ledger workspace dependencies and scripts
- [x] T006 [P] Create `services/fraud-service/package.json` for the fraud workspace dependencies and scripts
- [x] T007 [P] Create `services/notification-service/package.json` for the notification workspace dependencies and scripts
- [x] T008 [P] Create `services/ledger-service/Dockerfile` for the ledger workspace runtime image
- [x] T009 [P] Create `services/fraud-service/Dockerfile` for the fraud workspace runtime image
- [x] T010 [P] Create `services/notification-service/Dockerfile` for the notification workspace runtime image
- [x] T011 [P] Update `jest.config.ts` so Phase 2 unit and integration tests run from the new service and integration test paths

**Checkpoint**: Phase 2 infrastructure files are in place and the repo can build and test the new service workspaces.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define the shared contracts, persistence primitives, and test helpers that every Phase 2 user story depends on.

**CRITICAL**: No user story work should begin until this phase is complete.

- [x] T012 Create `shared/types/src/events.ts` with `BaseEvent`, the five Phase 2 event contracts, topic constants, serialization helpers, and deterministic UUID helpers for ledger idempotency
- [x] T013 Update `shared/types/src/index.ts` to re-export the Phase 2 event contracts and helper APIs from `shared/types/src/events.ts`
- [x] T014 [P] Create `shared/types/src/outbox.ts` with shared transactional outbox enqueue/publish lifecycle helpers for Postgres-backed services
- [x] T015 [P] Create `shared/types/src/mongo.ts` with shared Mongo connection helpers for the Phase 2 consumer services
- [x] T016 [P] Update `infra/db-init/migrations/accounts/001_create_accounts.sql` to add the account-service outbox table and indexes required for event publication
- [x] T017 [P] Update `infra/db-init/migrations/transfers/001_create_transfers.sql` to add the transfer-service outbox table and indexes required for event publication
- [x] T018 [P] Create `tests/integration/phase2.helpers.ts` with Kafka, MongoDB, and service URL helpers used by Phase 2 integration coverage

**Checkpoint**: Shared event contracts, outbox helpers, Mongo helpers, migrations, and test helpers are ready for story implementation.

---

## Phase 3: User Story 1 - Reliable Event Backbone (Priority: P1) MVP

**Goal**: Existing account and transfer workflows publish stable Phase 2 events through the transactional outbox so downstream services can consume them safely.

**Independent Test**: Create an account and a transfer, then verify `bank.account.created`, `bank.transfer.initiated`, and the final transfer outcome event are published to Kafka from the local stack.

### Tests for User Story 1

- [x] T019 [P] [US1] Create `shared/types/src/__tests__/events.test.ts` to verify event schemas, `version = "v1"`, serialization, and deterministic ledger UUID behavior
- [x] T020 [P] [US1] Update `services/account-service/src/__tests__/routes.test.ts` to cover account-created outbox writes and outbox publisher lifecycle behavior
- [x] T021 [P] [US1] Update `services/transfer-service/src/__tests__/saga.test.ts` to cover initiated, completed, and failed outbox writes across saga state transitions
- [x] T022 [P] [US1] Create `tests/integration/event-backbone.test.ts` to validate Kafka publication for account-created and transfer outcome events

### Implementation for User Story 1

- [x] T023 [US1] Update `services/account-service/src/routes.ts` to enqueue `bank.account.created` outbox records in the same transaction as account creation
- [x] T024 [US1] Update `services/account-service/src/index.ts` to start and stop the account-service outbox publisher during service lifecycle
- [x] T025 [US1] Update `services/transfer-service/src/saga.ts` to enqueue `bank.transfer.initiated`, `bank.transfer.completed`, and `bank.transfer.failed` outbox records at the correct transfer state transitions
- [x] T026 [US1] Update `services/transfer-service/src/index.ts` to start and stop the transfer-service outbox publisher during service lifecycle

**Checkpoint**: Account and transfer services publish all required Phase 2 events reliably enough for downstream consumers to build on.

---

## Phase 4: User Story 2 - Ledger Audit APIs (Priority: P2)

**Goal**: Operators can inspect immutable ledger entries and account-level ledger summaries derived from transfer events.

**Independent Test**: Publish a completed transfer and a failed transfer, then verify the ledger API returns the correct debit/credit or reversal rows without duplicating entries on redelivery.

### Tests for User Story 2

- [x] T027 [P] [US2] Create `services/ledger-service/src/__tests__/consumer.test.ts` to cover completed transfers, pre-debit failures, compensated failures, compensation failures, and duplicate Kafka delivery
- [x] T028 [P] [US2] Update `tests/integration/ledger.test.ts` to validate two ledger entries for completed transfers and idempotent behavior for duplicate event delivery

### Implementation for User Story 2

- [x] T029 [US2] Create `services/ledger-service/src/mongo.ts` to connect to the `banking_events` database and initialize the `ledger_entries` indexes
- [x] T030 [US2] Create `services/ledger-service/src/consumer.ts` to consume `bank.transfer.completed` and `bank.transfer.failed` and append deterministic debit, credit, and reversal ledger rows
- [x] T031 [US2] Create `services/ledger-service/src/index.ts` to expose `GET /v1/ledger/:accountId`, `GET /v1/ledger/transfer/:transferId`, `GET /v1/ledger/stats/:accountId`, plus health/readiness routes
- [x] T032 [US2] Update `services/ledger-service/src/index.ts` with pagination defaults, date filters, stats aggregation, and transfer lookup validation

**Checkpoint**: Ledger-service can consume transfer outcomes, store immutable ledger entries, and serve audit queries independently.

---

## Phase 5: User Story 3 - Fraud Detection and Account Freeze (Priority: P3)

**Goal**: Suspicious transfer activity produces persisted fraud alerts, publishes fraud events, and freezes accounts automatically for critical rapid-drain cases.

**Independent Test**: Publish suspicious transfer activity and verify the fraud API shows alerts, `bank.fraud.alert` is emitted, and a critical rapid-drain case freezes the source account.

### Tests for User Story 3

- [x] T033 [P] [US3] Update `services/fraud-service/src/__tests__/rules.test.ts` to cover thresholds and time-window behavior for `large_transfer`, `velocity_check`, `round_number`, and `rapid_drain`
- [x] T034 [P] [US3] Update `tests/integration/fraud.test.ts` to verify fraud alert publication and critical rapid-drain account freeze behavior

### Implementation for User Story 3

- [x] T035 [US3] Update `services/account-service/src/routes.ts` to add `POST /v1/accounts/:id/freeze` and reject debit and credit operations on suspended accounts with `423 ACCOUNT_FROZEN`
- [x] T036 [US3] Create `services/fraud-service/src/mongo.ts` to manage the `fraud_events` and `transfer_activity` collections and indexes
- [x] T037 [US3] Create `services/fraud-service/src/rules.ts` with the pure fraud rule evaluators and severity mapping
- [x] T038 [US3] Create `services/fraud-service/src/consumer.ts` to persist transfer activity, evaluate rules, store alerts, emit `bank.fraud.alert`, and freeze accounts on critical alerts
- [x] T039 [US3] Create `services/fraud-service/src/index.ts` to expose `GET /v1/fraud/alerts`, `GET /v1/fraud/alerts/:alertId`, `GET /v1/fraud/stats`, plus health/readiness routes

**Checkpoint**: Fraud-service can detect and persist alerts, emit fraud events, and freeze risky accounts without depending on ledger or notification delivery.

---

## Phase 6: User Story 4 - Customer and Risk Notifications (Priority: P4)

**Goal**: Transfer outcomes and fraud alerts trigger the correct mock email and SMS notifications with structured delivery logs.

**Independent Test**: Consume completed-transfer, failed-transfer, and fraud-alert events, then verify recipient lookup and channel routing match the Phase 2 delivery rules.

### Tests for User Story 4

- [x] T040 [P] [US4] Update `services/notification-service/src/__tests__/consumer.test.ts` to cover completed-transfer, failed-transfer, and fraud-severity channel-routing behavior

### Implementation for User Story 4

- [x] T041 [US4] Create `services/notification-service/src/adapters.ts` with mock email, SMS, and push adapters plus structured JSON delivery logging
- [x] T042 [US4] Create `services/notification-service/src/consumer.ts` to consume transfer outcome and fraud topics, resolve recipients from account-service, and dispatch mock notifications
- [x] T043 [US4] Create `services/notification-service/src/index.ts` with health/readiness routes and notification consumer lifecycle wiring

**Checkpoint**: Notification-service independently processes Phase 2 events and delivers the correct mock notifications and logs.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, performance, packaging cleanup, and final verification across all Phase 2 stories.

- [x] T044 [P] Update `shared/types/src/outbox.ts` to record per-row publish failures in `last_error` and continue processing later outbox rows
- [x] T045 [P] Update `services/ledger-service/Dockerfile` to copy only the ledger workspace and required shared packages into the image
- [x] T046 [P] Update `services/fraud-service/Dockerfile` to copy only the fraud workspace and required shared packages into the image
- [x] T047 [P] Update `services/notification-service/Dockerfile` to copy only the notification workspace and required shared packages into the image
- [x] T048 [P] Update `README.md` with full Phase 2 smoke-test steps for Kafka, ledger, fraud, and notification verification
- [x] T049 [P] Create `tests/integration/phase2.e2e.test.ts` to validate the completed-transfer flow through Kafka, ledger, fraud evaluation, and notification delivery within the Phase 2 timing expectations
- [ ] T050 Run the Phase 2 integration scenarios from `tests/integration/phase2.e2e.test.ts` against `docker-compose.yml`
- [ ] T051 Run the root validation commands defined in `package.json` for `typecheck`, `test:unit`, and `test:integration` before closing Phase 2

**Checkpoint**: Phase 2 is hardened, packaged cleanly, and validated end-to-end.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies
- **Phase 2 (Foundational)**: Depends on Phase 1 and blocks all user stories
- **Phase 3 (US1)**: Depends on Phase 2 and is the MVP slice
- **Phase 4 (US2)**: Depends on US1 because ledger-service consumes transfer outcome events produced by the event backbone
- **Phase 5 (US3)**: Depends on US1 because fraud-service consumes transfer initiated events and uses the new account freeze behavior
- **Phase 6 (US4)**: Depends on US1 for transfer events and reaches full scope after US3 produces `bank.fraud.alert`
- **Phase 7 (Polish)**: Depends on the stories you want to ship

### User Story Dependencies

- **US1 (Reliable Event Backbone)**: Starts immediately after Foundational and unlocks all other stories
- **US2 (Ledger Audit APIs)**: Requires the transfer completed/failed events from US1
- **US3 (Fraud Detection and Account Freeze)**: Requires the transfer initiated events from US1 and extends account-service with freeze semantics
- **US4 (Customer and Risk Notifications)**: Requires US1 for transfer notifications and US3 for fraud alert notifications

### Within Each User Story

- Write or update tests first and confirm they fail before implementing the story
- Consumer and persistence helpers should land before API surface for each new service
- API handlers should be completed before story-level integration validation
- Finish the story checkpoint before moving to the next priority

---

## Parallel Opportunities

### Setup

- T002-T011 can be split across infra, docs, and workspace packaging owners once T001 starts the compose changes

### Foundational

- T014-T018 can run in parallel after T012 and T013 define the shared event contract direction

### User Story 1

- T019-T022 can run in parallel as test authoring work
- T023 and T025 can proceed in parallel because they touch different services

### User Story 2

- T027 and T028 can run in parallel while T029-T032 are split between consumer and API implementation

### User Story 3

- T033 and T034 can run in parallel while T036-T039 are split between storage, rules, consumer, and API implementation

### User Story 4

- T041 and T042 can be split between adapter work and consumer orchestration after T040 establishes the expected behavior

### Polish

- T044-T049 are parallelizable hardening tasks owned by different services and test layers

---

## Parallel Example: User Story 3

```bash
# Run fraud-rule test work in parallel:
Task: "Update services/fraud-service/src/__tests__/rules.test.ts to cover the four fraud rules"
Task: "Update tests/integration/fraud.test.ts to verify alert publication and critical freeze behavior"

# Split fraud implementation by file:
Task: "Create services/fraud-service/src/mongo.ts for collections and indexes"
Task: "Create services/fraud-service/src/rules.ts with pure evaluators"
Task: "Create services/fraud-service/src/index.ts for fraud APIs"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: Reliable Event Backbone
4. Validate Kafka publication with `tests/integration/event-backbone.test.ts`
5. Stop and demo the event backbone before building downstream consumers

### Incremental Delivery

1. Finish Setup + Foundational to establish the shared Phase 2 platform
2. Deliver US1 so events flow reliably from the existing services
3. Deliver US2 so transfer outcomes become queryable through ledger APIs
4. Deliver US3 so suspicious activity is detected and critical accounts are frozen
5. Deliver US4 so transfer and fraud events produce notifications
6. Finish Phase 7 to harden and validate the entire stack

### Suggested MVP Scope

- **MVP**: Phase 1 + Phase 2 + Phase 3 (US1 only)
- **Next best increment**: Add Phase 4 (US2) so the team can inspect event-driven money movement end-to-end

---

## Notes

- `phase.md` was treated as the combined feature spec and implementation plan because `specs/phase-2-plan/` does not currently contain separate `spec.md` and `plan.md`
- `code-review.md` was used only to refine hardening and validation tasks in the Polish phase
- All tasks follow the required checklist format with task IDs, optional `[P]`, story labels where needed, and explicit file paths
