# Phase 1 Implementation Plan (Sam)

## Scope
This plan covers only Sam-owned Phase 1 work from [PLAN.md](../PLAN.md):
- Monorepo structure: `services/`, `shared/`, `infra/`
- Shared TypeScript interfaces: `Account`, `Transfer`, `ApiResponse`
- `docker-compose.yml` with both services, two PostgreSQL instances, and db-init
- Healthchecks (`GET /health -> 200`) for account-service and transfer-service
- ESLint + strict TypeScript configuration
- Root `Makefile`: `make up`, `make test`, `make down`, `make logs`
- Root `README` with local setup and environment variables

## Execution Order
1. Align with Mexo on ports and `/v1/...` base path.
2. Scaffold monorepo directories and workspace-level tooling.
3. Add shared types package and export surface.
4. Scaffold account-service and transfer-service with `/health` endpoint.
5. Add Docker Compose with postgres-accounts, postgres-transfers, and db-init.
6. Add migration runner and SQL migrations.
7. Add root Makefile and README.
8. Verify merge gate with `docker-compose up --build`.

## Acceptance Criteria
- `docker-compose up --build` starts cleanly.
- `http://localhost:3001/health` returns 200.
- `http://localhost:3002/health` returns 200.
- db-init applies migrations for both DBs.
- Lint and strict TypeScript checks are enabled in repo config.

## Notes
- Account and Transfer interfaces should match Mexo's final contract as source of truth.
- Migration scripts are written to be idempotent (`IF NOT EXISTS`).
