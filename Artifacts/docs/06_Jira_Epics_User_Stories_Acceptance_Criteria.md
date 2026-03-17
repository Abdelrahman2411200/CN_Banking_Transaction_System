# User Stories + Acceptance Criteria
# Jira Epics for Cloud-Native Banking Transaction System

## Structure

Each epic below is written in a Jira-friendly format:

- **Epic Goal**
- **Stories**
- **Acceptance Criteria**

---

# EPIC 1 — Identity, Access, and Security Foundation

## Epic Goal
Establish secure authentication, authorization, secrets handling, and request traceability across the platform.

### Story 1.1 — JWT Authentication
**As an** API consumer  
**I want** to authenticate using JWT  
**So that** only authorized clients can access banking APIs

**Acceptance Criteria**
- valid JWT allows access to permitted endpoints
- missing or invalid JWT returns `401 UNAUTHORIZED`
- expired JWT returns `401 UNAUTHORIZED`
- correlation id is included in auth failure responses

### Story 1.2 — Role-Based Authorization
**As an** administrator  
**I want** permissions enforced by role  
**So that** only approved actors can perform sensitive operations

**Acceptance Criteria**
- admin can perform all account and fraud review operations
- operations role can create accounts and transfers
- auditor role can access read-only ledger and fraud endpoints
- forbidden requests return `403 FORBIDDEN`

### Story 1.3 — Secrets Management
**As a** platform engineer  
**I want** secrets injected securely  
**So that** credentials are not stored in code or container images

**Acceptance Criteria**
- no credentials are committed to source control
- local development uses `.env.example` without real values
- deployed environments source secrets from secure store or K8s secrets

---

# EPIC 2 — Account Lifecycle Management

## Epic Goal
Support account creation, retrieval, status updates, and balance visibility.

### Story 2.1 — Create Account
**As an** operations user  
**I want** to create a bank account  
**So that** the customer can hold funds and transact

**Acceptance Criteria**
- account is created with unique account id and account number
- initial balance is stored correctly
- duplicate external customer id is rejected
- `account.created` event is emitted

### Story 2.2 — View Account Details
**As an** operations user  
**I want** to retrieve account details  
**So that** I can verify current account state

**Acceptance Criteria**
- account API returns profile, status, currency, and balances
- unknown account id returns `404 ACCOUNT_NOT_FOUND`

### Story 2.3 — Freeze Account
**As an** operations user  
**I want** to freeze a suspicious account  
**So that** it cannot participate in transfers

**Acceptance Criteria**
- freeze action changes status to `FROZEN`
- account status history is persisted
- frozen sender or receiver is blocked in transfer workflow
- `account.frozen` event is emitted

### Story 2.4 — Unfreeze Account
**As an** operations user  
**I want** to reactivate an account  
**So that** normal transfer activity can resume

**Acceptance Criteria**
- account status changes from `FROZEN` to `ACTIVE`
- unfreeze action is audited

---

# EPIC 3 — Transfer Orchestration and Money Movement

## Epic Goal
Enable reliable internal transfers with strong consistency and safe retries.

### Story 3.1 — Initiate Transfer
**As an** authorized client  
**I want** to transfer money between two accounts  
**So that** value can move securely inside the system

**Acceptance Criteria**
- transfer succeeds only when both accounts exist and are active
- transfer amount must be positive
- currency must match supported account currency
- successful response includes transaction id and reference

### Story 3.2 — Enforce Sufficient Funds
**As a** system  
**I want** to reject overdrawing transfers  
**So that** sender balances remain correct

**Acceptance Criteria**
- transfer is rejected when available balance is less than amount
- no debit or credit occurs for rejected transfer
- failure response uses `INSUFFICIENT_FUNDS`

### Story 3.3 — Protect Against Duplicate Retries
**As an** API consumer  
**I want** retries to be safe  
**So that** network errors do not create duplicate money movement

**Acceptance Criteria**
- repeated request with same idempotency key and same payload returns original result
- repeated request with same key and different payload returns `409 IDEMPOTENCY_CONFLICT`
- only one financial effect is recorded

### Story 3.4 — Persist Transaction State
**As an** auditor  
**I want** every transfer attempt to have a durable state  
**So that** completed and failed requests are traceable

**Acceptance Criteria**
- transfer record stores status, timestamps, correlation id
- failed/rejected requests have failure code and reason when applicable

---

# EPIC 4 — Immutable Ledger

## Epic Goal
Create a reliable append-only ledger for successful transfers.

### Story 4.1 — Write Double-Entry Ledger Records
**As an** auditor  
**I want** every completed transfer to generate debit and credit entries  
**So that** financial movement is independently traceable

**Acceptance Criteria**
- each completed transfer produces exactly two ledger entries
- debit entry belongs to sender account
- credit entry belongs to receiver account
- ledger entries reference transaction id

### Story 4.2 — Prevent Ledger Mutation
**As a** governance reviewer  
**I want** ledger records to be immutable  
**So that** accounting history cannot be silently altered

**Acceptance Criteria**
- application exposes no update or delete endpoint for ledger entries
- DB permissions or app logic prevent mutation in normal flows

### Story 4.3 — Query Ledger by Transaction and Account
**As an** auditor  
**I want** searchable ledger views  
**So that** I can inspect financial history efficiently

**Acceptance Criteria**
- transaction query returns all related entries
- account query is paginated and ordered by timestamp descending

---

# EPIC 5 — Fraud Detection and Alerting

## Epic Goal
Evaluate transfer events and create actionable fraud alerts.

### Story 5.1 — Evaluate High-Amount Rule
**As a** fraud analyst  
**I want** unusually large transfers flagged  
**So that** suspicious behavior is highlighted quickly

**Acceptance Criteria**
- transfer amount above configured threshold creates alert
- alert stores risk score and primary reason
- rule hit is stored for explainability

### Story 5.2 — Evaluate Velocity Rule
**As a** fraud analyst  
**I want** rapid repeated transfers flagged  
**So that** suspicious bursts are visible

**Acceptance Criteria**
- multiple transfers from same account inside configured window increase risk
- alert is created when threshold is reached

### Story 5.3 — Review Fraud Alert
**As an** operations user  
**I want** to mark an alert as confirmed or dismissed  
**So that** investigations are traceable

**Acceptance Criteria**
- review endpoint updates status and reviewer metadata
- audit log captures review action

---

# EPIC 6 — Notifications and Event Consumers

## Epic Goal
Communicate important system events to downstream consumers and operators.

### Story 6.1 — Notify on Completed Transfer
**As a** system consumer  
**I want** transfer completion notifications  
**So that** downstream systems can react

**Acceptance Criteria**
- transfer completion event triggers notification processing
- delivery result is logged

### Story 6.2 — Notify on Fraud Alert
**As an** operations user  
**I want** to be notified when a high-risk alert occurs  
**So that** I can investigate quickly

**Acceptance Criteria**
- high severity fraud alert triggers dispatch request
- failed notification attempts are retried or logged

---

# EPIC 7 — Observability and Operability

## Epic Goal
Make the platform measurable, debuggable, and alertable.

### Story 7.1 — Expose Metrics
**As an** SRE  
**I want** Prometheus metrics from every service  
**So that** I can monitor throughput, latency, and errors

**Acceptance Criteria**
- every service exposes `/metrics`
- request count, duration, and error metrics are available
- business counters for completed transfers and fraud alerts exist

### Story 7.2 — Structured Logging
**As an** engineer  
**I want** structured logs with correlation id  
**So that** I can trace requests across services

**Acceptance Criteria**
- logs are JSON formatted
- correlation id appears in gateway and downstream logs
- errors include code and context fields

### Story 7.3 — Alerting Rules
**As an** on-call engineer  
**I want** automated alerts for critical failures  
**So that** incidents are detected quickly

**Acceptance Criteria**
- service down alert exists
- high 5xx error rate alert exists
- high p95 latency alert exists
- consumer lag alert exists

---

# EPIC 8 — CI/CD and Infrastructure as Code

## Epic Goal
Automate build, test, scan, provisioning, and deployment.

### Story 8.1 — Build and Test Pipeline
**As a** developer  
**I want** automated CI for every change  
**So that** regressions are detected early

**Acceptance Criteria**
- pipeline runs lint, unit tests, and integration tests
- build fails on failed tests
- pipeline produces versioned Docker images

### Story 8.2 — Security Scanning
**As a** platform engineer  
**I want** dependency and image scans in CI  
**So that** known vulnerabilities are visible before deploy

**Acceptance Criteria**
- dependency scan stage exists
- image scan stage exists
- high severity issues fail or warn based on policy

### Story 8.3 — Infrastructure Provisioning
**As a** platform engineer  
**I want** Terraform-managed environments  
**So that** infrastructure is reproducible

**Acceptance Criteria**
- base network, compute, and supporting resources are provisioned with Terraform
- plan and apply are separated by environment controls

### Story 8.4 — Automated Deployment
**As a** developer  
**I want** the system deployed automatically after successful pipeline checks  
**So that** environments stay consistent with main branch

**Acceptance Criteria**
- deployment manifests are versioned
- post-deploy smoke tests run
- failed deployment marks pipeline unsuccessful

---

# EPIC 9 — Quality Engineering

## Epic Goal
Provide confidence through automated testing.

### Story 9.1 — Unit Tests
**As a** developer  
**I want** unit test coverage for service logic  
**So that** core domain rules are protected

**Acceptance Criteria**
- balance validation tests exist
- fraud rule tests exist
- idempotency logic tests exist

### Story 9.2 — Integration Tests
**As a** QA engineer  
**I want** cross-service integration tests  
**So that** event flow and data persistence are verified

**Acceptance Criteria**
- transfer success test verifies account balances, transaction record, and ledger entries
- fraud-triggering transfer test verifies alert creation

### Story 9.3 — Contract Tests
**As an** API consumer  
**I want** stable API contracts  
**So that** client integrations do not break unexpectedly

**Acceptance Criteria**
- contract tests validate request and response schema
- breaking changes are caught in CI

---

# EPIC 10 — Demo and Portfolio Readiness

## Epic Goal
Present the project clearly for recruiter and interviewer evaluation.

### Story 10.1 — Architecture Documentation
**As a** reviewer  
**I want** a clear architecture document  
**So that** I can quickly understand the system

**Acceptance Criteria**
- service boundaries, data flow, and deployment model are documented
- key design trade-offs are explained

### Story 10.2 — Demo Scenario
**As a** recruiter  
**I want** a reproducible demo flow  
**So that** I can see the project value quickly

**Acceptance Criteria**
- demo script includes account creation, transfer, ledger query, and fraud alert query
- sample data is available for local run

### Story 10.3 — README Quality
**As a** hiring manager  
**I want** a polished repository README  
**So that** I can assess maturity at a glance

**Acceptance Criteria**
- README includes architecture, setup, screenshots, and roadmap
- local run instructions are complete
