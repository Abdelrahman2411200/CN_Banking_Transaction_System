# Product Requirements Document (PRD)
# Cloud-Native Banking Transaction System

## 1. Document Control

- **Project Name:** Cloud-Native Banking Transaction System
- **Document Type:** Product Requirements Document
- **Version:** 1.0
- **Status:** Draft for implementation
- **Owner:** Product / Engineering
- **Primary Audience:** Engineering, DevOps, QA, reviewers, recruiters

---

## 2. Product Summary

The Cloud-Native Banking Transaction System is a production-inspired backend platform that simulates the core functions of a digital bank. It enables secure account lifecycle management, internal account-to-account transfers, immutable ledger recording, fraud alert generation, and operational observability. The project is intentionally designed to demonstrate both **backend engineering** and **DevOps maturity** through microservices, infrastructure as code, CI/CD automation, and monitoring.

This is **not** a consumer-facing banking application integrated with real payment rails. It is a portfolio-grade, enterprise-style simulation of modern banking architecture.

---

## 3. Problem Statement

Many backend and DevOps portfolios demonstrate isolated services but fail to show how enterprise systems behave under real operational constraints such as:

- data consistency during money movement
- idempotent transaction processing
- append-only financial records
- asynchronous downstream processing
- fraud flagging
- deployment automation
- production observability
- operational recovery and failure handling

This project solves that gap by packaging these concerns into one coherent banking system.

---

## 4. Product Vision

Build a cloud-native banking backend that looks, behaves, and is documented like a small-scale enterprise financial platform.

---

## 5. Product Goals

### Primary Goals

1. Demonstrate a realistic microservices banking domain.
2. Showcase DevOps and cloud-native engineering capabilities.
3. Provide an end-to-end example of account management and money transfer lifecycle.
4. Prove production awareness through observability, security, and reliability patterns.
5. Serve as a recruiter-facing portfolio project with real architectural depth.

### Secondary Goals

1. Provide a base for future extensions such as cards, limits, AML scoring, and analytics.
2. Support local development, containerized execution, and cloud deployment.
3. Enable integration testing and smoke testing in CI/CD.

---

## 6. Success Metrics

### Product KPIs

- account creation success rate >= 99%
- transfer request acceptance success rate >= 99% for valid requests
- duplicate transfer protection via idempotency: 100% for same key + same payload
- ledger write completion for successful transfers: 100%
- fraud rules evaluated for 100% of transfer events
- p95 API latency:
  - account reads < 200 ms
  - transfer initiation < 500 ms
- service uptime target in test/prod-like environment >= 99.5%
- alert generation for critical system failures within 1 minute

### Portfolio KPIs

- all services containerized
- full CI pipeline green on main branch
- infra provisioned through Terraform
- monitoring dashboards available
- architecture, API, and data model documented

---

## 7. Target Users / Personas

### Persona 1 — Platform Recruiter
Needs proof of practical backend and DevOps skill in one repository.

### Persona 2 — Engineering Manager
Needs evidence of distributed systems thinking, system ownership, and documentation discipline.

### Persona 3 — Backend Engineer Reviewer
Evaluates API design, transaction handling, idempotency, data consistency, and service boundaries.

### Persona 4 — DevOps/SRE Reviewer
Evaluates CI/CD, containerization, deployment model, monitoring, logging, health checks, and alerting.

---

## 8. Scope

## In Scope (MVP)

- user authentication for system access
- account creation and retrieval
- account freeze/unfreeze
- account balance query
- internal transfer initiation
- immutable ledger entries for transfer movements
- fraud rules engine with alert generation
- notification emission for selected events
- API gateway / reverse proxy
- Docker-based local environment
- Terraform-based infrastructure provisioning
- CI/CD pipeline for build, test, scan, and deploy
- Prometheus + Grafana + Alertmanager
- centralized structured logging
- health/readiness probes

## In Scope (Phase 2)

- transfer reversal workflow with approvals
- rate limiting and API keys for service consumers
- distributed tracing
- canary deployment
- Kafka dead-letter queue handling
- admin dashboard or simple web UI
- audit query endpoints
- RBAC expansion

## Out of Scope

- real banking core integration
- real card processing
- real KYC provider integration
- real SWIFT/ACH/SEPA integration
- customer mobile app
- actual production financial compliance certification

---

## 9. Core User Journeys

### Journey A — Account Creation
1. Authorized operator submits a new account request.
2. System validates identity fields and uniqueness rules.
3. Account is created in active or pending state.
4. Audit event is recorded.
5. Account service emits `account.created`.

### Journey B — Internal Transfer
1. Authorized client submits transfer with idempotency key.
2. Transfer service validates:
   - sender exists and is active
   - receiver exists and is active
   - sender has enough available balance
   - request is not duplicated
3. Transaction record is created with `PENDING`.
4. Funds movement is processed atomically.
5. Ledger entries are appended.
6. Event `transfer.completed` is published.
7. Fraud service evaluates transaction.
8. Notification service emits success notification.

### Journey C — Fraud Alert
1. Transfer event arrives at fraud service.
2. Rules engine computes risk score.
3. If rule threshold is exceeded:
   - alert record is created
   - event `fraud.alert.created` is published
   - notification is triggered
4. Transfer remains visible with linked alert status.

---

## 10. Functional Requirements

## FR-1 Authentication and Authorization
- System shall authenticate API clients using JWT tokens.
- System shall support roles:
  - admin
  - operations
  - auditor
  - service
- System shall deny unauthorized requests with proper error codes.

## FR-2 Account Management
- System shall create an account with unique external customer reference.
- System shall retrieve account profile and balance.
- System shall update account metadata.
- System shall freeze and unfreeze account.
- Frozen accounts shall not send or receive transfers unless override rules exist.

## FR-3 Transfers
- System shall support internal transfer between two existing accounts.
- System shall validate currency compatibility.
- System shall reject transfers with insufficient funds.
- System shall support idempotency for transfer initiation.
- System shall assign a unique transaction reference.

## FR-4 Transaction Ledger
- System shall create append-only ledger entries for all successful balance movements.
- System shall store double-entry semantics:
  - debit entry for sender
  - credit entry for receiver
- Ledger records shall not be updated or deleted through application flows.

## FR-5 Fraud Detection
- System shall evaluate every transfer using deterministic fraud rules.
- Rules shall include at minimum:
  - high amount
  - rapid transfer frequency
  - suspicious beneficiary pattern
  - velocity over time window
- Fraud service shall persist alerts and risk reasons.
- Fraud service shall expose alert retrieval APIs.

## FR-6 Notifications
- System shall emit notification events for:
  - account created
  - account frozen
  - transfer completed
  - transfer failed
  - fraud alert created
- Notification delivery may be simulated through logs or webhook sink in MVP.

## FR-7 Auditability
- System shall record audit metadata for write operations.
- Audit logs shall include actor, action, entity type, entity id, timestamp, correlation id.

## FR-8 Observability
- Every service shall expose metrics endpoint.
- Every request shall include trace/correlation identifiers.
- System shall provide dashboards for throughput, latency, errors, and fraud alerts.

## FR-9 Reliability
- Transfer API shall support retry-safe processing using idempotency key.
- Async consumers shall support retry with backoff.
- Poison messages shall be routed to dead-letter topic/queue.

---

## 11. Non-Functional Requirements

## NFR-1 Performance
- p95 read latency < 200 ms under nominal load
- p95 transfer initiation latency < 500 ms under nominal load
- async fraud evaluation under 2 seconds end-to-end

## NFR-2 Availability
- target environment uptime >= 99.5%
- health/readiness probes must be implemented for all services

## NFR-3 Security
- TLS termination at gateway/load balancer
- service-to-service authentication in cluster
- secrets not stored in source code
- password hashing for local demo identities
- role-based access controls enforced

## NFR-4 Consistency
- balance mutation and transaction record persistence must be atomic per transfer workflow
- ledger entries must reflect completed transfers exactly once

## NFR-5 Scalability
- services should scale independently
- read-heavy endpoints should support caching
- async processing should decouple downstream consumers

## NFR-6 Maintainability
- repository must support local development with Docker Compose
- services must include tests, linting, and typed contracts
- documentation must be sufficient for onboarding

## NFR-7 Observability
- logs must be structured JSON
- metrics must be scrapeable by Prometheus
- alerts must exist for service down, high error rate, high latency

---

## 12. Constraints

- project is a simulation and should not claim regulatory certification
- no real monetary processing or external bank connectivity in MVP
- implementation must remain feasible for a single developer portfolio build
- architecture should remain realistic without over-engineering every edge case

---

## 13. Key Assumptions

- one primary currency in MVP, with optional extensibility for multi-currency later
- internal transfers only
- PostgreSQL is sufficient for service datastores in portfolio scale
- Kafka is used for asynchronous event flow
- Kubernetes deployment is preferred for production-style target

---

## 14. Release Definition

The MVP is considered release-ready when:

- all core services are implemented
- all services run locally via Docker Compose
- CI pipeline runs tests and image builds
- Terraform provisions base environment
- deployment manifests are available
- metrics and dashboards are functional
- transfer workflow is demonstrable end-to-end
- documentation is complete

---

## 15. Risks and Product Mitigations

### Risk: Inconsistent balances during transfer failure
Mitigation:
- atomic database transaction
- transaction state machine
- idempotent reprocessing

### Risk: Duplicate transfer creation from retries
Mitigation:
- idempotency key
- unique key constraints
- deduplication store

### Risk: Fraud evaluation delays or event loss
Mitigation:
- durable message broker
- retry policy
- DLQ + alerting

### Risk: Observability gaps
Mitigation:
- standard logging middleware
- Prometheus instrumentation
- OpenTelemetry traces

---

## 16. Open Questions for Future Versions

- should transfer limits vary by account tier
- should fraud engine support pluggable models
- should admin UI be included in repo MVP
- should event sourcing replace current transaction orchestration
