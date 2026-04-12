# Tasks: Phase 4 Cloud Deployment and CI/CD

**Input**: Design documents from `/specs/004-phase-4-cloud-deployment/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`  
**Tests**: Included where the feature specification defines independent validation criteria for Docker images, Terraform plans, Kubernetes rollouts, and CI/CD workflows.  
**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently after the foundational phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or does not depend on incomplete tasks.
- **[Story]**: User story label for story-scoped tasks only.
- All task descriptions include concrete repository paths.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the baseline files and folders needed for Phase 4 implementation.

- [X] T001 Create Phase 4 cloud directory structure under `infra/terraform/modules/`, `infra/terraform/environments/`, `infra/k8s/services/`, and `.github/workflows/`
- [X] T002 Update `.gitignore` to exclude Terraform local state, planfiles, real `*.tfvars`, local kubeconfig fragments, and generated secret overlays while keeping example files trackable
- [X] T003 [P] Create root `.dockerignore` to exclude `.env*`, `node_modules/`, service `dist/`, coverage, Terraform state, and VCS metadata from Docker build contexts
- [X] T004 [P] Add Phase 4 command notes to `AGENTS.md` for Docker image build validation, Terraform validation, Kubernetes manifest validation, and CI/CD workflow checks

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish cross-cutting conventions that every story depends on.

**CRITICAL**: No user story work should begin until this phase is complete.

- [X] T005 Define the service inventory, service ports, ECR repository names, and Kubernetes deployment names in `infra/service-catalog.md`
- [X] T006 [P] Add cloud deployment variable conventions and required secret names to `.env.example`
- [X] T007 [P] Create Terraform backend bootstrap documentation in `infra/terraform/README.md`
- [X] T008 [P] Create Kubernetes deployment conventions and placeholder substitution notes in `infra/k8s/README.md`
- [X] T009 [P] Create GitHub Actions secret and OIDC role setup notes in `.github/README.md`

**Checkpoint**: Phase 4 naming, secret, backend, and directory conventions are documented and ready for story work.

---

## Phase 3: User Story 1 - Production-Ready Service Images (Priority: P1) MVP

**Goal**: Every service builds into a production-ready Node 20 Alpine image with a builder/runner split, non-root runtime user, healthcheck, and no embedded secrets.

**Independent Test**: Build each service Dockerfile locally or in CI and inspect that it uses Node 20 Alpine, copies build output only, runs as `appuser`, exposes the expected port, and defines `/health` with `wget --spider`.

### Tests for User Story 1

- [X] T010 [P] [US1] Add Dockerfile policy tests for multi-stage Node 20 Alpine, non-root `appuser`, and no `.env` copies in `tests/container/dockerfile-policy.test.mjs`
- [X] T011 [P] [US1] Add local image build smoke script for all six services in `scripts/validate-service-images.ps1`
- [X] T012 [P] [US1] Add container healthcheck smoke documentation for all six service ports in `tests/container/README.md`

### Implementation for User Story 1

- [X] T013 [US1] Add deterministic gateway build output by creating `services/api-gateway/tsconfig.json` and updating `services/api-gateway/package.json`
- [X] T014 [US1] Update `services/api-gateway/Dockerfile` to use Node 20 Alpine builder/runner stages, copy only gateway build output, create `appuser`, expose `8080`, and define `/health` healthcheck
- [X] T015 [P] [US1] Update `services/account-service/Dockerfile` to use Node 20 Alpine builder/runner stages, copy only workspace build output, create `appuser`, expose `3001`, and define `/health` healthcheck
- [X] T016 [P] [US1] Update `services/transfer-service/Dockerfile` to use Node 20 Alpine builder/runner stages, copy only workspace build output, create `appuser`, expose `3002`, and define `/health` healthcheck
- [X] T017 [P] [US1] Update `services/ledger-service/Dockerfile` to use Node 20 Alpine builder/runner stages, copy only workspace build output, create `appuser`, expose `3003`, and define `/health` healthcheck
- [X] T018 [P] [US1] Update `services/fraud-service/Dockerfile` to use Node 20 Alpine builder/runner stages, copy only workspace build output, create `appuser`, expose `3004`, and define `/health` healthcheck
- [X] T019 [P] [US1] Update `services/notification-service/Dockerfile` to use Node 20 Alpine builder/runner stages, copy only workspace build output, create `appuser`, expose `3005`, and define `/health` healthcheck
- [X] T020 [US1] Update root `package.json` with production build scripts needed by the service Dockerfiles
- [X] T021 [US1] Update workspace package manifests in `shared/kafka/package.json` and `shared/types/package.json` so production Docker builds can install and build shared packages consistently
- [X] T022 [US1] Update `docker-compose.yml` build definitions only if needed to keep local service builds compatible with the hardened Dockerfiles
- [X] T023 [US1] Run the image build smoke workflow from `scripts/validate-service-images.ps1` and fix any Dockerfile regressions in `services/api-gateway/Dockerfile`, `services/account-service/Dockerfile`, `services/transfer-service/Dockerfile`, `services/ledger-service/Dockerfile`, `services/fraud-service/Dockerfile`, and `services/notification-service/Dockerfile`
- [X] T024 [US1] Run the Dockerfile policy tests in `tests/container/dockerfile-policy.test.mjs` and fix any failed image-hardening assertions in the affected service Dockerfile

**Checkpoint**: All six images build locally and satisfy the non-root, multi-stage, healthchecked image contract.

---

## Phase 4: User Story 2 - Provision Cloud Infrastructure (Priority: P1)

**Goal**: Terraform can provision reusable AWS networking, EKS, data services, messaging, and registry resources through dev/prod environment roots.

**Independent Test**: Run Terraform format/validate and generate a dev environment plan using backend configuration supplied outside the repository.

### Tests for User Story 2

- [X] T025 [P] [US2] Add Terraform module validation guidance and expected commands to `infra/terraform/README.md`
- [X] T026 [P] [US2] Add a Terraform plan checklist for dev/prod backend configuration to `specs/004-phase-4-cloud-deployment/quickstart.md`

### Implementation for User Story 2

- [X] T027 [P] [US2] Create Terraform provider and version constraints in `infra/terraform/versions.tf`
- [X] T028 [P] [US2] Implement the networking module in `infra/terraform/modules/networking/main.tf`, `infra/terraform/modules/networking/variables.tf`, and `infra/terraform/modules/networking/outputs.tf`
- [X] T029 [P] [US2] Implement ALB, node, and database security group rules in `infra/terraform/modules/networking/security-groups.tf`
- [X] T030 [P] [US2] Implement the EKS cluster, managed node group, cluster IAM role, node IAM role, ECR read policy, and OIDC provider in `infra/terraform/modules/eks/main.tf`, `infra/terraform/modules/eks/iam.tf`, `infra/terraform/modules/eks/variables.tf`, and `infra/terraform/modules/eks/outputs.tf`
- [X] T031 [P] [US2] Implement accounts and transfers PostgreSQL RDS instances in `infra/terraform/modules/databases/rds.tf`, `infra/terraform/modules/databases/variables.tf`, and `infra/terraform/modules/databases/outputs.tf`
- [X] T032 [P] [US2] Implement private ElastiCache Redis 7 in `infra/terraform/modules/databases/redis.tf`
- [X] T033 [P] [US2] Add the MongoDB-compatible ledger/fraud persistence option and comments in `infra/terraform/modules/databases/mongodb-compatible.tf`
- [X] T034 [P] [US2] Implement default MSK Kafka resources and self-hosted Kafka cost-alternative comments in `infra/terraform/modules/messaging/main.tf`, `infra/terraform/modules/messaging/variables.tf`, and `infra/terraform/modules/messaging/outputs.tf`
- [X] T035 [P] [US2] Implement six ECR repositories and lifecycle policies in `infra/terraform/modules/registry/main.tf`, `infra/terraform/modules/registry/variables.tf`, and `infra/terraform/modules/registry/outputs.tf`
- [X] T036 [US2] Wire all Terraform modules for dev in `infra/terraform/environments/dev/main.tf`, `infra/terraform/environments/dev/variables.tf`, `infra/terraform/environments/dev/outputs.tf`, and `infra/terraform/environments/dev/backend.tf`
- [X] T037 [US2] Add placeholder-only dev variables in `infra/terraform/environments/dev/terraform.tfvars.example`
- [X] T038 [US2] Wire all Terraform modules for prod in `infra/terraform/environments/prod/main.tf`, `infra/terraform/environments/prod/variables.tf`, and `infra/terraform/environments/prod/outputs.tf`, and `infra/terraform/environments/prod/backend.tf`
- [X] T039 [US2] Add placeholder-only prod variables in `infra/terraform/environments/prod/terraform.tfvars.example`
- [X] T040 [US2] Re-export stable outputs required by CD in `infra/terraform/environments/dev/outputs.tf` and `infra/terraform/environments/prod/outputs.tf`
- [X] T041 [US2] Run Terraform formatting and validation against `infra/terraform/` and fix any module or environment issues in the touched Terraform files

**Checkpoint**: Terraform modules and environment roots are ready to plan for dev and prod without committing real tfvars or backend secrets.

---

## Phase 5: User Story 3 - Deploy Services to Kubernetes (Priority: P2)

**Goal**: EKS can deploy all services into namespace `banking` with ClusterIP internal services, gateway ingress, probes, resources, config/secret separation, security context, and HPA.

**Independent Test**: Apply manifests to namespace `banking` with placeholder values substituted and verify `kubectl rollout status` plus gateway `/health`.

### Tests for User Story 3

- [X] T042 [P] [US3] Add Kubernetes manifest lint and dry-run guidance to `infra/k8s/README.md`
- [X] T043 [P] [US3] Add manifest structure validation notes for namespace, ingress, secrets, configmaps, deployments, services, and HPAs to `specs/004-phase-4-cloud-deployment/contracts/kubernetes-contract.md`

### Implementation for User Story 3

- [X] T044 [P] [US3] Create namespace manifest in `infra/k8s/namespace.yaml`
- [X] T045 [P] [US3] Create placeholder-only Kubernetes secrets manifest in `infra/k8s/secrets.yaml`
- [X] T046 [P] [US3] Create ALB ingress manifest with ACM certificate ARN and host placeholders in `infra/k8s/ingress.yaml`
- [X] T047 [P] [US3] Create api-gateway config, deployment, service, and HPA manifests in `infra/k8s/services/api-gateway/configmap.yaml`, `infra/k8s/services/api-gateway/deployment.yaml`, `infra/k8s/services/api-gateway/service.yaml`, and `infra/k8s/services/api-gateway/hpa.yaml`
- [X] T048 [P] [US3] Create account-service config, deployment, service, and HPA manifests in `infra/k8s/services/account-service/configmap.yaml`, `infra/k8s/services/account-service/deployment.yaml`, `infra/k8s/services/account-service/service.yaml`, and `infra/k8s/services/account-service/hpa.yaml`
- [X] T049 [P] [US3] Create transfer-service config, deployment, service, and HPA manifests in `infra/k8s/services/transfer-service/configmap.yaml`, `infra/k8s/services/transfer-service/deployment.yaml`, `infra/k8s/services/transfer-service/service.yaml`, and `infra/k8s/services/transfer-service/hpa.yaml`
- [X] T050 [P] [US3] Create ledger-service config, deployment, service, and HPA manifests in `infra/k8s/services/ledger-service/configmap.yaml`, `infra/k8s/services/ledger-service/deployment.yaml`, `infra/k8s/services/ledger-service/service.yaml`, and `infra/k8s/services/ledger-service/hpa.yaml`
- [X] T051 [P] [US3] Create fraud-service config, deployment, service, and HPA manifests in `infra/k8s/services/fraud-service/configmap.yaml`, `infra/k8s/services/fraud-service/deployment.yaml`, `infra/k8s/services/fraud-service/service.yaml`, and `infra/k8s/services/fraud-service/hpa.yaml`
- [X] T052 [P] [US3] Create notification-service config, deployment, service, and HPA manifests in `infra/k8s/services/notification-service/configmap.yaml`, `infra/k8s/services/notification-service/deployment.yaml`, `infra/k8s/services/notification-service/service.yaml`, and `infra/k8s/services/notification-service/hpa.yaml`
- [X] T053 [US3] Ensure all Kubernetes deployment manifests in `infra/k8s/services/*/deployment.yaml` use `secretKeyRef` for secrets and `configMapKeyRef` for non-secret config
- [X] T054 [US3] Ensure all Kubernetes deployment manifests in `infra/k8s/services/*/deployment.yaml` set resource requests `100m` and `128Mi`, limits `500m` and `512Mi`, liveness probes, readiness probes, `runAsNonRoot=true`, and `readOnlyRootFilesystem=true`
- [X] T055 [US3] Ensure all Kubernetes service manifests in `infra/k8s/services/*/service.yaml` are ClusterIP and only `infra/k8s/ingress.yaml` exposes `api-gateway`
- [X] T056 [US3] Ensure all HPA manifests in `infra/k8s/services/*/hpa.yaml` use `autoscaling/v2`, min replicas 2, max replicas 10, CPU target 70, and memory target 80
- [X] T057 [US3] Add Kubernetes apply and rollout validation commands to `specs/004-phase-4-cloud-deployment/quickstart.md`

**Checkpoint**: Kubernetes manifests can deploy all services to namespace `banking` with internal isolation and gateway ingress.

---

## Phase 6: User Story 4 - Automate CI/CD and Rollback (Priority: P2)

**Goal**: GitHub Actions validates every PR and deploys pushes to `main` through OIDC-authenticated AWS access, ECR image publishing, Terraform apply, Kubernetes rollout, and rollback-on-failure.

**Independent Test**: Open a PR and confirm CI jobs run; merge to `main` in a configured repository and confirm ECR push, Terraform plan/apply, EKS rollout, and rollback behavior.

### Tests for User Story 4

- [X] T058 [P] [US4] Add CI workflow syntax and dry-run notes to `.github/README.md`
- [X] T059 [P] [US4] Add CD rollout and rollback verification notes to `.github/README.md`

### Implementation for User Story 4

- [X] T060 [US4] Create `docker-compose.test.yml` for CI integration dependencies and service test execution with `--abort-on-container-exit`
- [X] T061 [P] [US4] Create CI lint/typecheck job in `.github/workflows/ci.yml`
- [X] T062 [P] [US4] Create CI test and Codecov upload job in `.github/workflows/ci.yml`
- [X] T063 [P] [US4] Create CI docker build job for all six services without image push in `.github/workflows/ci.yml`
- [X] T064 [P] [US4] Create CI npm audit and Trivy image scan job in `.github/workflows/ci.yml`
- [X] T065 [US4] Create CD OIDC authentication, ECR login, image build, image push, and job outputs in `.github/workflows/cd.yml`
- [X] T066 [US4] Create CD Terraform init, plan artifact upload, and apply steps in `.github/workflows/cd.yml`
- [X] T067 [US4] Create CD EKS kubeconfig update, `kubectl set image`, rollout status, and rollout undo logic in `.github/workflows/cd.yml`
- [X] T068 [US4] Ensure CD workflow dependencies enforce CI success before deploy in `.github/workflows/cd.yml`
- [X] T069 [US4] Add required GitHub repository secrets and environment setup documentation to `README.md`

**Checkpoint**: GitHub Actions can validate PRs and deploy `main` without long-lived AWS credentials.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final documentation, verification, and clean-up across all stories.

- [X] T070 [P] Update Phase 4 quickstart commands and acceptance evidence in `specs/004-phase-4-cloud-deployment/quickstart.md`
- [X] T071 [P] Update root deployment documentation in `README.md` with Terraform backend bootstrap, GitHub secrets, Kubernetes verification, and rollback demonstration
- [X] T072 [P] Update `specs/004-phase-4-cloud-deployment/contracts/deployment-contract.md` if workflow implementation names differ from the planned job names
- [X] T073 [P] Update `specs/004-phase-4-cloud-deployment/contracts/terraform-outputs.md` if final Terraform output names differ from the contract
- [X] T074 [P] Run `npm run lint` and fix lint issues in `services/`, `shared/`, `.github/workflows/`, and any new scripts
- [X] T075 [P] Run `npm run typecheck` and fix TypeScript issues in `services/`, `shared/`, and `tests/`
- [X] T076 [P] Run `npm test` and fix failures in `tests/`
- [X] T077 Run full Docker image validation from `scripts/validate-service-images.ps1` and fix any service image issues in `services/*/Dockerfile`
- [X] T078 Run Terraform format/validate for `infra/terraform/` and fix any issues in Terraform module or environment files
- [X] T079 Run Kubernetes manifest dry-run validation for `infra/k8s/` and fix any manifest issues in `infra/k8s/`
- [X] T080 Run `git diff --check` and fix whitespace or conflict-marker issues in all changed files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies and can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories.
- **User Story 1 (Phase 3, P1)**: Depends on Foundational completion and is the MVP for deployable images.
- **User Story 2 (Phase 4, P1)**: Depends on Foundational completion and can run in parallel with User Story 1 after shared naming conventions are set.
- **User Story 3 (Phase 5, P2)**: Depends on Foundational completion, benefits from User Story 2 outputs, and can be implemented with placeholder values before real Terraform apply.
- **User Story 4 (Phase 6, P2)**: Depends on Foundational completion, needs User Story 1 image names, User Story 2 Terraform paths, and User Story 3 deployment names for a complete CD path.
- **Polish (Phase 7)**: Depends on the desired user stories being complete.

### User Story Dependencies

- **US1 Production-Ready Service Images**: No dependency on other user stories after Foundational.
- **US2 Provision Cloud Infrastructure**: No dependency on other user stories after Foundational.
- **US3 Deploy Services to Kubernetes**: Can start with placeholders after Foundational, but final verification depends on US1 image tags and US2 infrastructure outputs.
- **US4 Automate CI/CD and Rollback**: Can start after Foundational, but final end-to-end CD verification depends on US1, US2, and US3.

### Within Each User Story

- Write or update validation assets before implementation tasks where present.
- For US1, complete the gateway build contract before the gateway Dockerfile.
- For US2, implement modules before environment roots and outputs.
- For US3, create global namespace/secrets/ingress before service-specific rollout validation.
- For US4, create CI before CD, and create build/push before Terraform/deploy jobs.

---

## Parallel Opportunities

- Setup tasks T003 and T004 can run in parallel after T001.
- Foundational tasks T006 through T009 can run in parallel after T005 establishes the service catalog.
- US1 Dockerfile updates T015 through T019 can run in parallel after T013 is complete.
- US2 module tasks T028 through T035 can run in parallel after T027 defines provider/version constraints.
- US3 service manifest bundles T047 through T052 can run in parallel after T044 through T046 create globals.
- US4 CI job tasks T061 through T064 can run in parallel after T060 defines the test compose contract.
- Polish documentation tasks T070 through T073 can run in parallel, and validation tasks T074 through T079 can run in parallel once implementation is complete.

---

## Parallel Example: User Story 1

```text
Task: T015 Update services/account-service/Dockerfile
Task: T016 Update services/transfer-service/Dockerfile
Task: T017 Update services/ledger-service/Dockerfile
Task: T018 Update services/fraud-service/Dockerfile
Task: T019 Update services/notification-service/Dockerfile
```

## Parallel Example: User Story 2

```text
Task: T028 Implement infra/terraform/modules/networking/
Task: T030 Implement infra/terraform/modules/eks/
Task: T031 Implement infra/terraform/modules/databases/rds.tf
Task: T034 Implement infra/terraform/modules/messaging/
Task: T035 Implement infra/terraform/modules/registry/
```

## Parallel Example: User Story 3

```text
Task: T047 Create infra/k8s/services/api-gateway/ manifests
Task: T048 Create infra/k8s/services/account-service/ manifests
Task: T049 Create infra/k8s/services/transfer-service/ manifests
Task: T050 Create infra/k8s/services/ledger-service/ manifests
Task: T051 Create infra/k8s/services/fraud-service/ manifests
Task: T052 Create infra/k8s/services/notification-service/ manifests
```

## Parallel Example: User Story 4

```text
Task: T061 Create CI lint/typecheck job
Task: T062 Create CI test and Codecov job
Task: T063 Create CI docker build job
Task: T064 Create CI npm audit and Trivy scan job
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 Setup.
2. Complete Phase 2 Foundational conventions.
3. Complete Phase 3 User Story 1 so every service has a production-ready image.
4. Stop and validate all six Docker image builds before moving to cloud resources.

### Incremental Delivery

1. Add US1 images and validate local image builds.
2. Add US2 Terraform modules and validate a dev plan.
3. Add US3 Kubernetes manifests and validate dry-run/apply behavior.
4. Add US4 CI/CD workflows and validate PR CI before enabling main-branch CD.

### Parallel Team Strategy

1. Complete Setup and Foundational tasks together.
2. Assign one developer to US1 Dockerfiles and one developer to US2 Terraform modules.
3. Start US3 Kubernetes manifests once service names and env contracts are stable.
4. Start US4 CI in parallel, then wire CD once image, Terraform, and Kubernetes paths are stable.

## Notes

- [P] tasks are safe to parallelize because they touch separate files or are independent validation/documentation tasks.
- Each user story can be independently reviewed at its checkpoint.
- Do not commit real Terraform tfvars, Kubernetes secrets, AWS credentials, JWT secrets, Redis passwords, or database passwords.
- Keep the existing Phase 3 gateway security behavior intact while changing container and deployment infrastructure.
