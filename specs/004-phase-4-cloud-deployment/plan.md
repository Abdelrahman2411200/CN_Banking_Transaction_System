# Implementation Plan: Phase 4 Cloud Deployment and CI/CD

**Branch**: `004-phase-4-cloud-deployment` | **Date**: 2026-04-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-phase-4-cloud-deployment/spec.md`

## Summary

Phase 4 moves the CN Banking Transaction System from a local Compose runtime toward a cloud-native deployment model. The work will harden all six service images, define AWS infrastructure with Terraform modules, publish Kubernetes manifests for EKS, and add GitHub Actions CI/CD that builds, scans, pushes, provisions, deploys, and rolls back with OIDC-based AWS access.

The repo is currently a Node.js workspace with TypeScript services plus a JavaScript `api-gateway`. The plan treats that as an implementation constraint: the gateway must gain a deterministic build output contract before its production image copies compiled/build artifacts only.

## Technical Context

**Language/Version**: Node.js 20 for production images; TypeScript 5.8 workspace packages; JavaScript `api-gateway` to receive a build-compatible output contract  
**Primary Dependencies**: Express, KafkaJS, PostgreSQL `pg`, MongoDB driver, ioredis, jsonwebtoken, Terraform, AWS provider, Kubernetes manifests, GitHub Actions, Trivy, Codecov  
**Storage**: AWS RDS PostgreSQL 15 for accounts/transfers; ElastiCache Redis 7; MongoDB-compatible persistence for current ledger/fraud compatibility; ECR; S3/DynamoDB Terraform state and locks  
**Testing**: npm lint/typecheck/test, Docker Compose integration tests, docker build validation, Trivy scans, Terraform validate/plan, Kubernetes rollout checks  
**Target Platform**: AWS EKS 1.29 on managed node groups, ALB ingress with ACM TLS, ECR image registry  
**Project Type**: Cloud-native microservices infrastructure and delivery pipeline  
**Performance Goals**: At least two replicas per internal service, three gateway replicas, HPA up to ten replicas on CPU > 70% or memory > 80%, public traffic only through TLS ALB  
**Constraints**: No secrets in images or committed tfvars; containers run non-root; Kubernetes root filesystems are read-only; EKS nodes and data services stay private; GitHub Actions uses AWS OIDC  
**Scale/Scope**: Six services, Redis, Kafka, account/transfer PostgreSQL databases, MongoDB-compatible ledger/fraud store, dev/prod Terraform environments, namespace `banking`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution at `.specify/memory/constitution.md` is still the stock placeholder and defines no enforceable project-specific gates. Interim gates derived from the Phase 4 request:

- Images must be multi-stage, Node 20 Alpine, non-root, healthchecked, and free of embedded secrets.
- Infrastructure must expose only ALB 443 publicly and deny direct public inbound access to nodes and data services.
- Terraform state must use S3 plus DynamoDB locking, with real backend values and tfvars outside the repository.
- Kubernetes manifests must separate config from secrets and include probes, resources, HPA, and non-root security contexts.
- CI/CD must verify PRs and deploy `main` through OIDC-authenticated AWS access.

Gate status before research: PASS. No unresolved clarification remains; repo-specific gaps are tracked as design decisions in `research.md`.

Gate status after design: PASS. The design preserves the requested controls and explicitly accounts for the existing MongoDB dependency and JavaScript gateway build mismatch.

## Project Structure

### Documentation (this feature)

```text
specs/004-phase-4-cloud-deployment/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- deployment-contract.md
|   |-- kubernetes-contract.md
|   `-- terraform-outputs.md
`-- tasks.md
```

`tasks.md` is intentionally not created by this planning step. Generate it next with `speckit-tasks`.

### Source Code (repository root)

```text
services/
|-- api-gateway/
|-- account-service/
|-- transfer-service/
|-- ledger-service/
|-- fraud-service/
`-- notification-service/

shared/
|-- kafka/
`-- types/

infra/
|-- db-init/
|-- kafka/
|-- mongodb/
|-- terraform/
|   |-- modules/
|   |   |-- networking/
|   |   |-- eks/
|   |   |-- databases/
|   |   |-- messaging/
|   |   `-- registry/
|   `-- environments/
|       |-- dev/
|       `-- prod/
`-- k8s/

.github/workflows/
|-- ci.yml
`-- cd.yml

docker-compose.test.yml
README.md
```

**Structure Decision**: Preserve the existing workspace service layout and add cloud deployment assets under `infra/terraform`, `infra/k8s`, and `.github/workflows`. Keep Dockerfiles beside each service so local and CI builds share the same paths.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| MongoDB-compatible backing store beyond the user-listed RDS/Redis module scope | Ledger and fraud services currently depend on `MONGODB_URI` and MongoDB driver behavior | Omitting it would produce a cloud deployment where two existing services cannot start or persist events |
| Gateway build contract work before Docker hardening | `api-gateway` currently runs JavaScript from `src/` and lacks a TypeScript build output | Copying source directly into the runner image would violate the requested compiled/build output-only production image pattern |
