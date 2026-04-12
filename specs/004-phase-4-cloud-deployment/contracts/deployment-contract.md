# Deployment Contract

## CI Workflow

**File**: `.github/workflows/ci.yml`

**Triggers**:

- `push` to any branch.
- `pull_request` targeting `main`.

**Required Jobs**:

- `lint`: Run ESLint and TypeScript typecheck across all services/workspaces.
- `test`: Run `docker-compose -f docker-compose.test.yml up --abort-on-container-exit`, unit tests, integration tests, and upload coverage to Codecov.
- `audit`: Run `npm audit --audit-level=high` once for the shared lockfile.
- `build-and-scan`: Build Docker images for all six services and run Trivy on each built image; do not push on PRs.

**Rules**:

- Jobs should run in parallel where dependency order permits.
- CI must fail if `docker-compose.test.yml` is missing or if any service image fails to build.
- PR CI must not require AWS deployment permissions and must not push to ECR.

## CD Workflow

**File**: `.github/workflows/cd.yml`

**Triggers**:

- `workflow_run` after the `CI` workflow completes successfully on `main`.
- The workflow uses the CI run commit SHA as the image tag and checkout ref.

**Sequential Jobs**:

- `build-and-push`: Assume AWS role with OIDC, login to ECR, build each service with `--build-arg VERSION=${{ github.sha }}`, push tags to the environment-scoped ECR prefix, and expose image tag outputs.
- `terraform`: Initialize Terraform with S3 backend values from secrets, run `terraform plan`, upload the planfile artifact, and apply the planfile after `production` environment approval.
- `deploy`: Run `aws eks update-kubeconfig`, render and apply Kubernetes manifests once, wait for rollout status, and undo all service deployments if any rollout fails.

**Required Repository Secrets**:

- `AWS_ROLE_ARN`
- `ECR_REGISTRY`
- `TF_STATE_BUCKET`
- `TF_LOCK_TABLE`
- `DB_ACCOUNTS_PASSWORD`
- `DB_TRANSFERS_PASSWORD`
- `REDIS_PASSWORD`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `MONGODB_PASSWORD`
- `KAFKA_SCRAM_PASSWORD`
- `ACM_CERTIFICATE_ARN`

**Required Repository Variables**:

- `AWS_REGION`
- `PUBLIC_DOMAIN`

**Additional Deployment Inputs**:

- `MONGODB_URI` or cloud-managed MongoDB-compatible output if ledger/fraud retain MongoDB storage.
- `MONGODB_DB_NAME` for ledger/fraud service config.
- `production` GitHub environment protection should require reviewers before apply/deploy.

## Rollout Behavior

For each service after all rendered manifests are applied:

```powershell
kubectl rollout status deployment/SERVICE -n banking --timeout=5m
```

On rollout failure:

```powershell
kubectl rollout undo deployment/api-gateway -n banking
kubectl rollout undo deployment/account-service -n banking
kubectl rollout undo deployment/transfer-service -n banking
kubectl rollout undo deployment/ledger-service -n banking
kubectl rollout undo deployment/fraud-service -n banking
kubectl rollout undo deployment/notification-service -n banking
```

## Service Image Names

- `api-gateway`
- `account-service`
- `transfer-service`
- `ledger-service`
- `fraud-service`
- `notification-service`

Each service image tag must be the Git commit SHA that triggered the workflow.
