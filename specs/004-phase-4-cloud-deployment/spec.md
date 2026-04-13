# Feature Specification: Phase 4 Cloud Deployment and CI/CD

**Feature Branch**: `004-phase-4-cloud-deployment`  
**Created**: 2026-04-11  
**Status**: Draft  
**Input**: User description: "Containerise all six services, provision AWS cloud infrastructure with Terraform, create Kubernetes manifests, and automate CI/CD with GitHub Actions for the CN Banking Transaction System."

## User Scenarios & Testing

### User Story 1 - Production-Ready Service Images (Priority: P1)

As a platform engineer, I need every banking service to build into a small, non-root production container so the system can run safely in Kubernetes and CI can validate image quality.

**Why this priority**: Hardened images are the foundation for EKS deployment and image scanning.

**Independent Test**: Build each service Dockerfile locally or in CI and inspect that it uses Node 20 Alpine, a builder/runner split, a non-root user, a healthcheck, and environment-only configuration.

**Acceptance Scenarios**:

1. **Given** the repo checkout, **When** CI runs docker builds for the six services, **Then** every build succeeds without copying secrets into the image.
2. **Given** a built service image, **When** the container starts, **Then** it runs as `appuser` and exposes only the expected service port with `/health` monitored by Docker healthcheck.
3. **Given** the current JavaScript `api-gateway`, **When** Phase 4 Docker hardening is implemented, **Then** the gateway has a deterministic build output contract so the runner image does not depend on raw source plus dev dependencies.

### User Story 2 - Provision Cloud Infrastructure (Priority: P1)

As an infrastructure engineer, I need Terraform modules and dev/prod environments so the banking platform can provision networking, Kubernetes, databases, messaging, and registry resources repeatably.

**Why this priority**: The Kubernetes deployment and CD pipeline depend on cloud infrastructure being defined and reproducible.

**Independent Test**: Run Terraform format/validate and generate a plan for the dev environment using backend configuration supplied outside the repo.

**Acceptance Scenarios**:

1. **Given** a configured AWS account and manually created S3/DynamoDB state backend, **When** Terraform is initialized for `infra/terraform/environments/dev`, **Then** it loads remote state with locking enabled.
2. **Given** the dev environment variables, **When** Terraform plans, **Then** it includes VPC `10.0.0.0/16`, three public subnets, three private subnets, NAT egress, EKS 1.29, RDS PostgreSQL databases, ElastiCache Redis 7, Kafka messaging, ECR repositories, and a MongoDB-compatible persistence path for ledger/fraud.
3. **Given** EKS nodes and databases, **When** security groups are inspected, **Then** direct inbound traffic to nodes and data stores is denied except allowed paths from ALB/EKS nodes.

### User Story 3 - Deploy Services to Kubernetes (Priority: P2)

As an operator, I need Kubernetes manifests for every service so EKS can run the banking platform with probes, resources, secrets, config, autoscaling, and ALB ingress.

**Why this priority**: Once infrastructure exists, the services need a repeatable cluster deployment contract.

**Independent Test**: Apply manifests to namespace `banking` with placeholder values substituted and verify deployment rollout status plus `/health`.

**Acceptance Scenarios**:

1. **Given** the `banking` namespace, **When** service manifests are applied, **Then** internal services are exposed only through ClusterIP and `api-gateway` is exposed through ALB ingress.
2. **Given** an unhealthy service container, **When** probes execute, **Then** readiness removes it from traffic and liveness restarts it according to the configured delays.
3. **Given** service CPU or memory pressure, **When** metrics exceed thresholds, **Then** HPA can scale from two replicas up to ten replicas, with the gateway starting at three replicas.

### User Story 4 - Automate CI/CD and Rollback (Priority: P2)

As a maintainer, I need GitHub Actions workflows that validate every PR and deploy pushes to `main` so releases are repeatable and do not require manual AWS credentials.

**Why this priority**: The definition of done requires zero-manual-step main deployments with rollback behavior.

**Independent Test**: Open a PR and confirm CI jobs run; merge to `main` in a configured repository and confirm ECR push, Terraform apply, Kubernetes rollout, and rollback-on-failure behavior.

**Acceptance Scenarios**:

1. **Given** a pull request to `main`, **When** CI runs, **Then** lint, typecheck, tests, docker builds, npm audit, Trivy scan, and coverage upload execute without pushing images.
2. **Given** a push to `main` and valid repository secrets, **When** CD runs after CI, **Then** images are pushed to ECR with the commit SHA tag, Terraform applies the saved planfile, and deployments roll out in EKS.
3. **Given** a rollout failure, **When** `kubectl rollout status` times out, **Then** the workflow runs `kubectl rollout undo` for the failed deployment and reports the failure.

### Edge Cases

- Terraform backend bucket or DynamoDB lock table is missing; workflows must fail fast and README must document manual bootstrap.
- GitHub OIDC role is missing required trust relationship; CD must fail before applying infrastructure.
- ECR repository is missing before build-and-push; Terraform registry module or bootstrap ordering must provide repos before image push.
- Existing MongoDB-dependent services lack a cloud MongoDB-compatible endpoint; deployment must not silently omit this dependency.
- Kubernetes metrics server is absent; HPA resources may be created but scaling cannot operate.
- Secrets manifest contains only placeholders; documentation must warn not to commit real secret values.
- ALB/ACM certificate ARN is not configured; ingress must stay parameterized rather than defaulting to insecure production exposure.
- Docker image healthcheck uses a port that differs from the service environment variable; CI/local smoke tests should catch the mismatch.

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a production Dockerfile for `api-gateway`, `account-service`, `transfer-service`, `ledger-service`, `fraud-service`, and `notification-service`.
- **FR-002**: Each service Dockerfile MUST use a Node 20 Alpine builder stage, install dependencies, produce a deterministic build artifact, and use a Node 20 Alpine runner stage.
- **FR-003**: Each runtime image MUST create and run as non-root `appuser`, expose the service port, include a `/health` healthcheck using `wget --spider`, and avoid embedded secrets.
- **FR-004**: Terraform MUST live under `infra/terraform/` with modules for networking, EKS, databases, messaging, and registry.
- **FR-005**: Networking MUST define VPC CIDR `10.0.0.0/16`, three public subnets, three private subnets, NAT gateway egress, ALB 443 ingress, and no direct public inbound path to EKS nodes.
- **FR-006**: EKS MUST use Kubernetes 1.29, `t3.medium` nodes with min 2, desired 3, max 6, cluster/node IAM roles, ECR read access, and OIDC provider.
- **FR-007**: Databases MUST include two RDS PostgreSQL 15 instances, ElastiCache Redis 7 cluster-mode-disabled Redis, and an explicit MongoDB-compatible persistence path for existing ledger/fraud workloads.
- **FR-008**: Messaging MUST define Amazon MSK Kafka with `kafka.t3.small` and three brokers, while documenting self-hosted Kafka on EKS as a cost-conscious alternative.
- **FR-009**: Registry MUST define one ECR repository per service with a lifecycle policy that keeps the last ten images.
- **FR-010**: Terraform environments MUST include `dev` and `prod` directories with `main.tf` and `terraform.tfvars.example`, and MUST NOT commit real tfvars or secrets.
- **FR-011**: Terraform state MUST be documented as S3 backend plus DynamoDB lock table, created manually before first `terraform init`.
- **FR-012**: Kubernetes manifests MUST include namespace, ingress, example secrets, config maps, deployments, services, and HPAs for all services under `infra/k8s/`.
- **FR-013**: Each deployment MUST include resource requests/limits, liveness/readiness probes, config from ConfigMaps, secrets from Secrets, `runAsNonRoot=true`, and `readOnlyRootFilesystem=true`.
- **FR-014**: Kubernetes services MUST expose internal workloads as ClusterIP and expose `api-gateway` through ALB ingress or a LoadBalancer-compatible manifest.
- **FR-015**: HPA manifests MUST use min replicas 2, max replicas 10, CPU > 70%, and memory > 80%; gateway deployment MUST start with 3 replicas.
- **FR-016**: `secrets.yaml` MUST contain placeholder example values only and documentation MUST direct real secrets to GitHub/AWS/Kubernetes secret management.
- **FR-017**: CI MUST trigger on push to any branch and PR to `main`, running lint/typecheck, tests via `docker-compose.test.yml`, coverage upload, docker builds without PR push, npm audit, and Trivy scans.
- **FR-018**: CD MUST trigger on push to `main` after CI, authenticate to AWS with OIDC, build/push commit-SHA images to ECR, run Terraform plan/apply, update EKS kubeconfig, set deployment images, wait for rollouts, and undo failed rollouts.
- **FR-019**: Documentation MUST list required GitHub secrets and variables: `AWS_ROLE_ARN`, `TF_STATE_BUCKET`, `TF_LOCK_TABLE`, `DB_ACCOUNTS_PASSWORD`, `DB_TRANSFERS_PASSWORD`, `REDIS_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, plus non-secret repository variables `AWS_REGION` and `PUBLIC_DOMAIN`. `ECR_REGISTRY` MAY be configured explicitly, but CD MUST be able to derive it from ECR login when omitted.
- **FR-020**: README documentation MUST include verification steps for `kubectl get pods -n banking`, live `/health`, and rollback via `kubectl rollout undo`.

### Key Entities

- **Service Image**: Production container artifact for one banking service, tagged by Git SHA and published to ECR.
- **Terraform Environment**: Dev or prod root module that composes reusable infrastructure modules with environment-specific variables.
- **Kubernetes Workload**: Deployment, Service, HPA, and config/secret references for one service in namespace `banking`.
- **CI Pipeline**: Pull request and branch verification workflow with lint, typecheck, tests, build, audit, scan, and coverage upload.
- **CD Pipeline**: Main-branch workflow that pushes images, provisions infra, deploys to EKS, and rolls back failed rollouts.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Docker build succeeds for all six service images with no root-user runtime warnings and no committed secrets.
- **SC-002**: GitHub Actions CI runs on every PR and reports green lint, typecheck, test, build, security scan, and coverage upload jobs.
- **SC-003**: A push to `main` can complete ECR push, Terraform apply, and Kubernetes rollout without manual AWS credentials.
- **SC-004**: `kubectl get pods -n banking` shows all deployed service pods in `Running` or ready state after rollout.
- **SC-005**: `curl https://your-domain/health` returns HTTP 200 from the EKS-hosted `api-gateway`.
- **SC-006**: README includes and demonstrates a rollback path using `kubectl rollout undo`.
