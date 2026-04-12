# GitHub Actions Deployment Notes

Phase 4 uses GitHub Actions for CI on every branch/PR and CD on `main`.

## Required Repository Secrets

- `AWS_ROLE_ARN`
- `ECR_REGISTRY`
- `TF_STATE_BUCKET`
- `TF_LOCK_TABLE`
- `DB_ACCOUNTS_PASSWORD`
- `DB_TRANSFERS_PASSWORD`
- `REDIS_PASSWORD`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ACM_CERTIFICATE_ARN`
- `MONGODB_PASSWORD`
- `KAFKA_SCRAM_PASSWORD`

## Required Repository Variables

- `AWS_REGION`
- `PUBLIC_DOMAIN`

The `production` GitHub environment should require reviewer approval before the `terraform` and `deploy` jobs run.

## OIDC

Configure the AWS role in `AWS_ROLE_ARN` to trust the GitHub repository through GitHub's OIDC provider. Do not store long-lived AWS access keys in repository secrets.

## Workflow Checks

CI should lint, typecheck, test, run a single `npm audit`, build each image once, and scan each built image with Trivy using `.trivyignore` for explicit temporary exceptions only. CD should build and push commit-SHA-tagged images, apply Terraform, render Kubernetes manifests once, wait for rollouts, and undo all six deployments if any rollout fails.

## Local Syntax Checks

Use these before pushing workflow changes:

```powershell
npm run lint
npm run typecheck
docker compose -f docker-compose.test.yml config
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from test-runner
```

## Rollout Verification

The CD workflow applies rendered manifests, waits up to five minutes per deployment with `kubectl rollout status`, and runs `kubectl rollout undo` for every service if any deployment does not complete.
