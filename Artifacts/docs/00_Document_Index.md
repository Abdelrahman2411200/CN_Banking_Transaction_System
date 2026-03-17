# Cloud-Native Banking Transaction System — Document Index

This folder contains the project documentation set for the **Cloud-Native Banking Transaction System**.

## Documents

1. **[01_PRD.md](01_PRD.md)**  
   Product Requirements Document covering scope, objectives, personas, functional requirements, non-functional requirements, and release criteria.

2. **[02_BRD.md](02_BRD.md)**  
   Business Requirements Document covering business case, value proposition, stakeholders, KPIs, risks, and compliance assumptions.

3. **[03_System_Design_Architecture.md](03_System_Design_Architecture.md)**  
   Production-style system design for microservices, deployment topology, observability, security, and failure handling.

4. **[04_Database_Schema.md](04_Database_Schema.md)**  
   Logical and physical data model for all services, including core entities, indexes, constraints, and audit strategy.

5. **[05_API_Contract.md](05_API_Contract.md)**  
   REST API contract with request/response structures, error model, headers, idempotency, and event contracts.

6. **[06_Jira_Epics_User_Stories_Acceptance_Criteria.md](06_Jira_Epics_User_Stories_Acceptance_Criteria.md)**  
   Jira-style epics, user stories, and acceptance criteria aligned to MVP and production-readiness goals.

7. **[07_Roadmap_3M_6M.md](07_Roadmap_3M_6M.md)**  
   Delivery roadmap for 3 months and 6 months with milestones, dependencies, and measurable outcomes.

8. **[08_Pitch_Deck.md](08_Pitch_Deck.md)**  
   Investor/recruiter-ready pitch deck content in slide-by-slide Markdown format.

## Suggested Repository Placement

```text
banking-system/
├── docs/
│   ├── 00_Document_Index.md
│   ├── 01_PRD.md
│   ├── 02_BRD.md
│   ├── 03_System_Design_Architecture.md
│   ├── 04_Database_Schema.md
│   ├── 05_API_Contract.md
│   ├── 06_Jira_Epics_User_Stories_Acceptance_Criteria.md
│   ├── 07_Roadmap_3M_6M.md
│   └── 08_Pitch_Deck.md
└── README.md
```

## Project Assumptions Used Across All Documents

- Domain: **mini digital banking backend simulation**
- Architecture: **cloud-native microservices**
- Core modules: **accounts, transfers, ledger, fraud, notifications, API gateway**
- Communication: **REST + asynchronous events**
- Datastores: **PostgreSQL + Redis**
- Messaging: **Kafka**
- Infra: **Docker, Kubernetes, Terraform**
- CI/CD: **GitHub Actions** (Jenkins can be added later)
- Observability: **Prometheus, Grafana, Alertmanager, OpenTelemetry**
- Security: **JWT, RBAC, secrets management, encryption in transit, audit logging**

## Intended Audience

- Recruiters
- Hiring managers
- technical interviewers
- engineering leads
- DevOps/platform teams
- portfolio reviewers
