# CN_Banking_Transaction_System Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-13

## Active Technologies
- TypeScript 5.8, React 19, Node.js 20 workspace runtime + Vite, React, Tailwind CSS, Material Symbols for icon parity, Testing Library/Vitest for primitive tests (005-frontend-phase-1-design-system)

- Node.js 20 for production images; TypeScript 5.8 workspace packages; JavaScript `api-gateway` to receive a build-compatible output contract + Express, KafkaJS, PostgreSQL `pg`, MongoDB driver, ioredis, jsonwebtoken, Terraform, AWS provider, Kubernetes manifests, GitHub Actions, Trivy, Codecov (004-phase-4-cloud-deployment)

## Project Structure

```text
services/
shared/
infra/
tests/
specs/
```

## Commands

npm run lint
npm run typecheck
npm test

Phase 4 validation commands:

```text
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate-service-images.ps1
terraform -chdir=infra/terraform/environments/dev fmt -recursive
terraform -chdir=infra/terraform/environments/dev validate
kubeconform -strict -summary -kubernetes-version 1.29.0 infra/k8s
kubectl apply --dry-run=client --recursive -f infra/k8s/
```

## Code Style

Node.js 20 for production images; TypeScript 5.8 workspace packages; JavaScript `api-gateway` to receive a build-compatible output contract: Follow standard conventions

## Recent Changes
- 005-frontend-phase-1-design-system: Added TypeScript 5.8, React 19, Node.js 20 workspace runtime + Vite, React, Tailwind CSS, Material Symbols for icon parity, Testing Library/Vitest for primitive tests

- 004-phase-4-cloud-deployment: Added Node.js 20 for production images; TypeScript 5.8 workspace packages; JavaScript `api-gateway` to receive a build-compatible output contract + Express, KafkaJS, PostgreSQL `pg`, MongoDB driver, ioredis, jsonwebtoken, Terraform, AWS provider, Kubernetes manifests, GitHub Actions, Trivy, Codecov

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
