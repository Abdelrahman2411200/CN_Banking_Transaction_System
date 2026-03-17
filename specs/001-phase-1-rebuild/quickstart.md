# Quickstart: Phase 1 Local Development

## Prerequisites

- Docker Desktop (with Compose V2)
- Node.js 22
- npm 10+

## Start the System

```bash
# 1. Clone and enter the repo
git clone <repo-url> && cd CN_Banking_Transaction_System

# 2. Copy environment variables
cp .env.example .env

# 3. Start all services
make up
```

Both services are ready when `docker compose ps` shows all containers as `healthy`.

- Account service: http://localhost:3001/health
- Transfer service: http://localhost:3002/health

## Run Tests

```bash
make test
```

This runs the full Jest test suite (unit + integration).

## Stop the System

```bash
make down    # stops containers and removes volumes
```

## Stream Logs

```bash
make logs
```

## Quick Smoke Test (after `make up`)

```bash
# Create an account
curl -s -X POST http://localhost:3001/v1/accounts \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","initial_balance":1000}' | jq .

# Create a second account
curl -s -X POST http://localhost:3001/v1/accounts \
  -H "Content-Type: application/json" \
  -d '{"name":"Bob","email":"bob@example.com","initial_balance":500}' | jq .

# Transfer 200 from Alice to Bob (use IDs from above responses)
curl -s -X POST http://localhost:3002/v1/transfers \
  -H "Content-Type: application/json" \
  -d '{"from_account_id":"<alice-id>","to_account_id":"<bob-id>","amount":200}' | jq .

# Verify balances
curl -s http://localhost:3001/v1/accounts/<alice-id>/balance | jq .   # should be 800
curl -s http://localhost:3001/v1/accounts/<bob-id>/balance | jq .     # should be 700
```

## Environment Variables

| Variable              | Default                        | Description                         |
|-----------------------|--------------------------------|-------------------------------------|
| ACCOUNT_SERVICE_PORT  | 3001                           | Account service listen port         |
| TRANSFER_SERVICE_PORT | 3002                           | Transfer service listen port        |
| ACCOUNT_SERVICE_URL   | http://account-service:3001    | URL transfer-service uses (Docker)  |
| ACCOUNTS_DB_HOST      | postgres-accounts              | Account DB hostname (Docker)        |
| ACCOUNTS_DB_PORT      | 5432                           | Account DB port (internal)          |
| ACCOUNTS_DB_HOST_PORT | 5433                           | Account DB port (host-exposed)      |
| ACCOUNTS_DB_NAME      | accounts_db                    | Account DB name                     |
| ACCOUNTS_DB_USER      | accounts_user                  | Account DB user                     |
| ACCOUNTS_DB_PASSWORD  | accounts_pass                  | Account DB password                 |
| TRANSFERS_DB_HOST     | postgres-transfers             | Transfer DB hostname (Docker)       |
| TRANSFERS_DB_PORT     | 5432                           | Transfer DB port (internal)         |
| TRANSFERS_DB_HOST_PORT| 5434                           | Transfer DB port (host-exposed)     |
| TRANSFERS_DB_NAME     | transfers_db                   | Transfer DB name                    |
| TRANSFERS_DB_USER     | transfers_user                 | Transfer DB user                    |
| TRANSFERS_DB_PASSWORD | transfers_pass                 | Transfer DB password                |

## Troubleshooting

**db-init exits with error**: One of the postgres containers failed its health check. Run `make logs` and look for postgres startup errors. Try `make down && make up`.

**Service shows unhealthy**: The service crashed on startup. Run `docker compose logs account-service` or `docker compose logs transfer-service` to see the error.

**Port already in use**: Change `ACCOUNTS_DB_HOST_PORT` / `TRANSFERS_DB_HOST_PORT` in `.env` if ports 5433/5434 are taken on your machine.
