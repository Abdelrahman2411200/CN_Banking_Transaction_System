# Tasks: Phase 2 — Distributed Ledger & Event-Driven Services

**Input**: [implementation-plan.md](implementation-plan.md)
**Owner**: Sam (full Phase 2 end-to-end)
**Branch**: `002-phase-2-distributed-ledger`

---

## 1. Repo Audit and Phase 2 Cleanup
- [ ] T201 Audit `services/` and `shared/` for any existing Phase 2 stubs.
- [ ] T202 Verify Phase 1 services are running correctly.
- [ ] T203 Confirm Phase 1 baseline is preserved.

## 2. Shared Event Contracts
- [ ] T204 [NEW] Create `shared/types/events.ts` with 5 `bank.*` event interfaces.
- [ ] T205 [MODIFY] Export `events.ts` from `shared/types/src/index.ts`.
- [ ] T206 Verification: `npm run typecheck --workspace @cn-banking/shared-types`.

## 3. Kafka + Zookeeper + Kafka-init
- [ ] T207 [MODIFY] Add `zookeeper` and `kafka` to `docker-compose.yml`.
- [ ] T208 [NEW] Create `infra/kafka/kafka-init/Dockerfile` and `init-topics.sh`.
- [ ] T209 [MODIFY] Update `docker-compose.yml` with `kafka-init` and the 5 topics.
- [ ] T210 [NEW] Create `shared/kafka/producer.ts` and `consumer.ts`.
- [ ] T211 Verification: Run `make up` and verify topic metadata.

## 4. MongoDB Addition for Ledger
- [ ] T212 [MODIFY] Add `mongodb` to `docker-compose.yml`.
- [ ] T213 [NEW] Create `infra/mongodb/init-ledger.js`.
- [ ] T214 Verification: `docker exec mongodb mongosh --eval "db.stats()"`.

## 5. account-service Event Emission + Freeze Support
- [ ] T215 [MODIFY] `account-service/src/routes.ts`: Implement `PATCH /v1/accounts/:id/freeze`.
- [ ] T216 [MODIFY] `account-service/src/routes.ts`: Emit `bank.account.created`.
- [ ] T217 Verification: `PATCH /v1/accounts/:id/freeze` returns 200.

## 6. transfer-service Event Emission
- [ ] T218 [MODIFY] `transfer-service/src/saga.ts`: Emit `bank.transfer.initiated`, `bank.transfer.completed`, `bank.transfer.failed`.
- [ ] T219 Verification: Monitor Kafka logs for emitted events during a transfer.

## 7. ledger-service
- [ ] T220 [NEW] Initialize `ledger-service` workspace.
- [ ] T221 [NEW] Create `ledger-service/src/db.ts` (MongoDB).
- [ ] T222 [NEW] Implement Kafka consumer for `bank.transfer.completed`.
- [ ] T223 [NEW] Implement dual-entry logic with partition+offset idempotency.
- [ ] T224 [NEW] Implement API: `/health`, `/v1/ledger/:accountId`, `/v1/ledger/:accountId/stats`.

## 8. fraud-service
- [ ] T225 [NEW] Initialize `fraud-service` workspace.
- [ ] T226 [NEW] Create `fraud-service/src/rules.ts` (4 isolated functions).
- [ ] T227 [NEW] Implement Kafka consumer for `bank.transfer.initiated`.
- [ ] T228 [NEW] Implement alert logic: Emit `bank.fraud.alert` + conditional `account-service/freeze`.

## 9. notification-service
- [ ] T229 [NEW] Initialize `notification-service` workspace.
- [ ] T230 [NEW] Create mock adapters (Email, SMS, Push).
- [ ] T231 [NEW] Implement consumer for 3 notification-worthy events.
- [ ] T232 [NEW] Implement critical severity (SMS + Email) routing.

## 10. Tests & Verification
- [ ] T233 [Unit] Test fraud rules with boundary values.
- [ ] T234 [Integration] Amount=15000 triggers `bank.fraud.alert`.
- [ ] T235 [Unit] Critical severity selects SMS + email.
- [ ] T236 [Integration] `TransferCompleted` → notification log entry.
- [ ] T237 **E2E Merge Gate**: Transfer triggers ledger + fraud evaluation < 2 seconds.
- [ ] T238 Final verification: Run `npm test`, `typecheck`, `lint` repo-wide.
