# CN Banking Transaction System

Cloud-native banking transaction system with Phase 2 event-driven services: account-service, transfer-service, Kafka outbox publishing, ledger-service, fraud-service, notification-service, PostgreSQL, and MongoDB.

## Local Setup

```bash
cp .env.example .env
npm install
make up
```

`make up` runs `docker compose up --build -d` and starts the full local stack.

## Services

| Service | Port | Purpose |
|---|---:|---|
| account-service | 3001 | Account CRUD, balances, KYC, debit/credit, account freeze |
| transfer-service | 3002 | Transfer SAGA orchestration and transfer lookup |
| ledger-service | 3003 | Kafka consumer and ledger read APIs |
| fraud-service | 3004 | Kafka consumer, fraud rules, alert APIs, critical account freeze |
| notification-service | 3005 | Kafka consumer and mock email/SMS notification delivery |
| Kafka | 9092 | Event backbone exposed to the host |
| MongoDB | 27017 | `banking_events` document store for ledger and fraud |
| PostgreSQL accounts | 5433 | Account-service database |
| PostgreSQL transfers | 5434 | Transfer-service database |

## Kafka Topics

| Topic | Partitions | Retention | Producer | Consumers |
|---|---:|---:|---|---|
| `bank.account.created` | 3 | 7d | account-service | reserved for downstream use |
| `bank.transfer.initiated` | 6 | 7d | transfer-service | fraud-service |
| `bank.transfer.completed` | 6 | 7d | transfer-service | ledger-service, notification-service |
| `bank.transfer.failed` | 6 | 7d | transfer-service | ledger-service, notification-service |
| `bank.fraud.alert` | 3 | 30d | fraud-service | notification-service |

Account-service and transfer-service use a transactional outbox table in PostgreSQL and in-process publisher loops to provide at-least-once event delivery. Ledger and fraud consumers use deterministic IDs and unique indexes for idempotency.

## API Overview

### Account Service

- `GET /health`
- `POST /v1/accounts`
- `GET /v1/accounts/:id`
- `GET /v1/accounts/:id/balance`
- `PATCH /v1/accounts/:id/kyc`
- `PATCH /v1/accounts/:id/debit`
- `PATCH /v1/accounts/:id/credit`
- `POST /v1/accounts/:id/freeze`

Frozen accounts use `status = suspended`; debit and credit requests for suspended accounts return `423 ACCOUNT_FROZEN`.

### Transfer Service

- `GET /health`
- `POST /v1/transfers`
- `GET /v1/transfers/:id`

Successful transfer creation emits `bank.transfer.initiated` and then a terminal `bank.transfer.completed` or `bank.transfer.failed` event.

### Ledger Service

- `GET /health`
- `GET /v1/ledger/:accountId?page&limit&from&to`
- `GET /v1/ledger/transfer/:transferId`
- `GET /v1/ledger/stats/:accountId`

Ledger pagination defaults to `page=1` and `limit=20`, with a max limit of `100`.

### Fraud Service

- `GET /health`
- `GET /v1/fraud/alerts?severity&accountId&from&to&page&limit`
- `GET /v1/fraud/alerts/:alertId`
- `GET /v1/fraud/stats`

Fraud rules:

- `large_transfer`: amount greater than `10000`, severity `high`
- `velocity_check`: more than five outgoing transfers in the last 60 minutes, severity `medium`
- `round_number`: positive multiple of `1000`, severity `low`
- `rapid_drain`: outgoing transfers in the last 10 minutes exceed 80% of current balance, severity `critical`

Critical alerts call `POST /v1/accounts/:id/freeze`.

### Notification Service

- `GET /health`

Notification-service is worker-first. Its HTTP surface is health/readiness only; business behavior is Kafka-driven with mock adapters:

- `bank.transfer.completed`: email sender and receiver
- `bank.transfer.failed`: email sender
- `bank.fraud.alert`: email for all severities, plus SMS for `high` and `critical`

Every attempt logs structured JSON with `notificationType`, `recipient`, `channel`, `status`, and `timestamp`.

## Testing

```bash
npm test
npm run test:unit
npm run test:integration
npm run typecheck
npm run lint
```

Integration tests expect the Docker stack to be running:

```bash
make up
npm run test:integration
```

Phase 2 integration coverage includes:

- `tests/integration/event-backbone.test.ts`: verifies account and transfer events are published through Kafka
- `tests/integration/ledger.test.ts`: verifies ledger writes and duplicate-delivery idempotency
- `tests/integration/fraud.test.ts`: verifies fraud alert publication and critical rapid-drain account freeze
- `tests/integration/phase2.e2e.test.ts`: verifies a completed transfer reaches ledger and fraud APIs while notification-service is healthy

## Smoke Test

After `make up`, run:

```bash
curl -s http://localhost:3001/health
curl -s http://localhost:3002/health
curl -s http://localhost:3003/health
curl -s http://localhost:3004/health
curl -s http://localhost:3005/health
```

Then create two accounts, post a transfer, and verify:

- `GET http://localhost:3003/v1/ledger/transfer/:transferId` returns debit and credit entries
- `GET http://localhost:3004/v1/fraud/alerts?accountId=:fromAccountId` returns a `round_number` alert for a transfer amount like `1000.00`
- notification-service logs structured JSON for transfer and fraud event notifications

## Environment Variables

| Variable | Default |
|---|---|
| ACCOUNT_SERVICE_PORT | 3001 |
| TRANSFER_SERVICE_PORT | 3002 |
| LEDGER_SERVICE_PORT | 3003 |
| FRAUD_SERVICE_PORT | 3004 |
| NOTIFICATION_SERVICE_PORT | 3005 |
| ACCOUNT_SERVICE_URL | http://account-service:3001 |
| TRANSFER_SERVICE_URL | http://transfer-service:3002 |
| LEDGER_SERVICE_URL | http://ledger-service:3003 |
| FRAUD_SERVICE_URL | http://fraud-service:3004 |
| NOTIFICATION_SERVICE_URL | http://notification-service:3005 |
| KAFKA_BROKERS | kafka:29092 |
| KAFKA_CLIENT_ID | cn-banking-platform |
| KAFKA_GROUP_ID_PREFIX | cn-banking |
| KAFKA_TOPIC_ACCOUNT_CREATED | bank.account.created |
| KAFKA_TOPIC_TRANSFER_INITIATED | bank.transfer.initiated |
| KAFKA_TOPIC_TRANSFER_COMPLETED | bank.transfer.completed |
| KAFKA_TOPIC_TRANSFER_FAILED | bank.transfer.failed |
| KAFKA_TOPIC_FRAUD_ALERT | bank.fraud.alert |
| MONGODB_URI | mongodb://mongodb:27017 |
| MONGODB_DB_NAME | banking_events |
| ACCOUNTS_DB_HOST | postgres-accounts |
| ACCOUNTS_DB_PORT | 5432 |
| ACCOUNTS_DB_HOST_PORT | 5433 |
| ACCOUNTS_DB_NAME | accounts_db |
| ACCOUNTS_DB_USER | accounts_user |
| ACCOUNTS_DB_PASSWORD | accounts_pass |
| TRANSFERS_DB_HOST | postgres-transfers |
| TRANSFERS_DB_PORT | 5432 |
| TRANSFERS_DB_HOST_PORT | 5434 |
| TRANSFERS_DB_NAME | transfers_db |
| TRANSFERS_DB_USER | transfers_user |
| TRANSFERS_DB_PASSWORD | transfers_pass |

## Make Targets

- `make up`: build and start the local stack
- `make test`: run workspace tests and integration tests
- `make down`: stop containers and remove volumes
- `make logs`: follow combined container logs

## Troubleshooting

- Port conflict: free ports `3001-3005`, `9092`, `27017`, `5433`, and `5434`.
- Kafka topic startup issue: run `make down`, then `make up` to recreate Kafka and rerun `kafka-init`.
- Integration test connection failures: confirm `docker compose ps` shows the five services plus Kafka and MongoDB healthy.
- Stale data: run `make down` to remove volumes, then restart with `make up`.
