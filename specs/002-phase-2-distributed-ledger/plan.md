# Specification: Phase 2 — Distributed Ledger & Event-Driven Architecture

**Branch**: `002-phase-2-distributed-ledger` | **Date**: 2026-03-18
**Owner**: Sam (full Phase 2 end-to-end)

---

## Summary

Phase 2 transitions the CN Banking Transaction System into a mature, event-driven architecture. Building upon the solid Phase 1 foundation (Account and Transfer services), Sam will implement a distributed ledger, real-time fraud detection, and multi-channel notifications using Apache Kafka and MongoDB. This phase emphasizes asynchronous reliability and operational depth.

---

## Technical Context

- **Messaging**: Apache Kafka (Bitnami images for Zookeeper, Kafka, and Kafka-init)
- **Infrastructure**: MongoDB (for the Ledger service)
- **Shared Contracts**: `@cn-banking/event-contracts` (shared/types/events.ts)
- **New Services**:
  - `ledger-service` (Port 3003): Append-only MongoDB ledger with dual-entry semantics.
  - `fraud-service` (Port 3004): Real-time risk evaluation and account freezing.
  - `notification-service` (Port 3005): Mock adapters for SMS, Email, and Push notifications.

---

## Event Contracts Source of Truth

**File**: `shared/types/events.ts`
**Namespace**: `bank.*`

| Event Name | Source | Description |
|------------|--------|-------------|
| `bank.account.created` | `account-service` | Emitted when a new account is successfully created. |
| `bank.transfer.initiated` | `transfer-service` | Emitted when a transfer SAGA begins. |
| `bank.transfer.completed` | `transfer-service` | Emitted when a transfer SAGA reaches `'completed'`. |
| `bank.transfer.failed` | `transfer-service` | Emitted when a transfer SAGA reaches `'failed'`. |
| `bank.fraud.alert` | `fraud-service` | Emitted when an automated fraud rule is triggered. |

---

## Phase 2 Infrastructure

### Docker Compose Additions
- **Zookeeper**: Coordinator for Kafka clusters.
- **Kafka**: The message broker.
- **Kafka-init**: Automated topic creation for the 5 events (custom partitions/retention).
- **MongoDB**: Persistent storage for the Ledger service.

---

## Service Modifications (Phase 1 Hooks)

### Account Service
- **[MODIFY]** Emit `bank.account.created` on successful POST.
- **[MODIFY]** Implement `PATCH /v1/accounts/:id/freeze` (if not present) to support fraud mitigation.

### Transfer Service
- **[MODIFY]** Emit `bank.transfer.initiated` at the start of the SAGA.
- **[MODIFY]** Emit `bank.transfer.completed` upon successful SAGA finalization.
- **[MODIFY]** Emit `bank.transfer.failed` upon SAGA failure or compensation.

---

## New Services (Phase 2)

### Ledger Service (Port 3003)
- **Consumer**: `bank.transfer.completed`.
- **Logic**: Dual-entry (debit/credit) writes to MongoDB.
- **Idempotency**: Keyed by Kafka `partition` + `offset`.

### Fraud Service (Port 3004)
- **Consumer**: `bank.transfer.initiated`.
- **Logic**: 4 isolated fraud rules: `checkHighAmount`, `checkFrequency`, `checkBeneficiaryPattern`, `checkVelocity`.
- **Action**: Emit `bank.fraud.alert`. Critical alerts call `account-service/freeze`.

### Notification Service (Port 3005)
- **Consumers**: `bank.account.created`, `bank.transfer.completed`, `bank.fraud.alert`.
- **Logic**: Mock adapters for delivery simulation.
- **Critical Severity**: Route to **SMS + Email**.

---

## Notification Event-Consumer Matrix

| Event | Notification Channel | Severity |
|-------|----------------------|----------|
| `bank.account.created` | Log / Push (Mock) | Info |
| `bank.transfer.completed` | Email (Mock) | Info |
| `bank.fraud.alert` (Critical) | **SMS + Email** | Critical |

---

## Verification Plan

### Automated Tests
1. **Unit**: Fraud rules with boundary values.
2. **Integration**: Transfer amount 15,000 triggering `bank.fraud.alert`.
3. **Unit**: Notification service selecting SMS + Email for critical alerts.
4. **Integration**: `bank.transfer.completed` event producing a notification log entry.

### Merge Gate (E2E)
- Run a full transfer and verify:
  1. Ledger entry is created in MongoDB.
  2. Fraud processing result is recorded/emitted.
  3. All within **2 seconds** end-to-end.
