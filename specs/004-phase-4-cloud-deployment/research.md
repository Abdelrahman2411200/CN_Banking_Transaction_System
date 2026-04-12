# Phase 0 Research: Phase 4 Cloud Deployment and CI/CD

## Decision: Target AWS EKS with Terraform modules

**Rationale**: The user explicitly requested AWS-oriented infrastructure and named EKS, RDS, ElastiCache, MSK, ECR, S3 backend, DynamoDB locking, OIDC, and ALB ingress. Terraform modules allow dev/prod environments to reuse the same cloud shape while changing sizing and availability settings.

**Alternatives considered**: GCP GKE with Cloud SQL/Memorystore/Artifact Registry and Azure AKS with Azure Database/Cache/ACR remain portable alternatives, but using them now would make the requested AWS-specific requirements less direct.

## Decision: Keep services in private subnets and expose only ALB 443

**Rationale**: Banking workloads should not expose service containers, databases, nodes, Kafka, or Redis directly to the internet. Public subnets host ALB/NAT only; private subnets host EKS nodes and data services; NAT gives private nodes outbound access.

**Alternatives considered**: Public worker nodes are simpler for early demos, but they violate the isolation requirement. A fully private endpoint-only cluster is stronger, but it adds setup complexity that is not necessary for this phase.

## Decision: Use managed EKS 1.29 with managed node groups

**Rationale**: Managed EKS and managed node groups reduce operational burden and align with the requested Kubernetes 1.29, `t3.medium`, min 2, desired 3, max 6 topology. Node IAM role must include ECR read access, and the cluster needs an OIDC provider for service-account federation.

**Alternatives considered**: Self-managed nodes offer lower-level control but increase operational work. ECS would simplify container runtime operations but does not satisfy the Kubernetes manifest and HPA requirements.

## Decision: Use ECR repository per service with lifecycle policy

**Rationale**: One ECR repository per service keeps IAM, image retention, and deployment image references clear. Keeping the last ten images supports rollback while controlling storage cost.

**Alternatives considered**: A single monorepo ECR repository with service-prefixed tags is possible, but it makes per-service retention and permissions less clear.

## Decision: Harden Dockerfiles with Node 20 Alpine multi-stage builds

**Rationale**: Current service Dockerfiles are development-oriented and use Node 22 with `dev` commands. Phase 4 requires a consistent production pattern: builder installs dependencies and compiles, runner copies production artifacts, creates `appuser`, exposes the port, and defines `wget --spider` healthchecks.

**Alternatives considered**: Distroless images would reduce surface area further, but Alpine Node images match the requested pattern and are easier to healthcheck with `wget`.

## Decision: Add a build output contract for `api-gateway`

**Rationale**: The gateway currently runs JavaScript from `src/` and does not have a TypeScript build. To satisfy "copy compiled output only" without pretending it is already TypeScript, Phase 4 should add a deterministic gateway build step. The lowest-risk path is a `tsconfig.json` with `allowJs` that emits JS to `dist/`, or an equivalent build script that copies runtime files into `dist/` and lets the runner image execute only from `dist`.

**Alternatives considered**: Copying `src/` directly into the runner image is simpler but contradicts the requested production image pattern. A full TypeScript migration is cleaner long term but may be larger than required for this phase.

## Decision: Preserve PostgreSQL split for accounts and transfers

**Rationale**: The existing app separates account and transfer storage and the user requested two RDS instances: `accounts-db` and `transfers-db`. PostgreSQL 15 `db.t3.micro` fits dev cost constraints; `multi_az` should be false for dev and true for prod through environment variables.

**Alternatives considered**: One shared RDS database would reduce cost but weakens service isolation. Aurora would add managed scaling but is beyond the requested dev-sized footprint.

## Decision: Include MongoDB-compatible persistence for ledger and fraud

**Rationale**: The current `ledger-service` and `fraud-service` depend on `MONGODB_URI`. The original Terraform list only named RDS and Redis, but omitting a MongoDB-compatible endpoint would make those services fail in cloud. The plan should include either Amazon DocumentDB-compatible provisioning in the databases module or a documented self-hosted MongoDB StatefulSet for dev with a production migration path. The deployment contract must keep `MONGODB_URI` and `MONGODB_DB_NAME` available to those services.

**Alternatives considered**: Refactoring ledger/fraud to PostgreSQL would reduce database variety but changes application behavior and exceeds pure infrastructure work. Ignoring MongoDB is not viable.

## Decision: Use ElastiCache Redis 7 for rate limiting and token blacklist

**Rationale**: Redis is already used by the gateway for rate limiting/idempotency/token blacklist behavior. A private ElastiCache Redis 7 deployment with inbound restricted to EKS nodes matches the requested managed service and avoids exposing Redis publicly.

**Alternatives considered**: Redis in-cluster is cheaper for demos but weaker operationally and not the requested target.

## Decision: Use MSK as the default Kafka module and document self-hosted Kafka on EKS

**Rationale**: The user explicitly requested MSK `kafka.t3.small` with three brokers and asked to comment the self-hosted option if cost is a concern. MSK is the production default because it avoids operating Kafka brokers inside the app cluster.

**Alternatives considered**: Strimzi/self-hosted Kafka on EKS can reduce managed service count for experiments but shifts broker upgrades, storage, and reliability to the team.

## Decision: Plain Kubernetes manifests with CI image substitution

**Rationale**: The user requested YAML under `infra/k8s/`, not Helm or Kustomize. Manifests should use stable deployment names and image placeholders; CD can then run `kubectl set image deployment/SERVICE SERVICE=ECR_REPO:${{ github.sha }}` after ECR push.

**Alternatives considered**: Helm gives templating and release history, but adds a packaging layer not requested. Kustomize is useful for overlays, but Phase 4 can start with plain manifests and env-specific Terraform outputs.

## Decision: Use HPA autoscaling on CPU and memory

**Rationale**: Kubernetes HPA `autoscaling/v2` supports multiple resource metrics. The plan requires min 2, max 10, CPU average utilization 70%, and memory average utilization 80%. EKS must have metrics-server or equivalent installed for these metrics to function.

**Alternatives considered**: KEDA would support Kafka lag and request-based scaling, but the requested thresholds are CPU/memory based.

## Decision: Use GitHub Actions OIDC to AWS

**Rationale**: The user explicitly required no long-lived keys. OIDC with `AWS_ROLE_ARN` and `AWS_REGION` lets workflows assume an AWS role with scoped permissions for ECR, Terraform-managed AWS resources, and EKS deployment.

**Alternatives considered**: Repository AWS access keys are simpler but violate the security requirement. Running deployment from a local machine does not meet zero-manual-step CD.

## Decision: Add `docker-compose.test.yml` for CI integration tests

**Rationale**: The requested CI command references `docker-compose.test.yml`, but the repo currently does not have that file. Phase 4 tasks must add it so integration tests can run with isolated dependencies and `--abort-on-container-exit`.

**Alternatives considered**: Reusing `docker-compose.yml` is possible, but the current compose file is local-dev oriented and exposes infra ports; a test compose file can be narrower and deterministic for CI.
