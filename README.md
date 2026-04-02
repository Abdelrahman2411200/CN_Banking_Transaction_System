# CN Banking Transaction System

Production-ready Phase 1 microservices implementation: account-service, transfer-service with SAGA pattern, shared types, and local Docker Compose infrastructure.

## Local Setup (3 commands)

```bash
cp .env.example .env
npm install
make up
```

## Services & Endpoints

### Account Service (port 3001)
- `GET /health` - Health check
- `POST /v1/accounts` - Create account (name, email, initial_balance)
- `GET /v1/accounts/:id` - Get account by ID
- `GET /v1/accounts/:id/balance` - Check account balance
- `PATCH /v1/accounts/:id/kyc` - Update KYC status
- `PATCH /v1/accounts/:id/debit` - Debit account (internal, used by SAGA)
- `PATCH /v1/accounts/:id/credit` - Credit account (internal, used by SAGA)

### Transfer Service (port 3002)
- `GET /health` - Health check
- `POST /v1/transfers` - Initiate transfer (from_account_id, to_account_id, amount)
- `GET /v1/transfers/:id` - Get transfer status with SAGA state

## Testing

```bash
npm test                    # Run Jest test suite (unit + integration)
npm run test:unit           # Unit tests only
npm run test:integration    # Jest integration tests only
npm run test:integration:sam # Node.js native test suite (health/schema checks)
npm run test:all            # Run Jest + node:test suites
```

## Database Schema

### Accounts Table
- `id` (UUID) - Primary key
- `name` - Account holder name
- `email` - Account email (unique)
- `balance` - Account balance (numeric, >= 0)
- `kyc_status` - KYC status (`pending`, `verified`, `rejected`)
- `status` - Account status (`active`, `inactive`, `suspended`)
- `created_at`, `updated_at` - Timestamps

### Transfers Table
- `id` (UUID) - Primary key
- `from_account_id`, `to_account_id` (UUID) - Account references
- `amount` - Transfer amount (numeric, > 0)
- `status` - Transfer status (`initiated`, `completed`, `failed`, `compensating`, `compensation_failed`)
- `saga_state` (JSONB) - SAGA state machine tracking (current_step, debit_completed, credit_completed, compensation_completed, error)
- `error_message` - Error details if failed
- `created_at`, `updated_at` - Timestamps

## Key Features

- **SAGA Pattern**: Two-phase commit with compensation for distributed transaction consistency
- **Schema Validation**: PostgreSQL CHECK constraints (balance >= 0, amount > 0, distinct accounts)
- **error handling**: 
  - 422 Insufficient Funds response before any balance mutation
  - 409 Conflict on duplicate email
  - Generic 500 responses to avoid leaking internal errors
- **Health Checks**: Canonical health endpoint is `/health`

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| ACCOUNT_SERVICE_PORT | Account service port | 3001 |
| TRANSFER_SERVICE_PORT | Transfer service port | 3002 |
| ACCOUNT_SERVICE_URL | Account service URL for transfer-service | http://account-service:3001 |
| TRANSFER_SERVICE_URL | Transfer service URL for host-based integration tests | http://transfer-service:3002 |
| ACCOUNTS_DB_HOST | Accounts database host | postgres-accounts |
| ACCOUNTS_DB_PORT | Accounts database port | 5432 |
| ACCOUNTS_DB_HOST_PORT | Accounts DB host-exposed port | 5433 |
| ACCOUNTS_DB_NAME | Accounts database name | accounts_db |
| ACCOUNTS_DB_USER | Accounts database user | accounts_user |
| ACCOUNTS_DB_PASSWORD | Accounts database password | accounts_pass |
| TRANSFERS_DB_HOST | Transfers database host | postgres-transfers |
| TRANSFERS_DB_PORT | Transfers database port | 5432 |
| TRANSFERS_DB_HOST_PORT | Transfers DB host-exposed port | 5434 |
| TRANSFERS_DB_NAME | Transfers database name | transfers_db |
| TRANSFERS_DB_USER | Transfers database user | transfers_user |
| TRANSFERS_DB_PASSWORD | Transfers database password | transfers_pass |

## Make Targets

- make up: build and start all containers
- make test: run workspace tests and integration tests
- make down: stop containers and remove volumes
- make logs: follow combined container logs

## Integration Tests

- Run with `npm run test:integration` (requires stack running via `make up`)
- Validates:
	- health endpoints return 200
	- `accounts` and `transfers` tables exist after db-init migrations

## Troubleshooting

- Port conflict: free ports 3001, 3002, 5433, 5434 before starting.
- If db-init fails: run `make down` then `make up` to recreate dependencies.
- If healthcheck stays unhealthy: inspect logs with `make logs`.

## Startup Optimization

- account-service and transfer-service are now built as Docker images.
- Startup no longer runs `npm install` per container boot.
