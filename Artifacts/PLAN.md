# Development Plan: CN Banking Transaction System

## Phase 1 — Account & Transfer services
Both of you scaffold the repo together on day 1, then split: Mexo owns the two services, Sam owns the shared infrastructure and types.

### Mexo: Account service + Transfer service
**Branch:** `phase/1-mexo-account-transfer`

- Build account-service (port 3001) — create, read, KYC, balance endpoints
- Write PostgreSQL schema for accounts table with CHECK balance >= 0
- Build transfer-service (port 3002) with full SAGA state machine
- Write PostgreSQL schema for transfers table
- Implement SAGA compensation logic (debit reversal on credit failure)
- Unit test: compensation fires correctly when credit step throws
- Integration test: insufficient funds returns 422, balances unchanged
- Integration test: happy-path transfer updates both balances atomically

### Sam: Docker Compose + shared types + DB migrations
**Branch:** `phase/1-sam-docker-shared`

- Create monorepo folder structure (services/, shared/, infra/)
- Define shared TypeScript interfaces in shared/types/ (Account, Transfer, ApiResponse)
- Write docker-compose.yml: both services + postgres-accounts + postgres-transfers
- Create db-init container that runs migrations on startup
- Add healthcheck to each service (GET /health -> 200)
- Configure ESLint + TypeScript strict mode across all packages
- Write root Makefile with: make up, make test, make down, make logs
- Write README: local setup in 3 commands, env variable reference

### Sync Points — agree on these before splitting
- Agree on service port numbers and base URL structure (/v1/...)
- Mexo defines the Account and Transfer TypeScript interfaces first — Sam imports them from shared/types
- Merge gate: docker-compose up --build starts clean with no errors before merging to main

---

## Phase 2 — Ledger, fraud, and messaging (Week 3-4)
Mexo builds the two data-heavy services (ledger + fraud). Sam owns Kafka setup and the notification consumer. They share the event contracts definition on day 1.

### Mexo: Ledger service + Fraud service
**Branch:** `phase/2-mexo-ledger-fraud`

- Build ledger-service (port 3003) — Kafka consumer for transfer.completed events
- Implement append-only MongoDB ledger with debit/credit dual-entry writes
- Implement idempotency using Kafka partition+offset as key
- Expose GET /v1/ledger/:accountId (paginated) and /stats/:accountId
- Build fraud-service (port 3004) — Kafka consumer for transfer.initiated
- Implement all 4 fraud rules as isolated, named functions
- Emit bank.fraud.alert to Kafka when rule fires
- Call account-service freeze endpoint on critical severity
- Unit test: each fraud rule in isolation with boundary values
- Integration test: amount=15000 triggers FraudAlertEvent on Kafka

### Sam: Kafka setup + Notification service + event emitters
**Branch:** `phase/2-sam-kafka-notifications`

- Add Kafka + Zookeeper + kafka-init to docker-compose.yml
- Create all 5 Kafka topics with correct partitions and retention config
- Write Kafka producer utility in shared/kafka/producer.ts (reusable wrapper)
- Write Kafka consumer base class in shared/kafka/consumer.ts
- Modify account-service to emit bank.account.created on new account
- Modify transfer-service to emit initiated / completed / failed events
- Build notification-service (port 3005) — consumes 3 event types
- Implement mock email/SMS/push adapters with structured log output
- Unit test: correct channel selected per severity (critical -> SMS+email)
- Integration test: emit TransferCompleted, verify notification log entry

### Sync Points — agree on these before splitting
- Define all 5 event contracts together in shared/types/events.ts on day 1 of this phase — both depend on them
- Sam's Kafka producer util must be ready before Mexo can test fraud alert emission
- Merge gate: completing a transfer triggers ledger entry + fraud check within 2 seconds

---

## Phase 3 — API gateway and security (Week 5)
Mexo builds the gateway core and auth flow. Sam owns Redis, rate limiting, and idempotency. The gateway is useless without both halves — tight coordination needed this phase.

### Mexo: API Gateway core + JWT auth flow
**Branch:** `phase/3-mexo-gateway-auth`

- Bootstrap api-gateway service (port 8080) with Express + http-proxy-middleware
- Implement route table (proxy rules for all 5 downstream services)
- Build POST /v1/auth/register and POST /v1/auth/login endpoints
- Implement JWT access token generation (HS256, 15min expiry)
- Implement JWT refresh token flow (POST /v1/auth/refresh)
- Build auth middleware: verify signature, check expiry, attach req.user
- Implement POST /v1/auth/logout — blacklist token in Redis
- Add security headers to all responses (HSTS, X-Frame-Options, X-Request-Id)
- Unit test: JWT generation and validation edge cases
- Integration test: expired and blacklisted tokens return 401

### Sam: Redis layer + Rate limiting + Idempotency
**Branch:** `phase/3-sam-redis-ratelimit`

- Add Redis to docker-compose.yml, write shared Redis client utility
- Implement refresh token store in Redis (auth:refresh:{hash}, TTL 7d)
- Implement token blacklist in Redis (auth:blacklist:{hash}, TTL 15min)
- Set up express-rate-limit with Redis store
- Configure 4 rate limit tiers: global, login, transfers, accounts
- Return 429 with retryAfter, limit, remaining headers
- Implement idempotency middleware for POST /v1/transfers
- Cache transfer response in Redis (idempotency:{key}, TTL 24h)
- Return Idempotency-Status: hit | miss header
- Integration test: same Idempotency-Key sent twice — service called only once
- Integration test: exceed login rate limit -> 429 with correct retryAfter

### Sync Points — agree on these before splitting
- Sam's Redis client utility must be committed to shared/ before Mexo wires the blacklist — coordinate on day 1
- Agree on Redis key naming convention upfront: auth:*, ratelimit:*, idempotency:*
- Merge gate: all external traffic through port 8080 only — direct service ports return connection refused

---

## Phase 4 — CI/CD pipeline and infrastructure (Week 6-7)
Clear specialty split: Mexo owns containers and the GitHub Actions pipeline. Sam owns all cloud infrastructure with Terraform and Kubernetes manifests.

### Mexo: Dockerfiles + GitHub Actions CI/CD
**Branch:** `phase/4-mexo-dockerfiles-ci`

- Write multi-stage Dockerfile for all 6 services (builder + runner stages)
- Enforce non-root user (adduser appuser) and HEALTHCHECK in every image
- Write docker-compose.test.yml for CI integration test environment
- Write .github/workflows/ci.yml: lint -> test -> build -> security scan (trivy)
- Configure npm audit --audit-level=high gate in CI
- Write .github/workflows/cd.yml: build + push to ECR on merge to main
- Implement OIDC-based AWS auth in CD (no long-lived access keys)
- Add docker build --build-arg VERSION=${{ github.sha }} for image tagging
- Configure Codecov upload for test coverage in CI
- Document: how to run CI locally with act

### Sam: Terraform modules + Kubernetes manifests + CD deploy step
**Branch:** `phase/4-sam-terraform-k8s`

- Write Terraform module: networking (VPC, subnets, NAT Gateway, security groups)
- Write Terraform module: EKS cluster + node group + IAM roles + OIDC
- Write Terraform module: RDS (accounts-db + transfers-db) + ElastiCache Redis
- Write Terraform module: MSK Kafka + ECR repositories (6 repos)
- Create environments/dev/ and environments/prod/ with tfvars.example
- Configure S3 backend + DynamoDB lock table, document manual bootstrap
- Write K8s Deployment + Service + HPA for all 6 services
- Write K8s ConfigMaps, Secrets (example values only), Ingress for gateway
- Add kubectl rollout + rollback step to CD workflow (cd.yml)
- Verify: kubectl get pods -n banking shows all Running after deploy

### Sync Points — agree on these before splitting
- Mexo's CD workflow calls Sam's K8s manifests — agree on manifest file paths and image tag variable names before starting
- Sam creates ECR repos in Terraform first so Mexo can configure the push targets in CD
- Merge gate: one git push to main triggers full pipeline end-to-end — pods Running in cluster

---

## Phase 5 — Observability and hardening (Week 8)
Mexo instruments the services and builds the Grafana dashboards. Sam wires up Prometheus alerts, centralised logging with Loki, and the k6 load test.

### Mexo: Metrics instrumentation + Grafana dashboards
**Branch:** `phase/5-mexo-metrics-dashboards`

- Add prom-client to all 6 services, expose GET /metrics on each
- Instrument shared HTTP metrics: requests_total, duration histogram, in-flight gauge
- Add service-specific metrics (accounts_created, transfers_by_status, saga_compensations, fraud_alerts_by_rule, kafka_consumer_lag)
- Deploy Prometheus to K8s with scrape config for all services
- Export Grafana dashboard JSON: banking-overview (4 panels)
- Export Grafana dashboard JSON: transfer-deep-dive (heatmap + stacked bar)
- Export Grafana dashboard JSON: fraud-monitoring (pie + time series)
- Export Grafana dashboard JSON: infrastructure (CPU/memory grid per pod)
- Configure Grafana provisioning to auto-load all 4 dashboards and Prometheus datasource

### Sam: Alertmanager + Loki logging + k6 load test
**Branch:** `phase/5-sam-alerts-logging-loadtest`

- Write all 6 Prometheus alerting rules (HighErrorRate, HighLatencyP99, FraudSpike, SagaCompensations, KafkaLag, ServiceDown)
- Deploy Alertmanager with routing: critical -> PagerDuty mock, warning -> Slack webhook
- Deploy Grafana Loki + Promtail DaemonSet on all nodes
- Configure Promtail to scrape banking namespace pods, add app/pod/container labels
- Retrofit all 6 services with winston JSON logger (level, message, service, requestId, userId)
- Provision Loki as Grafana datasource alongside Prometheus
- Write k6 load test: 100 VUs, 5min, ramp up/sustain/ramp down scenario
- Write k6 seed script: 200 test accounts with 10000 balance each
- Set k6 thresholds: p95 < 500ms, error rate < 1%, checks > 99%
- Verify: deliberately cause 500 error -> HighErrorRate alert fires within 2 min

### Sync Points — agree on these before splitting
- Mexo's /metrics endpoint must be live before Sam can write alert rules that reference custom metric names — share metric names on day 1
- Sam's winston logger adds requestId to every log — Mexo must forward X-Request-Id header through all service calls for this to work end-to-end
- Merge gate: k6 load test passes all thresholds + HighErrorRate alert fires on demand + all 4 dashboards show live data
