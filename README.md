# CN Banking Transaction System

Phase 1 baseline scaffold for account-service, transfer-service, shared types, and local infrastructure.

## Local Setup (3 commands)

```bash
cp .env.example .env
npm install
make up
```

## Services

- account-service: http://localhost:3001/health
- account-service (versioned): http://localhost:3001/v1/health
- transfer-service: http://localhost:3002/health
- transfer-service (versioned): http://localhost:3002/v1/health

## Placeholder API Endpoints

- GET /v1/accounts -> 501 (skeleton for account-service implementation)
- POST /v1/transfers -> 501 (skeleton for transfer-service implementation)

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| ACCOUNT_SERVICE_PORT | Account service port | 3001 |
| TRANSFER_SERVICE_PORT | Transfer service port | 3002 |
| ACCOUNTS_DB_HOST | Accounts DB host | postgres-accounts |
| ACCOUNTS_DB_PORT | Accounts DB port | 5432 |
| ACCOUNTS_DB_HOST_PORT | Accounts DB host-exposed port | 5433 |
| ACCOUNTS_DB_NAME | Accounts DB name | accounts_db |
| ACCOUNTS_DB_USER | Accounts DB user | accounts_user |
| ACCOUNTS_DB_PASSWORD | Accounts DB password | accounts_pass |
| TRANSFERS_DB_HOST | Transfers DB host | postgres-transfers |
| TRANSFERS_DB_PORT | Transfers DB port | 5432 |
| TRANSFERS_DB_HOST_PORT | Transfers DB host-exposed port | 5434 |
| TRANSFERS_DB_NAME | Transfers DB name | transfers_db |
| TRANSFERS_DB_USER | Transfers DB user | transfers_user |
| TRANSFERS_DB_PASSWORD | Transfers DB password | transfers_pass |

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
