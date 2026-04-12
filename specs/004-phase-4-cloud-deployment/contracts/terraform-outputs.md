# Terraform Outputs Contract

Terraform modules should expose outputs used by downstream modules, GitHub Actions, or Kubernetes deployment documentation.

## networking

Required outputs:

- `vpc_id`
- `public_subnet_ids`
- `private_subnet_ids`
- `alb_security_group_id`
- `node_security_group_id`
- `database_security_group_id`
- `nat_gateway_id`
- `nat_gateway_ids`

## eks

Required outputs:

- `cluster_name`
- `cluster_endpoint`
- `cluster_certificate_authority_data`
- `cluster_security_group_id`
- `node_security_group_id`
- `oidc_provider_arn`
- `node_role_arn`

## databases

Required outputs:

- `accounts_db_endpoint`
- `accounts_db_name`
- `transfers_db_endpoint`
- `transfers_db_name`
- `redis_endpoint`
- `redis_port`
- `mongodb_compatible_endpoint` or documented self-hosted MongoDB endpoint contract

Sensitive outputs:

- Database passwords must not be output.
- Redis auth token/password must not be output.
- MongoDB credentials must not be output.

## messaging

Required outputs:

- `kafka_bootstrap_brokers`
- `kafka_bootstrap_brokers_tls`
- `kafka_bootstrap_brokers_sasl_scram`
- `kafka_version`
- `kafka_security_group_id`
- `messaging_mode`

## registry

Required outputs:

- `api_gateway_repository_url`
- `account_service_repository_url`
- `transfer_service_repository_url`
- `ledger_service_repository_url`
- `fraud_service_repository_url`
- `notification_service_repository_url`

## environments/dev and environments/prod

Environment roots should re-export:

- `cluster_name`
- `ecr_repository_urls`
- `database_endpoints`
- `accounts_db_endpoint`
- `transfers_db_endpoint`
- `redis_endpoint`
- `mongodb_compatible_endpoint`
- `kafka_bootstrap_brokers`
- `kafka_bootstrap_brokers_tls`
- `kafka_bootstrap_brokers_sasl_scram`
- `kafka_version`
- `alb_hostname` if available after ingress/load balancer creation

Outputs consumed by CD must be stable enough for scripts or documented if they are intended for manual verification only.
