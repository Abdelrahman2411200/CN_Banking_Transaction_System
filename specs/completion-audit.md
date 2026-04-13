# CN Banking Transaction System Completion Audit

**Audit date**: 2026-04-13  
**Repo commit audited**: `2efb9cb` (`main`)  
**Scope**: Compared the implementation against the active artifacts in `specs/`, with emphasis on Phase 2 and Phase 4 because they are the current maintained plans.

## Executive Summary

The system is substantially implemented through Phase 4. Core banking services, event-driven Phase 2 services, gateway hardening, Dockerfiles, Terraform modules, Kubernetes manifests, and GitHub Actions are present.

The biggest remaining work is not local `.env` wiring. GitHub Actions cannot read the local `.env` file. CD needs GitHub repository variables/secrets, AWS bootstrap resources, ECR repositories available before image push, and an EKS runner path that can reach the private cluster endpoint.

## Spec Artifact Status

| Spec folder | Tracking status | Implementation status | Notes |
| --- | ---: | --- | --- |
| `specs/001-phase-1-rebuild` | `0/106` tasks checked | Mostly implemented | Task file is stale. The codebase now contains account/transfer services, migrations, shared types, and tests. Reconcile or archive this historical task file. |
| `specs/phase-2-plan` | `49/51` tasks checked | Mostly implemented | Remaining tasks are final validation: run Phase 2 E2E against Compose and run root validation commands. |
| `specs/002-phase-2-distributed-ledger` | `0/38` tasks checked | Superseded/duplicate | This appears to be an older alternate Phase 2 plan. Its work is mostly represented by `specs/phase-2-plan`; mark it superseded or update checkboxes to prevent confusion. |
| `specs/004-phase-4-cloud-deployment` | `80/80` tasks checked | Implemented, external cloud setup pending | Local infrastructure artifacts exist. Full completion depends on GitHub/AWS/EKS environment configuration and a successful live CD run. |

## What Is Done

### Phase 1 Core Banking

- Account and transfer service source files exist under `services/account-service/src/` and `services/transfer-service/src/`.
- Shared TypeScript package exists under `shared/types/src/`.
- Database migrations exist under `infra/db-init/migrations/accounts/` and `infra/db-init/migrations/transfers/`.
- Unit/integration test files exist for account routes, transfer SAGA behavior, and transfer integration behavior.
- Current implementation includes later-phase additions such as account freeze handling, outbox event emission, and metrics.

### Phase 2 Event Backbone and Downstream Services

- Kafka/Zookeeper, MongoDB, ledger-service, fraud-service, and notification-service are wired into `docker-compose.yml`.
- Shared event contracts exist in `shared/types/src/events.ts`, including `bank.account.created`, `bank.transfer.initiated`, `bank.transfer.completed`, `bank.transfer.failed`, and `bank.fraud.alert`.
- Transactional outbox helpers exist in `shared/types/src/outbox.ts`.
- Ledger, fraud, and notification services have service workspaces, consumers, APIs, and tests.
- Phase 2 integration tests exist under `tests/integration/`, including event backbone, ledger, fraud, transfer, and E2E coverage.

### Phase 3 Gateway and Local Service Isolation

- `api-gateway` exists and listens on port `8080`.
- Gateway middleware includes security headers, request logging, metrics, global rate limiting, auth routes, JWT auth, route-specific rate limiting, idempotency on `POST /v1/transfers`, admin-only routes, and proxy routing.
- Local `docker-compose.yml` exposes only `api-gateway` on host port `8080`; internal microservices are on `banking-net` without host `ports`.
- Redis is present locally for gateway rate-limiting, idempotency, and token blacklist usage.

### Phase 4 Cloud Deployment

- Six production Dockerfiles exist and are validated by `tests/container/dockerfile-policy.test.mjs`.
- Terraform AWS modules exist for networking, EKS, databases, messaging, and registry, with dev/prod environments.
- Kubernetes manifests exist under `infra/k8s/` for namespace, ingress, secrets, service deployments, ClusterIP services, HPAs, PDBs, and NetworkPolicies.
- GitHub Actions CI exists in `.github/workflows/ci.yml`.
- GitHub Actions CD exists in `.github/workflows/cd.yml`, using OIDC, ECR login, Terraform plan/apply, manifest rendering, rollout checks, and rollback on rollout failure.
- CD was recently fixed so `AWS_REGION` and `PUBLIC_DOMAIN` can come from GitHub variables or legacy secrets, and `ECR_REGISTRY` can be derived from the ECR login action.

### Observability Work Present But Not Spec-Tracked

- Metrics and structured logging have been added across services using `prom-client` and `winston`.
- `/metrics` endpoints exist in services and gateway.
- Prometheus, Grafana, Loki, Promtail, and Alertmanager manifests/configs exist under `infra/monitoring/` and `infra/k8s/monitoring/`.
- This looks like Phase 5 work, but there is no matching `specs/005-*` folder yet.

## What We Still Need To Do

### Must Do Before Calling Phase 4 Production-Ready

1. Configure GitHub Actions variables/secrets in GitHub, not in local `.env`.

Required repository variables:

```text
AWS_REGION
PUBLIC_DOMAIN
```

Required repository secrets:

```text
AWS_ROLE_ARN
TF_STATE_BUCKET
TF_LOCK_TABLE
DB_ACCOUNTS_PASSWORD
DB_TRANSFERS_PASSWORD
REDIS_PASSWORD
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
ACM_CERTIFICATE_ARN
MONGODB_PASSWORD
KAFKA_SCRAM_PASSWORD
```

Optional:

```text
ECR_REGISTRY
```

2. Bootstrap Terraform remote state manually before first CD apply.

Needed in AWS:

```text
S3 bucket for Terraform state
DynamoDB table for Terraform locking
```

3. Resolve first-run ECR ordering.

Current CD builds and pushes images before Terraform runs. That means the six ECR repositories must already exist before the first CD run, or the build-and-push job will fail. Options:

- Manually create the six ECR repositories once.
- Run the registry Terraform module/apply once before enabling image push.
- Split CD so Terraform registry provisioning happens before image push on bootstrap.

4. Ensure the CD runner can reach EKS.

Terraform defaults/docs indicate the EKS API endpoint is private-oriented. GitHub-hosted runners usually cannot reach a private EKS endpoint. Use one of:

- A self-hosted GitHub runner inside the VPC.
- A VPN/private network path for the runner.
- Temporarily allow a tightly scoped public EKS endpoint CIDR for bootstrap only.

5. Run a real cloud deployment verification.

Required evidence:

```text
terraform plan/apply succeeds in prod
kubectl get pods -n banking shows service pods Running/Ready
curl https://<PUBLIC_DOMAIN>/health returns 200
rollback is demonstrated with kubectl rollout undo
```

### Should Do For Spec Hygiene

- Reconcile or archive `specs/001-phase-1-rebuild/tasks.md`; it is fully unchecked but implementation exists.
- Reconcile or archive `specs/002-phase-2-distributed-ledger/tasks.md`; it appears superseded by `specs/phase-2-plan/tasks.md`.
- Mark or close `specs/phase-2-plan/tasks.md` tasks T050 and T051 only after running the requested Phase 2 E2E and root validation commands.
- Create a `specs/005-*` spec for the observability work already present in the repo.
- Document whether monitoring manifests are part of Phase 4 deployment or Phase 5 observability deployment.

### Should Do For Security/Operations

- Do not commit `.env`; it is correctly ignored and cannot be linked to GitHub Actions.
- Keep `infra/k8s/secrets.yaml` placeholder-only; real Kubernetes secrets should be generated by CD or managed externally.
- Replace placeholder monitoring secrets, especially Grafana and Alertmanager values, through GitHub/AWS/Kubernetes secret management before any real cluster deployment.
- Decide whether local Compose should continue exposing Kafka/Postgres/MongoDB for development; Phase 3 app services are isolated, but local infra ports may still be exposed depending on test/dev needs.

## Validation Evidence From This Audit

Passed:

```text
npm run test:containers
terraform validate in infra/terraform/environments/dev
terraform validate in infra/terraform/environments/prod
git diff --check
```

Recently passed during the same work session:

```text
npm run lint
npm run typecheck
docker compose -f docker-compose.test.yml config
```

Not fully validated in this audit:

```text
Full docker-compose.yml runtime smoke test
docker-compose.test.yml full integration run
kubectl apply --dry-run against a live cluster
real GitHub Actions CI/CD rerun result
real AWS Terraform apply
real EKS rollout and live /health check
```

Kubernetes schema validation note:

`kubeconform` was attempted, but it timed out while downloading Kubernetes schemas from GitHub because DNS/network access to `raw.githubusercontent.com` failed. This is an audit environment/network limitation, not a confirmed manifest failure.

## Current Completion Assessment

- Local application implementation: mostly complete through Phase 4.
- Spec/task tracking: needs cleanup because multiple historical task files are stale or duplicated.
- Phase 2: functionally implemented, but final validation tasks remain open in the maintained `phase-2-plan`.
- Phase 4: implementation artifacts are complete locally, but production readiness is blocked until GitHub/AWS/EKS external setup and a successful live CD run are proven.
- Phase 5 observability: partially implemented in code/manifests, but missing a formal spec/tasks folder.

