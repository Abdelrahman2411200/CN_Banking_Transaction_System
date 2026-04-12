# Phase 4 Service Catalog

This catalog is the shared naming contract for Docker images, ECR repositories, Kubernetes workloads, and CI/CD rollout commands.

| Service | Workspace | Port | ECR Repository | Kubernetes Deployment | Kubernetes Container |
|---------|-----------|------|----------------|-----------------------|----------------------|
| api-gateway | `api-gateway` | 8080 | `<name_prefix>/api-gateway` | `api-gateway` | `api-gateway` |
| account-service | `@cn-banking/account-service` | 3001 | `<name_prefix>/account-service` | `account-service` | `account-service` |
| transfer-service | `@cn-banking/transfer-service` | 3002 | `<name_prefix>/transfer-service` | `transfer-service` | `transfer-service` |
| ledger-service | `@cn-banking/ledger-service` | 3003 | `<name_prefix>/ledger-service` | `ledger-service` | `ledger-service` |
| fraud-service | `@cn-banking/fraud-service` | 3004 | `<name_prefix>/fraud-service` | `fraud-service` | `fraud-service` |
| notification-service | `@cn-banking/notification-service` | 3005 | `<name_prefix>/notification-service` | `notification-service` | `notification-service` |

Shared conventions:

- Docker images are tagged with the Git commit SHA in CI/CD.
- ECR repositories are environment-scoped by Terraform `name_prefix`, for example `cn-banking-dev/*` and `cn-banking-prod/*`.
- Kubernetes resources live in namespace `banking`.
- Internal services use ClusterIP only.
- Public traffic enters through the ALB ingress for `api-gateway`.
- Secrets are supplied through GitHub Actions, AWS-managed services, or Kubernetes `Secret` objects, never through committed image layers or real tfvars.
