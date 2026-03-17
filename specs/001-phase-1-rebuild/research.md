# Research: Phase 1 — Cloud-Native Banking Transaction System

## Decision 1: SAGA Orchestration vs. Choreography

**Decision**: Orchestration SAGA (transfer-service drives the sequence)
**Rationale**: A single orchestrator makes compensation logic explicit and auditable. With only two services and three steps, choreography adds complexity without benefit. The orchestrator persists every state transition to its own database, giving a complete audit trail.
**Alternatives considered**: Choreography with Kafka events (deferred to Phase 2); 2PC (rejected — requires XA protocol, incompatible with lightweight PostgreSQL pools).

---

## Decision 2: Database Constraint Strategy

**Decision**: Enforce `balance >= 0` via PostgreSQL `CHECK` constraint, not only in application code.
**Rationale**: Database-level constraints are the last line of defense. Application code can be bypassed or have bugs; the DB constraint guarantees correctness even under race conditions or direct DB access. The constraint violation surfaces as a `pg` error code `23514`, which the service maps to HTTP 422.
**Alternatives considered**: Application-only guard (insufficient — no safety net at DB level); optimistic locking (unnecessary complexity for single-DB account service).

---

## Decision 3: SAGA State Persistence Format

**Decision**: JSONB column `saga_state` on the transfers table storing `{ current_step, debit_completed, credit_completed, compensation_completed, error }`.
**Rationale**: JSONB allows schema-free evolution of SAGA state without migrations. Supports querying (e.g., find all transfers where compensation failed). Stores the full progression including error messages for auditability.
**Alternatives considered**: Separate saga_steps table (over-engineered for Phase 1); status enum only (insufficient — loses error detail and step granularity).

---

## Decision 4: Inter-Service Communication

**Decision**: HTTP REST over Docker internal network (axios in transfer-service → account-service).
**Rationale**: Simplest approach; debuggable with standard tools; no additional infrastructure. Services discover each other by container name within the Docker bridge network.
**Alternatives considered**: gRPC (adds protobuf toolchain without benefit in Phase 1); message queue (deferred to Phase 2 with Kafka).

---

## Decision 5: Input Validation Library

**Decision**: Zod for runtime schema validation in both services.
**Rationale**: Integrates cleanly with TypeScript; provides typed parse results; error messages are human-readable and map easily to 400 responses. Already a declared dependency in service package.json files.
**Alternatives considered**: Joi (more verbose, less TypeScript-native); manual validation (error-prone).

---

## Decision 6: Test Architecture

**Decision**: Two test tiers — Jest unit tests (mocked DB + HTTP) and Jest integration tests (mocked dependencies, full route handling).
**Rationale**: Unit tests verify business logic and compensation state machine in isolation. Integration tests validate full Express routing, middleware, and error handling with real HTTP semantics. Live Docker integration tests are reserved for smoke testing post-`make up`.
**Alternatives considered**: Three tiers with live Docker (too slow for `make test`; the required three tests are verifiable without live containers).

---

## Decision 7: Monorepo Tool

**Decision**: npm workspaces (no Lerna, Nx, or Turborepo).
**Rationale**: npm workspaces are sufficient for two services and one shared package. Avoids additional toolchain dependencies. Workspace alias `@cn-banking/shared-types` resolves to `shared/types/src/index.ts` via `tsconfig.base.json` path mapping.
**Alternatives considered**: Nx (powerful but overkill for Phase 1 scope); pnpm workspaces (different package manager, not established in this repo).

---

## Decision 8: TypeScript Compilation vs. tsx Dev Mode

**Decision**: Services run via `tsx watch` in development (inside Docker); TypeScript compiles to `dist/` only for `npm run build` (used for type checking and production builds).
**Rationale**: `tsx watch` provides fast hot reload in the dev container. The Dockerfiles already use `npm run dev` (tsx watch) as CMD. This means `npm run build` is used for CI and typecheck verification, not for runtime.
**Alternatives considered**: Compiled-only approach (slower dev cycle, adds transpile step to inner loop); ts-node (tsx is faster, modern replacement).

---

## Resolved Unknowns

All technical decisions are resolved. No `NEEDS CLARIFICATION` items remain. The spec and this research file together provide a complete basis for data model design and contract definition.
