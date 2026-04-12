#!/usr/bin/env sh
set -eu

services="api-gateway account-service transfer-service ledger-service fraud-service notification-service"

for service in $services; do
  docker build --build-arg VERSION=local -f "services/$service/Dockerfile" -t "cn-banking/$service:local" .
done

echo "All Phase 4 service images built successfully."
