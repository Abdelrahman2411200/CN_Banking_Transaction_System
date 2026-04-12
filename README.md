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

## Observability

Phase 5 adds Prometheus metrics, Alertmanager routing, Grafana dashboards, Loki log storage, Promtail log collection, and k6 load testing.

```text
Banking Services (banking namespace)
  api-gateway -> account-service
             -> transfer-service -> fraud-service
                               -> ledger-service
                               -> notification-service

Observability (monitoring namespace)
  Prometheus (scrapes /metrics every 15s)
  Alertmanager (routes alerts to PagerDuty / Slack)
  Grafana (dashboards + Loki datasource)
  Loki <- Promtail (scrapes pod logs from banking namespace)
```

Each service exposes unauthenticated Prometheus metrics at `GET /metrics` and emits JSON logs with `service`, `message`, `timestamp`, `requestId`, and `userId` when available.

### Quick Start

```bash
kubectl apply -f infra/k8s/monitoring/
node load-tests/seed.js
k6 run load-tests/transfer-flow.js
```

The monitoring manifests use `emptyDir` storage for Prometheus and Loki to keep the first deployment simple. Use PVC-backed storage for production retention.

### Grafana Access

| Item | Value |
|---|---|
| URL | `http://<node-ip>:32000` (NodePort) or `http://localhost:3000` (port-forward) |
| Username | `admin` |
| Password | Value of `GF_SECURITY_ADMIN_PASSWORD` secret |
| Dashboards | Banking Overview, Transfer Deep Dive, Fraud Monitoring, Infrastructure |

### Port Forwarding

```bash
kubectl port-forward -n monitoring svc/grafana 3000:3000
kubectl port-forward -n monitoring svc/prometheus 9090:9090
kubectl port-forward -n monitoring svc/alertmanager 9093:9093
```

### Useful Checks

```bash
curl http://localhost:3001/metrics | grep http_requests_total
curl http://localhost:3002/metrics | grep transfers_initiated_total
```

In Grafana Explore, use Loki:

```text
{namespace="banking"} | json | requestId="<request-id>"
```

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
| KAFKA_SSL | false |
| KAFKA_SASL_MECHANISM | empty locally, scram-sha-512 on MSK |
| KAFKA_SASL_USERNAME | empty locally |
| KAFKA_SASL_PASSWORD | empty locally |
| KAFKA_GROUP_ID_PREFIX | cn-banking |
| KAFKA_TOPIC_ACCOUNT_CREATED | bank.account.created |
| KAFKA_TOPIC_TRANSFER_INITIATED | bank.transfer.initiated |
| KAFKA_TOPIC_TRANSFER_COMPLETED | bank.transfer.completed |
| KAFKA_TOPIC_TRANSFER_FAILED | bank.transfer.failed |
| KAFKA_TOPIC_FRAUD_ALERT | bank.fraud.alert |
| MONGODB_URI | mongodb://mongodb:27017 |
| MONGODB_PASSWORD | replace-with-mongodb-compatible-password |
| MONGODB_DB_NAME | banking_events |
| REDIS_URL | redis://redis:6379 |
| REDIS_PASSWORD | replace-with-redis-password |
| JWT_ACCESS_SECRET | replace-with-a-long-random-access-token-secret |
| JWT_REFRESH_SECRET | replace-with-a-long-random-refresh-token-secret |
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
| PAGERDUTY_ROUTING_KEY | replace-with-pagerduty-routing-key |
| SLACK_WEBHOOK_URL | https://hooks.slack.com/services/replace/with/webhook |
| SMTP_HOST | smtp.example.com |
| SMTP_FROM | alerts@example.com |
| SMTP_USER | replace-with-smtp-user |
| SMTP_PASSWORD | replace-with-smtp-password |
| GF_SECURITY_ADMIN_PASSWORD | replace-with-grafana-admin-password |
| SERVICE_NAME | set per service in Kubernetes configmaps |
| LOG_LEVEL | info |
| API_BASE_URL | http://localhost:8080 |
| LOAD_TEST_USER_COUNT | 200 |
| LOAD_TEST_PASSWORD | TestPass123! |

## Make Targets

- `make up`: build and start the local stack
- `make test`: run workspace tests and integration tests
- `make down`: stop containers and remove volumes
- `make logs`: follow combined container logs

## Phase 4 Cloud Deployment

Phase 4 adds production Dockerfiles, AWS Terraform, Kubernetes manifests, and GitHub Actions CI/CD.

### Container Builds

```powershell
npm run test:containers
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate-service-images.ps1
```

Each service image uses Node 20 Alpine builder/runner stages, runs as non-root UID `10001`, starts with `node` directly, exposes `/health`, and keeps secrets out of the image.

### Terraform Backend

Create the S3 state bucket and DynamoDB lock table before the first Terraform init:

```powershell
aws s3 mb s3://YOUR_TF_STATE_BUCKET --region YOUR_REGION
aws dynamodb create-table --table-name YOUR_TF_LOCK_TABLE --attribute-definitions AttributeName=LockID,AttributeType=S --key-schema AttributeName=LockID,KeyType=HASH --billing-mode PAY_PER_REQUEST --region YOUR_REGION
```

Use `infra/terraform/environments/dev/terraform.tfvars.example` and `infra/terraform/environments/prod/terraform.tfvars.example` as templates only. Do not commit real `*.tfvars`, state, plan files, or cloud credentials.

### Required GitHub Secrets

- `AWS_ROLE_ARN`
- `ECR_REGISTRY`
- `TF_STATE_BUCKET`
- `TF_LOCK_TABLE`
- `DB_ACCOUNTS_PASSWORD`
- `DB_TRANSFERS_PASSWORD`
- `REDIS_PASSWORD`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ACM_CERTIFICATE_ARN`
- `MONGODB_PASSWORD`
- `KAFKA_SCRAM_PASSWORD`

Set `AWS_REGION` and `PUBLIC_DOMAIN` as GitHub Actions repository variables. Configure the `production` GitHub environment with required reviewers before enabling the CD workflow. The EKS API endpoint is private-only by default, so GitHub-hosted runners need VPC access or a self-hosted runner in the VPC for `kubectl` deployment steps.

Install the AWS Load Balancer Controller with IRSA permissions in the EKS cluster before applying `infra/k8s/ingress.yaml`. Install metrics-server for HPA metrics and use a network-policy-capable CNI before relying on `infra/k8s/networkpolicies.yaml`.

### Kubernetes Verification

```powershell
aws eks update-kubeconfig --name cn-banking-prod-eks --region YOUR_REGION
kubectl get pods -n banking
curl.exe https://your-domain/health
```

Expected result: all six service deployments are ready in namespace `banking`, PDBs are present, network policies are enforced, and the gateway health endpoint returns HTTP 200.

### Rollback

Demonstrate rollback with:

```powershell
kubectl rollout undo deployment/api-gateway -n banking
kubectl rollout status deployment/api-gateway -n banking --timeout=5m
```

The CD workflow applies all rendered manifests, checks every service rollout, and rolls back all six deployments if any rollout fails.

## Troubleshooting

- Port conflict: free ports `3001-3005`, `6379`, `8080`, `9092`, `27017`, `5433`, and `5434`, or run the test compose stack with overrides:

```powershell
$env:TEST_REDIS_PORT = "6380"
$env:TEST_API_GATEWAY_PORT = "18080"
$env:TEST_KAFKA_PORT = "19092"
$env:TEST_ACCOUNT_SERVICE_PORT = "13001"
$env:TEST_TRANSFER_SERVICE_PORT = "13002"
$env:TEST_LEDGER_SERVICE_PORT = "13003"
$env:TEST_FRAUD_SERVICE_PORT = "13004"
$env:TEST_NOTIFICATION_SERVICE_PORT = "13005"
$env:TEST_ACCOUNTS_DB_PORT = "15433"
$env:TEST_TRANSFERS_DB_PORT = "15434"
$env:TEST_MONGODB_PORT = "27018"
docker compose -f docker-compose.test.yml up --build --force-recreate --abort-on-container-exit --exit-code-from test-runner
```
- Kafka topic startup issue: run `make down`, then `make up` to recreate Kafka and rerun `kafka-init`.
- Integration test connection failures: confirm `docker compose ps` shows the six services plus Kafka and MongoDB healthy.
- Stale data: run `make down` to remove volumes, then restart with `make up`.
