#!/usr/bin/env bash
set -euo pipefail

wait_for_db() {
  local host="$1"
  local port="$2"
  local user="$3"
  local db="$4"
  local password="$5"

  echo "Waiting for $host:$port/$db ..."
  until PGPASSWORD="$password" pg_isready -h "$host" -p "$port" -U "$user" -d "$db" >/dev/null 2>&1; do
    sleep 1
  done
}

run_migrations() {
  local host="$1"
  local port="$2"
  local user="$3"
  local db="$4"
  local dir="$5"
  local password="$6"

  for file in "$dir"/*.sql; do
    echo "Applying migration: $file on $db"
    PGPASSWORD="$password" psql -h "$host" -p "$port" -U "$user" -d "$db" -v ON_ERROR_STOP=1 -f "$file"
  done
}

ACCOUNTS_DB_PASSWORD="${ACCOUNTS_DB_PASSWORD:-accounts_pass}"
TRANSFERS_DB_PASSWORD="${TRANSFERS_DB_PASSWORD:-transfers_pass}"
ACCOUNTS_DB_HOST="${ACCOUNTS_DB_HOST:-postgres-accounts}"
ACCOUNTS_DB_PORT="${ACCOUNTS_DB_PORT:-5432}"
ACCOUNTS_DB_USER="${ACCOUNTS_DB_USER:-accounts_user}"
ACCOUNTS_DB_NAME="${ACCOUNTS_DB_NAME:-accounts_db}"
TRANSFERS_DB_HOST="${TRANSFERS_DB_HOST:-postgres-transfers}"
TRANSFERS_DB_PORT="${TRANSFERS_DB_PORT:-5432}"
TRANSFERS_DB_USER="${TRANSFERS_DB_USER:-transfers_user}"
TRANSFERS_DB_NAME="${TRANSFERS_DB_NAME:-transfers_db}"

wait_for_db "$ACCOUNTS_DB_HOST" "$ACCOUNTS_DB_PORT" "$ACCOUNTS_DB_USER" "$ACCOUNTS_DB_NAME" "$ACCOUNTS_DB_PASSWORD"
wait_for_db "$TRANSFERS_DB_HOST" "$TRANSFERS_DB_PORT" "$TRANSFERS_DB_USER" "$TRANSFERS_DB_NAME" "$TRANSFERS_DB_PASSWORD"

run_migrations "$ACCOUNTS_DB_HOST" "$ACCOUNTS_DB_PORT" "$ACCOUNTS_DB_USER" "$ACCOUNTS_DB_NAME" "/db-init/migrations/accounts" "$ACCOUNTS_DB_PASSWORD"
run_migrations "$TRANSFERS_DB_HOST" "$TRANSFERS_DB_PORT" "$TRANSFERS_DB_USER" "$TRANSFERS_DB_NAME" "/db-init/migrations/transfers" "$TRANSFERS_DB_PASSWORD"

echo "All migrations applied successfully."
