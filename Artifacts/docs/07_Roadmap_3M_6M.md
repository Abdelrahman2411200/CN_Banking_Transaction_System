# Roadmap — 3 Months / 6 Months
# Cloud-Native Banking Transaction System

## 1. Delivery Strategy

The roadmap is split into:

- **0–3 months:** MVP + production-style baseline
- **3–6 months:** hardening, scale patterns, and advanced platform features

The sequencing prioritizes:
1. correctness of transfer workflow
2. observability and testability
3. deployment automation
4. production-like polish

---

## 2. 3-Month Roadmap

# Month 1 — Core Domain Foundation

## Goals
- establish repository and engineering standards
- implement account and transfer foundations
- run services locally with containers

## Deliverables
- mono-repo or multi-service repo structure
- shared libraries for auth, logging, correlation ids
- account service
- transfer service
- PostgreSQL schemas and migrations
- Dockerfiles for all implemented services
- Docker Compose local stack
- seed data and local bootstrap scripts

## Milestones
### Milestone 1.1
- repo initialized
- CI pipeline skeleton created
- linting and unit tests configured

### Milestone 1.2
- account CRUD complete
- freeze/unfreeze logic complete
- transfer initiation complete
- idempotency implemented

### Milestone 1.3
- local demo of account creation and transfer success/failure paths

## Exit Criteria
- local environment runs end-to-end
- successful transfer changes balances correctly
- duplicate transfer retry is safe

---

# Month 2 — Ledger, Fraud, and Observability

## Goals
- complete downstream event-driven processing
- add operational visibility
- validate business-critical flows end-to-end

## Deliverables
- Kafka integration
- ledger service with immutable entries
- fraud service with initial rules
- notification service with simulated sink
- health/readiness endpoints
- Prometheus metrics
- Grafana dashboards
- Alertmanager rules
- integration test suite

## Milestones
### Milestone 2.1
- `transfer.completed` event published and consumed
- ledger entries created automatically

### Milestone 2.2
- fraud rules generate alerts
- notification flow operational

### Milestone 2.3
- dashboards show transfer throughput, latency, and fraud alerts

## Exit Criteria
- transfer → ledger → fraud → notification flow is working
- service health and metrics are observable
- alerts can be demonstrated

---

# Month 3 — Deployment Automation and Production-Style Baseline

## Goals
- move from local-only to cloud-native deployment
- make the project recruiter-ready and interview-ready

## Deliverables
- Terraform base infrastructure
- Kubernetes manifests / Helm or Kustomize
- CI/CD with build, test, scan, deploy
- image registry integration
- smoke tests after deployment
- polished README and architecture docs
- demo screenshots / walkthrough

## Milestones
### Milestone 3.1
- Terraform provisions network and runtime dependencies

### Milestone 3.2
- pipeline pushes images and deploys environment

### Milestone 3.3
- end-to-end demo available in deployed environment

## Exit Criteria
- MVP is fully documented
- services deploy from pipeline
- dashboards and alerts work in deployed environment
- project is presentation-ready

---

## 3. 3-Month Deliverable Snapshot

At the end of Month 3, the project should include:

- account service
- transfer service
- ledger service
- fraud service
- notification service
- API gateway
- Docker Compose environment
- Terraform base infra
- Kubernetes deployment
- Prometheus/Grafana/Alertmanager
- CI/CD pipeline
- tests and documentation

---

## 4. 6-Month Roadmap

# Months 4–6 — Hardening, Scale, and Advanced Features

## Strategic Themes
- reliability and resilience
- deeper observability
- operational sophistication
- stronger fintech realism

---

# Month 4 — Reliability Hardening

## Goals
- strengthen failure handling and operational recovery

## Deliverables
- dead-letter queue strategy
- retry policy standardization
- distributed tracing with OpenTelemetry
- improved audit trail read models
- load testing with k6
- backup/restore runbook

## Success Measures
- failed consumer flows become visible and recoverable
- traces connect gateway to downstream services
- load test baseline established

---

# Month 5 — Advanced Platform Features

## Goals
- improve deployment safety and environment maturity

## Deliverables
- canary or blue/green deployment strategy
- secrets rotation workflow
- environment promotion controls
- automated rollback policy
- policy-as-code / image admission checks
- SLO dashboards

## Success Measures
- deployment risk is reduced
- rollback path is documented and testable
- SLO visibility exists for core endpoints

---

# Month 6 — Product Expansion

## Goals
- extend domain realism beyond pure MVP

## Deliverables
- transfer reversal workflow with approval
- daily transfer limits
- suspicious beneficiary rules
- admin review UI or lightweight dashboard
- reconciliation report job
- public portfolio demo script / video guide

## Success Measures
- domain depth increases beyond CRUD + transfer
- reviewer can see business evolution path
- system feels closer to a real fintech platform

---

## 5. Prioritization Matrix

## Must Have by Month 3
- account lifecycle
- transfer orchestration
- idempotency
- ledger
- fraud rules
- CI/CD
- Terraform
- metrics and alerts

## Should Have by Month 6
- tracing
- DLQ
- load tests
- rollout strategy
- admin review flows

## Could Have by Month 6
- admin UI
- advanced fraud scoring
- reconciliation engine
- service mesh

---

## 6. Key Dependencies

- stable database migrations
- event schemas finalized early
- cloud account and registry access
- pipeline secrets configured
- observability stack sized for target environment

---

## 7. Risks to Roadmap

### Risk: Overbuilding architecture before MVP
Mitigation:
- finish transfer-critical path first

### Risk: Too many infra features too early
Mitigation:
- delay advanced deployment patterns until Month 4+

### Risk: Incomplete documentation
Mitigation:
- document as features land, not after everything is built

---

## 8. Recommended Sprint Theme Breakdown

### Sprint Theme A
foundation and repo setup

### Sprint Theme B
accounts and transfers

### Sprint Theme C
ledger and events

### Sprint Theme D
fraud and notifications

### Sprint Theme E
observability and testing

### Sprint Theme F
deployment and polish

---

## 9. Final Outcome

By Month 3, this project should already be a strong recruiter-facing artifact.  
By Month 6, it should look like a small but credible fintech platform with real operational depth.
