# Phase 2 Code Review

**Reviewer:** Claude Opus 4.6
**Date:** 2026-04-01
**Scope:** Full Phase 2 implementation — Kafka event backbone, transactional outbox, ledger-service, fraud-service, notification-service, updated account/transfer services, migrations, Docker infrastructure, and test suites.
**Plan reference:** `specs/phase-2-plan/phase.md`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [What Was Done Well](#2-what-was-done-well)
3. [Critical Findings](#3-critical-findings)
4. [Major Findings](#4-major-findings)
5. [Minor Findings](#5-minor-findings)
6. [Observations & Suggestions](#6-observations--suggestions)
7. [Plan Compliance Checklist](#7-plan-compliance-checklist)
8. [File-by-File Review Notes](#8-file-by-file-review-notes)
9. [Verdict](#9-verdict)

---

## 1. Executive Summary

Phase 2 delivers the event-driven backbone specified in the plan. Kafka + Zookeeper + MongoDB are wired into Docker Compose with proper health checks and topic initialization. The existing services now publish through a transactional outbox pattern. Three new services (ledger, fraud, notification) consume events, write to MongoDB, and implement the specified business rules. Fraud rules are extracted as pure functions. Ledger writes are idempotent via deterministic UUID v5 entry IDs. Notification routing matches the plan's severity-to-channel mapping.

The implementation is solid. There are two major findings (outbox duplication, outbox publish-then-mark not atomic), several minor issues, and no critical blockers. All core deliverables specified in the plan are present and working.

**Overall Rating: PASS with findings to address.**

---

## 2. What Was Done Well

### 2.1 Transactional Outbox Pattern

The outbox pattern is correctly implemented in both existing services. Account creation (`routes.ts:71-119`) wraps the INSERT + outbox write in a single transaction (`BEGIN`/`COMMIT`/`ROLLBACK`). Transfer state changes use the same pattern via `updateTransferState()` and `createTransferRecord()` in `saga.ts:186-241,271-308`. This guarantees that events are only queued when the business state change succeeds — the core invariant of the outbox pattern.

### 2.2 Shared Event Contracts

`shared/types/src/events.ts` defines all five event types with matching Zod schemas. Key strengths:
- `BaseEvent` with `eventId`, `eventType`, `timestamp`, `version` — standardized envelope.
- All schemas use `z.literal(EVENT_VERSION)` ensuring version is exactly `'v1'`.
- `buildBaseEvent()` generates a fresh `eventId` (UUID v4) and ISO timestamp for each event.
- `serializeEvent()` / `parseEvent()` provide type-safe serialization with Zod validation on parse.
- `KafkaTopics` as a const object with type extraction (`KafkaTopic`) — prevents topic string typos.

### 2.3 Deterministic Ledger Entry IDs

`createDeterministicUuid()` in `events.ts:129-143` implements UUID v5 semantics (SHA-1 hash, version nibble set to `5`, variant bits set correctly). `createLedgerEntryId()` combines `topic:partition:offset:entryType` to produce a unique, reproducible ID per ledger entry. This enables the idempotency requirement — duplicate Kafka delivery produces the same entry IDs, which hit the unique index and are silently skipped.

### 2.4 Fraud Rules as Pure Functions

`services/fraud-service/src/rules.ts` extracts all four rules as stateless pure functions:
- `evaluateLargeTransfer(amount)` — `> 10000`, high severity
- `evaluateVelocityCheck(recentTransferCount)` — `> 5`, medium severity
- `evaluateRoundNumber(amount)` — exact multiple of 1000, `>= 1000`, low severity
- `evaluateRapidDrain(recentOutgoingTotal, currentBalance)` — `> 80%` of balance, critical severity

Each returns `RuleResult | null`. This makes them trivially testable (and they are tested in `rules.test.ts` with boundary values). The consumer aggregates data and feeds it to the pure functions — clean separation of concerns.

### 2.5 Fraud Idempotency via `persistActivity`

`fraud-service/consumer.ts:83-100` — the `persistActivity()` function uses a unique index on `eventId` in `transfer_activity`. If the same event is delivered twice, the duplicate key error is caught and the function returns `false`, skipping rule evaluation entirely. This prevents duplicate alerts from duplicate Kafka delivery.

### 2.6 Alert ID Determinism

`fraud-service/consumer.ts:139-147` — alert IDs are derived from `createDeterministicUuid(eventId + ruleTriggered)`, so the same event + rule combination always produces the same alert ID. Combined with the unique index on `alertId` in `fraud_events`, this provides end-to-end idempotency.

### 2.7 Kafka Infrastructure

Docker Compose correctly configures:
- Zookeeper + Kafka with internal (`kafka:29092`) and external (`localhost:9092`) listeners — enabling both container-to-container and host-to-container communication.
- `kafka-init` container creates all five topics with specified partition counts and retention periods.
- `KAFKA_AUTO_CREATE_TOPICS_ENABLE: "false"` — topics must be explicitly created, preventing accidental topic creation from typos.
- Consumer group IDs are prefixed with `KAFKA_GROUP_ID_PREFIX` for namespace isolation.

### 2.8 Account Freeze Semantics

The freeze endpoint (`POST /accounts/:id/freeze`) sets `status = 'suspended'`. Both debit and credit endpoints now include `AND status <> $3` (where `$3` is `AccountStatus.SUSPENDED`) in their UPDATE WHERE clause. A frozen account correctly returns `423 ACCOUNT_FROZEN`. The fraud service calls freeze on critical alerts.

### 2.9 Ledger Service API

All three specified endpoints are implemented:
- `GET /v1/ledger/:accountId` with pagination (`page`, `limit`, `from`, `to` filters).
- `GET /v1/ledger/transfer/:transferId` — all entries for a transfer.
- `GET /v1/ledger/stats/:accountId` — `totalDebits`, `totalCredits`, `net`, `entryCount`.

Pagination defaults (page=1, limit=20, max=100) match the plan. Zod validates all query parameters.

### 2.10 Notification Channel Routing

Notification service correctly implements the plan's delivery rules:
- `transfer.completed` — email to both sender and receiver.
- `transfer.failed` — email to sender only.
- `fraud.alert` — email for all severities, SMS added for high/critical.

Mock adapters log structured JSON with `notificationType`, `recipient`, `channel`, `status`, `timestamp`. Push adapter is present but unused, as specified.

### 2.11 Test Quality

- **Fraud rules**: Boundary-value tests for all four rules (exact threshold, one above).
- **Notification planning**: Verifies channel mapping for completed, low-severity fraud, high-severity fraud.
- **Account routes**: Tests for freeze, debit/credit rejection of frozen accounts, outbox event queuing.
- **Transfer saga**: Tests verify outbox events are queued at each transition (initiated, completed, failed, compensation failed).
- **Integration tests**: Ledger test verifies two entries created for completed transfer and idempotency on duplicate processing. Fraud test verifies alert event produced for large transfer.
- `phase2.helpers.ts` extracts reusable `resolveKafkaBrokers`, `resolveMongoUri`, `resolveServiceUrl`, and `waitUntil` utilities.

---

## 3. Critical Findings

No critical findings.

---

## 4. Major Findings

### 4.1 [MAJOR] Outbox Modules Are Nearly Identical — Should Be Shared

**Location:** `services/account-service/src/outbox.ts` and `services/transfer-service/src/outbox.ts`

These two files are **functionally identical** (116 lines each). The only differences are:
1. The Kafka `clientId` suffix (`-account-service` vs `-transfer-service`).
2. The console error message string.

Everything else — `enqueueOutboxEvent`, `publishPendingOutboxEvents`, `startOutboxPublisher`, `stopOutboxPublisher`, the `OutboxRow` interface, the `ensureProducer` logic, the publish loop — is copy-pasted.

**Impact:** Any bug fix or enhancement (e.g., adding retry backoff, dead-letter handling, batch publishing) must be applied twice. This is the exact kind of duplication that `@cn-banking/shared-types` was created to prevent.

**Recommendation:** Extract a `createOutboxPublisher(clientIdSuffix: string)` factory function into a shared library (e.g., `shared/kafka/` or extend `shared/types/`). Each service calls `createOutboxPublisher('account-service')` to get its own instance. The `enqueueOutboxEvent` function (which takes a `PoolClient`) is already service-agnostic and should live in the shared package.

### 4.2 [MAJOR] Outbox Publisher: Publish-Then-Mark Is Not Atomic

**Location:** `services/account-service/src/outbox.ts:69-88` (identical in transfer-service)

```typescript
for (const row of result.rows) {
  await producer.send({ topic: row.topic, messages: [...] });

  await db.query(
    `UPDATE outbox_events SET published_at = NOW() ... WHERE id = $1`,
    [row.id]
  );
}
```

The outbox publisher sends to Kafka and then marks the row as published in two separate operations. If the process crashes between the Kafka send and the DB update, the outbox row will remain unpublished and be sent again on the next cycle.

**Impact:** This is actually the correct failure mode for an outbox — at-least-once delivery. The consumers (ledger, fraud) are idempotent, so duplicates are harmless. However, the current code processes rows **sequentially in a loop**. If row N fails to publish to Kafka, the `catch` at line 89 catches the error and exits the entire publish cycle, leaving rows N+1... unpublished even though they may be for different topics.

**Recommendation:**
1. Document that this is intentionally at-least-once (it's not a bug, but it should be stated).
2. Consider wrapping each individual row's publish+mark in its own try/catch so a failure on one row doesn't block subsequent rows:
```typescript
for (const row of result.rows) {
  try {
    await producer.send(...);
    await db.query('UPDATE ... SET published_at = NOW() WHERE id = $1', [row.id]);
  } catch (error) {
    await db.query('UPDATE ... SET last_error = $1 WHERE id = $2', [String(error), row.id]);
  }
}
```
This would also make the `last_error` column useful — it's currently defined in the schema but never written to on failure.

### 4.3 [MAJOR] `last_error` Column Never Written On Publish Failure

**Location:** `outbox_events` table schema (both migrations) and `outbox.ts` publish logic

The outbox table has a `last_error TEXT` column, and the UPDATE query sets `last_error = NULL` on success. But the `catch` block in `publishPendingOutboxEvents` only does `console.error` — it never writes the error to `last_error`. This column is dead weight.

**Impact:** If outbox publishing fails repeatedly for a specific event, there's no way to diagnose it from the database. Only container logs (which rotate) would have the information.

**Recommendation:** Update individual row failures to write `last_error` (see 4.2 recommendation), or remove the column if it won't be used.

### 4.4 [MAJOR] Ledger Stats Loads All Entries Into Memory

**Location:** `services/ledger-service/src/index.ts:98-121`

```typescript
const entries = await getDatabase()
  .collection<LedgerEntryDocument>('ledger_entries')
  .find({ accountId: params.data.accountId })
  .toArray();

const totals = entries.reduce(...)
```

The stats endpoint fetches **all** ledger entries for an account into memory and reduces them in JavaScript. For a high-volume account, this could be thousands or millions of documents.

**Impact:** Memory exhaustion and slow responses for accounts with many transactions.

**Recommendation:** Use a MongoDB aggregation pipeline instead:
```typescript
const [stats] = await collection.aggregate([
  { $match: { accountId } },
  { $group: {
    _id: null,
    totalDebits: { $sum: { $cond: [{ $eq: ['$entryType', 'debit'] }, '$amount', 0] } },
    totalCredits: { $sum: { $cond: [{ $eq: ['$entryType', 'credit'] }, '$amount', 0] } },
    entryCount: { $sum: 1 },
  }},
]).toArray();
```
This pushes the computation to the database where it belongs.

---

## 5. Minor Findings

### 5.1 [MINOR] MongoDB `mongo.ts` Duplicated Across Services

**Location:** `services/ledger-service/src/mongo.ts` and `services/fraud-service/src/mongo.ts`

Both files are nearly identical (connect, getDatabase, close pattern). The fraud service version is slightly more compact (no separate constants), but functionally equivalent. Same concern as 4.1 — shared infrastructure code duplicated.

**Recommendation:** Extract to a shared package alongside the outbox code when addressing 4.1.

### 5.2 [MINOR] New Dockerfiles Copy Entire `services/` and `shared/` Directories

**Location:** `services/ledger-service/Dockerfile`, `services/fraud-service/Dockerfile`, `services/notification-service/Dockerfile`

```dockerfile
COPY services ./services
COPY shared ./shared
```

The Phase 1 Dockerfiles (account-service, transfer-service) correctly copy only their own service directory plus shared types. The Phase 2 Dockerfiles copy **all** service directories, which means the ledger image contains account-service, transfer-service, fraud-service, etc. This increases image size unnecessarily and leaks unrelated code into each container.

**Recommendation:** Copy only the specific service directory:
```dockerfile
COPY services/ledger-service ./services/ledger-service
COPY shared/types ./shared/types
```

### 5.3 [MINOR] No Unit Tests for Ledger Consumer

**Location:** `services/ledger-service/src/__tests__/` — directory is empty

The ledger consumer has integration tests but no unit tests. The `processLedgerEvent` function, `buildEntries` logic, and `upsertEntries` idempotency are tested only through integration. The fraud rules have unit tests, the notification consumer has unit tests, but the ledger consumer does not.

**Recommendation:** Add unit tests for `processLedgerEvent` with mocked MongoDB, testing:
- Completed event produces two entries (debit + credit).
- Failed event with `debit_completed: true` produces reversed entries.
- Failed event with `debit_completed: false` produces no entries.
- Duplicate entry ID is silently skipped.

### 5.4 [MINOR] Notification Consumer Tests Don't Cover `transfer.failed` Path

**Location:** `services/notification-service/src/__tests__/consumer.test.ts`

The test file covers `transfer.completed` (two emails) and `fraud.alert` (low severity email-only, high severity email+SMS), but doesn't test `transfer.failed` (sender email only).

**Recommendation:** Add a test for the failed transfer path:
```typescript
it('sends one email for failed transfers', async () => { ... });
```

### 5.5 [MINOR] Fraud Consumer Exports `FraudAlertEventSchema` Unnecessarily

**Location:** `services/fraud-service/src/consumer.ts:227`

```typescript
export { FraudAlertEventSchema };
```

This re-exports a schema that's already exported from `@cn-banking/shared-types`. No other file imports it from the consumer module.

**Recommendation:** Remove the re-export.

### 5.6 [MINOR] `FraudEventDocument` Interface Duplicated

**Location:** `services/fraud-service/src/index.ts:11-19` and `services/fraud-service/src/consumer.ts:31-40`

The `FraudEventDocument` interface is defined identically in both files. The `index.ts` defines it locally for the API endpoints, and `consumer.ts` defines it for the consumer logic.

**Recommendation:** Define it once in the consumer (which owns the writes) and import it in `index.ts`.

### 5.7 [MINOR] `transfer.test.ts` Duplicates `resolveServiceUrl` from `phase2.helpers.ts`

**Location:** `tests/integration/transfer.test.ts:7-17` and `tests/integration/phase2.helpers.ts:1-11`

The `resolveServiceUrl` function is defined in both files. The Phase 1 transfer test defines its own copy instead of importing from the helpers module.

**Recommendation:** Import from `phase2.helpers.ts` to reduce duplication.

### 5.8 [MINOR] Fraud Integration Test Doesn't Verify Account Freeze on Critical Alert

**Location:** `tests/integration/fraud.test.ts`

The plan specifies testing the "critical rapid-drain path freezes the account." The current fraud integration test only verifies that a `large_transfer` rule produces a `FraudAlertEvent`. It doesn't test the `rapid_drain` rule or verify that a critical alert freezes the account.

**Recommendation:** Add an integration test that:
1. Creates an account with known balance.
2. Publishes multiple `transfer.initiated` events in quick succession totaling > 80% of balance.
3. Verifies the account is frozen via `GET /v1/accounts/:id`.

### 5.9 [MINOR] Outbox Publisher Polls on Fixed 1-Second Interval

**Location:** `outbox.ts:100-102` (both services)

```typescript
publishTimer = setInterval(() => {
  void publishPendingOutboxEvents(db);
}, 1000);
```

A fixed 1-second poll interval is simple but has two drawbacks:
- Up to 1 second latency between event generation and Kafka delivery.
- Wasted queries when there are no pending events.

**Impact:** Low for Phase 2 volumes. Higher phases with more traffic may want exponential backoff or `LISTEN/NOTIFY` triggers.

**Recommendation:** Acceptable for Phase 2. Document as a known optimization point.

### 5.10 [MINOR] Zookeeper Lacks a Health Check

**Location:** `docker-compose.yml:2-8`

The Zookeeper container has no health check. Kafka depends on Zookeeper but uses only a basic `depends_on` without a condition. If Zookeeper is slow to start, Kafka may fail its initial connection attempts.

**Impact:** Low — Kafka has its own retries and health check, so it will eventually stabilize. But adds startup fragility.

**Recommendation:** Add a Zookeeper health check:
```yaml
healthcheck:
  test: ["CMD-SHELL", "echo ruok | nc localhost 2181 | grep imok"]
  interval: 5s
  timeout: 5s
  retries: 10
```
And make Kafka depend on `zookeeper: condition: service_healthy`.

---

## 6. Observations & Suggestions

### 6.1 Ledger Consumer Fetches Transfer State via HTTP for Failed Events

`ledger-service/consumer.ts:110-118` calls `GET /v1/transfers/:id` to check whether `saga_state.debit_completed` is true. This introduces a runtime dependency on the transfer service being available when processing a `transfer.failed` event.

If the transfer service is down, `fetchTransfer` returns `null` and the failed event is silently skipped with no ledger entry. For a compensation failure (money stuck in transit), this means the audit trail is missing until the ledger consumer happens to reprocess the event.

**Suggestion:** Consider including `debit_completed` and `compensation_completed` in the `TransferFailedEvent` payload so the ledger consumer can make this decision without an HTTP call. This would also make the ledger consumer fully decoupled from the transfer service.

### 6.2 Notification Service Has No Error Handling for Account Lookup Failures

`notification-service/consumer.ts:39-43` calls `fetchAccountEmail` which throws on HTTP failure. If the account service is unreachable, the notification consumer's `eachMessage` handler will throw, causing KafkaJS to retry the message. This is reasonable but could lead to infinite retries if the account service is persistently down.

**Suggestion:** Add a try/catch around `handleNotificationEvent` in the consumer's `eachMessage` to log and skip messages that fail after a few attempts, rather than blocking the consumer group.

### 6.3 Fraud Service `getAccountBalance` for Rapid Drain Uses Post-Debit Balance

The fraud service evaluates rapid drain by fetching the current account balance from the account service. By the time the `transfer.initiated` event is processed, the debit may have already been applied (or may not have — it's async). The balance check is inherently racy.

**Suggestion:** This is acceptable for Phase 2's heuristic-based fraud detection. Document that the rapid drain rule uses a best-effort balance snapshot, not a guaranteed pre-transfer balance.

### 6.4 MongoDB Has No Authentication

**Location:** `docker-compose.yml:53-64`

MongoDB runs without authentication. While this is fine for local development, it should be secured before any shared environment deployment.

### 6.5 Consider Adding `outbox_events` Cleanup Job

The outbox tables will accumulate published rows indefinitely. A periodic cleanup job (DELETE WHERE `published_at` IS NOT NULL AND `published_at` < NOW() - INTERVAL '7 days') would prevent unbounded growth.

---

## 7. Plan Compliance Checklist

### Infrastructure

| Requirement | Status | Notes |
|---|---|---|
| Zookeeper + Kafka in docker-compose | DONE | Confluent images, correct listeners |
| kafka-init creates 5 topics | DONE | Correct partition counts and retention |
| MongoDB in docker-compose | DONE | Mongo 7.0 with health check |
| Kafka health checks | DONE | Based on `kafka-topics --list` |
| New services depend on Kafka readiness | DONE | `service_healthy` condition |
| `.env.example` extended | DONE | All Kafka, MongoDB, new service vars |

### Shared Contracts

| Requirement | Status | Notes |
|---|---|---|
| `events.ts` with re-export from `index.ts` | DONE | Clean `export * from './events'` |
| `BaseEvent` with required fields | DONE | `eventId`, `eventType`, `timestamp`, `version` |
| All 5 event types defined | DONE | With Zod schemas |
| Version standardized to `v1` | DONE | `z.literal(EVENT_VERSION)` |
| Kafka topic name constants | DONE | `KafkaTopics` object |
| Deterministic UUID for ledger idempotency | DONE | SHA-1 based UUID v5 |

### Account Service

| Requirement | Status | Notes |
|---|---|---|
| `bank.account.created` outbox in same transaction | DONE | `BEGIN`/outbox/`COMMIT` in routes.ts |
| `POST /v1/accounts/:id/freeze` | DONE | Sets `status = 'suspended'` |
| Debit rejects suspended accounts (423) | DONE | `AND status <> $3` in WHERE |
| Credit rejects suspended accounts (423) | DONE | Same pattern |
| In-process outbox publisher on boot | DONE | `startOutboxPublisher(pool)` in index.ts |

### Transfer Service

| Requirement | Status | Notes |
|---|---|---|
| `bank.transfer.initiated` outbox on creation | DONE | In `createTransferRecord()` transaction |
| `bank.transfer.completed` outbox on success | DONE | In `updateTransferState()` transaction |
| `bank.transfer.failed` outbox on all failure paths | DONE | Debit fail, compensation, compensation fail |
| Outbox writes in same transaction | DONE | `BEGIN`/update/outbox/`COMMIT` pattern |
| In-process outbox publisher on boot | DONE | Same as account service |

### Ledger Service

| Requirement | Status | Notes |
|---|---|---|
| Port 3003 with Kafka consumer | DONE | Consumer group `cn-banking-ledger-service` |
| Consumes `transfer.completed` and `transfer.failed` | DONE | Both subscribed |
| Two entries for completed transfer | DONE | `buildEntries()` returns debit + credit |
| Failed transfer: rows only when debit_completed | DONE | Checks via HTTP to transfer service |
| Compensated failures: two reversed rows | DONE | Status `'reversed'` |
| Pre-debit failures: no ledger rows | DONE | Early return when `!debit_completed` |
| Compensation failures: failed status rows | DONE | Status `'failed'` |
| Idempotency via deterministic `entryId` | DONE | Unique index, `$setOnInsert` upsert |
| `GET /v1/ledger/:accountId` with pagination | DONE | `page`, `limit`, `from`, `to` |
| `GET /v1/ledger/transfer/:transferId` | DONE | Sorted by `createdAt` |
| `GET /v1/ledger/stats/:accountId` | DONE | Computed in-memory (see finding 4.4) |
| Pagination defaults page=1, limit=20, max=100 | DONE | Via Zod `z.coerce.number().max(100).default(20)` |

### Fraud Service

| Requirement | Status | Notes |
|---|---|---|
| Port 3004 with Kafka consumer | DONE | Consumer group `cn-banking-fraud-service` |
| Consumes `bank.transfer.initiated` | DONE | |
| Persists transfer activity first | DONE | `persistActivity()` before rule evaluation |
| Four named pure rule functions | DONE | In `rules.ts` |
| `large_transfer`: amount > 10000, severity high | DONE | |
| `velocity_check`: > 5 in 60min, severity medium | DONE | |
| `round_number`: multiple of 1000, severity low | DONE | |
| `rapid_drain`: > 80% of balance in 10min, critical | DONE | |
| Persists fraud alert per triggered rule | DONE | In `fraud_events` collection |
| Publishes `bank.fraud.alert` per triggered rule | DONE | Via Kafka producer |
| Critical severity freezes account | DONE | Calls `POST /accounts/:id/freeze` |
| `GET /v1/fraud/alerts` with filters | DONE | `severity`, `accountId`, `from`, `to`, pagination |
| `GET /v1/fraud/alerts/:alertId` | DONE | 404 when not found |
| `GET /v1/fraud/stats` | DONE | `today` and `thisWeek` by severity |

### Notification Service

| Requirement | Status | Notes |
|---|---|---|
| Port 3005, health/readiness only for HTTP | DONE | Express for health, Kafka consumer for business |
| Consumes 3 topics | DONE | completed, failed, fraud.alert |
| No database | DONE | No MongoDB or Postgres dependency |
| Mock email + SMS adapters | DONE | In `adapters.ts` |
| Push adapter present but unused | DONE | `sendPush` exported but not called |
| `transfer.completed`: email to both | DONE | |
| `transfer.failed`: email to sender only | DONE | |
| `fraud.alert` high/critical: SMS + email | DONE | |
| `fraud.alert` low/medium: email only | DONE | |
| Structured JSON logging per notification | DONE | `{ notificationType, recipient, channel, status, timestamp }` |

### Tests

| Requirement | Status | Notes |
|---|---|---|
| Fraud rule unit tests with edge cases | DONE | 4 rules, boundary values |
| Notification unit tests for channel mapping | DONE | 3 scenarios |
| Account outbox event queuing test | DONE | Asserts `enqueueOutboxEvent` called |
| Transfer outbox event tests | DONE | initiated, completed, failed, compensation_failed |
| Ledger integration: 2 entries for completed | DONE | Via Kafka publish + mongo check |
| Ledger integration: idempotency | DONE | `processLedgerEvent` called twice |
| Fraud integration: large transfer alert | DONE | Publishes 15000 transfer, asserts alert |
| Freeze on critical rapid-drain | **PARTIAL** | Not tested in integration (5.8) |
| End-to-end: docker compose up healthy | DONE | User verified |
| Duplicate Kafka delivery no duplicate ledger | DONE | Tested in ledger.test.ts |

---

## 8. File-by-File Review Notes

| File | Lines | Verdict | Key Notes |
|------|-------|---------|-----------|
| `shared/types/src/events.ts` | 151 | Excellent | Clean event contracts, Zod schemas, deterministic UUID, topic constants |
| `shared/types/src/index.ts` | 178 | Good | Clean re-export of events |
| `services/account-service/src/outbox.ts` | 116 | Good | Correct outbox pattern. Duplicated (4.1). Publish failure not recorded (4.3) |
| `services/transfer-service/src/outbox.ts` | 116 | Good | Identical to account outbox. Same findings |
| `services/account-service/src/routes.ts` | 354 | Excellent | Transactional outbox for creation, freeze endpoint, frozen account checks |
| `services/account-service/src/index.ts` | 80 | Excellent | Outbox publisher lifecycle, clean shutdown |
| `services/transfer-service/src/saga.ts` | 310 | Excellent | Outbox events at every state transition, transactional consistency |
| `services/transfer-service/src/index.ts` | 81 | Good | Mirrors account service pattern |
| `services/ledger-service/src/index.ts` | 153 | Good | Clean API. Stats endpoint should use aggregation (4.4) |
| `services/ledger-service/src/consumer.ts` | 184 | Good | Correct idempotency. HTTP dependency for failed events (6.1) |
| `services/ledger-service/src/mongo.ts` | 17 | Good | Simple. Duplicated with fraud (5.1) |
| `services/fraud-service/src/index.ts` | 172 | Good | Clean API with aggregation for stats. FraudEventDocument duplicated (5.6) |
| `services/fraud-service/src/consumer.ts` | 228 | Good | Well-structured. Idempotent activity + alert persistence |
| `services/fraud-service/src/rules.ts` | 25 | Excellent | Pure functions, clean boundaries |
| `services/fraud-service/src/mongo.ts` | 14 | Good | Duplicated with ledger (5.1) |
| `services/notification-service/src/index.ts` | 48 | Good | Minimal HTTP surface, consumer-driven |
| `services/notification-service/src/consumer.ts` | 132 | Good | Clean plan+execute pattern. No error handling for account lookup (6.2) |
| `services/notification-service/src/adapters.ts` | 48 | Good | Structured logging, push adapter present |
| `tests/integration/ledger.test.ts` | 90 | Good | Tests creation and idempotency |
| `tests/integration/fraud.test.ts` | 94 | Good | Tests large transfer alert. Missing freeze test (5.8) |
| `tests/integration/phase2.helpers.ts` | 49 | Good | Clean shared utilities |
| `tests/integration/transfer.test.ts` | 200 | Good | Fixed TCPWRAP with `keepAlive: false`. Duplicates resolveServiceUrl (5.7) |
| `services/account-service/src/__tests__/routes.test.ts` | 188 | Good | Covers freeze, frozen checks, outbox |
| `services/transfer-service/src/__tests__/saga.test.ts` | 233 | Good | Covers all outbox event transitions |
| `services/fraud-service/src/__tests__/rules.test.ts` | 50 | Good | Boundary-value tests for all rules |
| `services/notification-service/src/__tests__/consumer.test.ts` | 106 | Good | Missing failed transfer test (5.4) |
| `infra/db-init/migrations/accounts/001_create_accounts.sql` | 44 | Good | Outbox table + index added |
| `infra/db-init/migrations/transfers/001_create_transfers.sql` | 47 | Good | Outbox table + index added |
| `docker-compose.yml` | 282 | Good | Correct Kafka/Zookeeper/MongoDB setup. Zookeeper lacks health check (5.10) |
| `.env.example` | 35 | Good | All new variables documented |
| `jest.config.ts` | 27 | Good | `testMatch` updated for `tests/integration/**/*.test.ts` |
| `services/ledger-service/Dockerfile` | 12 | Needs Fix | Copies all services (5.2) |
| `services/fraud-service/Dockerfile` | 12 | Needs Fix | Same issue |
| `services/notification-service/Dockerfile` | 12 | Needs Fix | Same issue |

---

## 9. Verdict

**Phase 2 is functionally complete and correctly implements the event-driven backbone.**

The transactional outbox pattern ensures exactly-once semantics between business state and event generation. Kafka infrastructure is properly configured with explicit topic creation, dual listeners, and health checks. All three new services implement their specified behavior with idempotent consumers. Fraud rules are clean pure functions. The test suite covers the key scenarios.

**Priority action items before Phase 3:**

1. **Extract shared outbox module** (4.1) — eliminates the largest source of duplication and creates a foundation for Phase 3's Redis-backed idempotency.
2. **Per-row error handling in outbox publisher** (4.2/4.3) — prevents one bad event from blocking all subsequent outbox processing, and makes the `last_error` column useful.
3. **Ledger stats aggregation pipeline** (4.4) — the in-memory reduce will become a bottleneck as transaction volume grows.
4. **Fix Dockerfiles to copy only required service dirs** (5.2) — quick cleanup, prevents image bloat.

**Lower priority:**
- Add missing ledger consumer unit tests (5.3).
- Add `transfer.failed` notification test (5.4).
- Add rapid-drain freeze integration test (5.8).
- Deduplicate `mongo.ts` and `FraudEventDocument` (5.1, 5.6).

**No blocking issues. Ready for Phase 3.**
