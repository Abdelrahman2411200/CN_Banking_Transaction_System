# Implementation Plan: Phase 2 — Distributed Ledger & Event-Driven Services

**Branch**: `002-phase-2-distributed-ledger` | **Date**: 2026-03-18
**Owner**: Sam (full Phase 2 end-to-end)

---

## 1. Repo Audit & Cleanup (Audit Complete)

### Stale Phase 2 Artifacts to DELETE or REPLACE
- None found in implementation; only the preliminary design docs in `specs/002-phase-2-distributed-ledger/` will be superseded by this plan and the associated tasks.

---

## 2. Target Folder Tree (End of Phase 2)

```text
/
├── .env
├── .env.example
├── docker-compose.yml
├── infra/
│   ├── kafka/
│   │   └── kafka-init/
│   │       ├── Dockerfile
│   │       └── init-topics.sh
│   └── mongodb/
│       └── init-ledger.js
├── services/
│   ├── account-service/     (Port 3001)
│   ├── transfer-service/    (Port 3002)
│   ├── ledger-service/      (Port 3003) [NEW]
│   ├── fraud-service/       (Port 3004) [NEW]
│   └── notification-service/ (Port 3005) [NEW]
├── shared/
│   ├── types/               (@cn-banking/shared-types, adds events.ts)
│   └── kafka/               [NEW] (@cn-banking/shared-kafka)
│       ├── producer.ts      (reusable utility)
│       └── consumer.ts      (reusable base class)
└── tests/
    └── integration/
        ├── transfer.test.ts  (Phase 1 baseline)
        ├── fraud-alert.test.ts [NEW]
        └── notification.test.ts [NEW]
```

---

## 3. Infrastructure & Shared Core

### Kafka Topics (bank.*)
| Topic Name | Partitions | Retention (ms) | Notes |
|------------|------------|----------------|-------|
| `bank.account.created` | 1 | 604800000 (7d) | Low volume |
| `bank.transfer.initiated` | 3 | 604800000 (7d) | High volume, partition for scaling |
| `bank.transfer.completed` | 3 | 2592000000 (30d) | Audit critical |
| `bank.transfer.failed` | 1 | 604800000 (7d) | Error tracking |
| `bank.fraud.alert` | 1 | 2592000000 (30d) | Compliance critical |

### Local Infrastructure Updates
- **Kafka**: `bitnami/kafka:latest` (with Zookeeper)
- **MongoDB**: `mongo:latest` (ledger storage)
- **kafka-init**: Custom container to create topics with settings above.

---

## 4. Existing Service Modifications (Phase 1 Baseline)

### account-service (MODIFY)
- [ADD] `PATCH /v1/accounts/:id/freeze`: Sets status to `FROZEN`.
- [ADD] Kafka producer to `index.ts`.
- [MODIFY] `POST /v1/accounts`: Emit `bank.account.created`.

### transfer-service (MODIFY)
- [ADD] Kafka producer to `saga.ts`.
- [MODIFY] `execute()`:
  - Emit `bank.transfer.initiated` at start (before debit).
  - Emit `bank.transfer.completed` on success.
  - Emit `bank.transfer.failed` on failure/compensation.

---

## 5. New Service Implementations (Phase 2)

### Ledger Service (Port 3003)
- **Consumer**: `bank.transfer.completed`.
- **Logic**: For each event, write two MongoDB entries (debit for sender, credit for receiver).
- **Idempotency**: Composite key `{ topic, partition, offset }`.
- **API**:
  - `GET /health`
  - `GET /v1/ledger/:accountId?page=1&limit=10`
  - `GET /v1/ledger/:accountId/stats` (total throughput, net balance in ledger)

### Fraud Service (Port 3004)
- **Consumer**: `bank.transfer.initiated`.
- **Rules (Isolated Functions)**:
  1. `checkAmountThreshold(transfer, threshold)`
  2. `checkQuickFrequency(transfer, history, timeWindow)`
  3. `checkKnownFraudPatterns(transfer, patterns)`
  4. `checkVelocity(transfer, totalToday)`
- **Action**: Emit `bank.fraud.alert`. If `severity === 'critical'`, call `account-service/freeze`.

### Notification Service (Port 3005)
- **Consumers**: `bank.account.created`, `bank.transfer.completed`, `bank.fraud.alert`.
- **Adapters**: `EmailAdapter`, `SmsAdapter`, `PushAdapter` (all log-based mocks).
- **Critical Logic**: If `bank.fraud.alert` (Critical), route to **SMS + Email**.

---

## 6. Event Producer/Consumer Matrix

| Topic | Producer | Consumers |
|-------|----------|-----------|
| `bank.account.created` | `account-service` | `notification-service` |
| `bank.transfer.initiated` | `transfer-service` | `fraud-service` |
| `bank.transfer.completed` | `transfer-service` | `ledger-service`, `notification-service` |
| `bank.transfer.failed` | `transfer-service` | `notification-service` |
| `bank.fraud.alert` | `fraud-service` | `notification-service`, `account-service` (via API call) |

---

## 7. Test Plan

### Unit Tests
- **Fraud Rules**: Boundary value tests for all 4 rules (amount, velocity, etc.).
- **Notification Router**: Verify correct adapter selection (SMS + Email for critical).

### Integration Tests
- **Fraud Trigger**: Transfer 15,000 → Verify `bank.fraud.alert` emitted.
- **Log Verification**: `TransferCompleted` → Verify notification log entry exists.

---

## 8. Acceptance Criteria & Verification

### Verification Commands
```bash
# 1. Start Infrastructure
make up

# 2. Check Health (all 5 services)
curl localhost:3001/health  # Account
curl localhost:3002/health  # Transfer
curl localhost:3003/health  # Ledger
curl localhost:3004/health  # Fraud
curl localhost:3005/health  # Notif

# 3. Verify Kafka initialization
docker exec kafka kafka-topics.sh --list --bootstrap-server localhost:9092
```

### Merge Gate (FR-P2-001)
- Perform a transfer:
  - Verify MongoDB `ledger` has 2 new entries.
  - Verify `fraud-service` logs show rule evaluation.
  - Verify `notification-service` logs show delivery.
  - Total time from Transfer POST to Ledger write < **2 seconds**.

---

## 9. Risks & Assumptions
- **Kafka Connectivity**: Assumes Docker DNS for inter-service communication (`kafka:9092`).
- **Mongo Consistency**: Assume eventual consistency is acceptable for ledger reads in Phase 2.
- **Phase 1 Integrity**: Assumes existing Postgres tables and endpoints remain unchanged unless hooks are added.

---

## Handoff to `/speckit.tasks` and `/speckit.implement`
This plan is ready for Task generation. Sam will implement Phase 2 end-to-end starting with shared contracts and Kafka foundation.
