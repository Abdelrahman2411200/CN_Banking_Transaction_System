# Quickstart: Phase 4 Cloud Deployment and CI/CD

This quickstart documents the intended implementation and verification flow for Phase 4. It assumes AWS as the target cloud.

## Prerequisites

- AWS account with permission to create VPC, EKS, IAM, RDS, ElastiCache, MSK, ECR, S3, and DynamoDB resources.
- Terraform installed locally or available in GitHub Actions.
- AWS CLI installed locally for verification.
- kubectl installed locally for EKS verification.
- Docker available for local image builds and CI image checks.
- GitHub repository configured for Actions.

## Bootstrap Terraform State

Create the Terraform backend manually before first `terraform init`:

```powershell
aws s3 mb s3://YOUR_TF_STATE_BUCKET --region YOUR_REGION
aws dynamodb create-table --table-name YOUR_TF_LOCK_TABLE --attribute-definitions AttributeName=LockID,AttributeType=S --key-schema AttributeName=LockID,KeyType=HASH --billing-mode PAY_PER_REQUEST --region YOUR_REGION
```

Do not commit real backend config or real `terraform.tfvars` files.

## Configure GitHub Secrets

Set these repository secrets before enabling CD:

```text
AWS_ROLE_ARN
TF_STATE_BUCKET
TF_LOCK_TABLE
DB_ACCOUNTS_PASSWORD
DB_TRANSFERS_PASSWORD
REDIS_PASSWORD
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
KAFKA_SCRAM_PASSWORD
```

Also provide `ACM_CERTIFICATE_ARN` and `MONGODB_PASSWORD`. Set `AWS_REGION` and `PUBLIC_DOMAIN` as repository variables, and protect the GitHub `production` environment with required reviewers before enabling CD. Legacy `AWS_REGION` and `PUBLIC_DOMAIN` secrets are accepted to keep CD compatible with older repository setup; `ECR_REGISTRY` is optional because the workflow derives it from the ECR login action when omitted.

## Local Image Verification

After Dockerfiles are implemented:

```powershell
docker build -f services/api-gateway/Dockerfile -t cn-banking/api-gateway:local .
docker build -f services/account-service/Dockerfile -t cn-banking/account-service:local .
docker build -f services/transfer-service/Dockerfile -t cn-banking/transfer-service:local .
docker build -f services/ledger-service/Dockerfile -t cn-banking/ledger-service:local .
docker build -f services/fraud-service/Dockerfile -t cn-banking/fraud-service:local .
docker build -f services/notification-service/Dockerfile -t cn-banking/notification-service:local .
```

Inspect that each image runs as a non-root user and does not require committed secrets.

## Terraform Dev Plan

After Terraform modules are implemented:

```powershell
cd infra/terraform/environments/dev
terraform fmt -recursive
terraform init -backend-config="bucket=$env:TF_STATE_BUCKET" -backend-config="dynamodb_table=$env:TF_LOCK_TABLE" -backend-config="region=$env:AWS_REGION"
terraform validate
terraform plan -out=tfplan
```

Plan checklist before applying:

- Confirm `module.networking` creates VPC `10.0.0.0/16`, three public subnets, three private subnets, and NAT egress.
- Confirm `module.eks` creates Kubernetes 1.29 with `t3.medium` managed nodes sized min 2, desired 3, max 6.
- Confirm `module.databases` creates accounts/transfers RDS PostgreSQL 15, Redis 7, and either DocumentDB or the documented self-hosted MongoDB endpoint contract.
- Confirm `module.messaging` creates MSK with three `kafka.t3.small` brokers unless a self-hosted Kafka override is intentionally selected.
- Confirm `module.registry` creates six ECR repositories with lifecycle retention for the last ten images.
- Confirm ECR repository names are environment-scoped, immutable, and KMS-encrypted.
- Confirm prod RDS resources use deletion protection and final snapshots, prod Redis has failover, and MSK allows TLS/SCRAM only.
- Confirm the plan does not contain real secret values in output.

Apply only after reviewing the plan:

```powershell
terraform apply tfplan
```

## Kubernetes Deployment Verification

After infrastructure and manifests are implemented:

```powershell
aws eks update-kubeconfig --name YOUR_CLUSTER_NAME --region YOUR_REGION
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/
kubectl get pods -n banking
kubectl get pdb,networkpolicy -n banking
```

Rollout checks:

```powershell
kubectl rollout status deployment/api-gateway -n banking --timeout=5m
kubectl rollout status deployment/account-service -n banking --timeout=5m
kubectl rollout status deployment/transfer-service -n banking --timeout=5m
kubectl rollout status deployment/ledger-service -n banking --timeout=5m
kubectl rollout status deployment/fraud-service -n banking --timeout=5m
kubectl rollout status deployment/notification-service -n banking --timeout=5m
```

Expected result:

```text
api-gateway pods are Running and ready
account-service pods are Running and ready
transfer-service pods are Running and ready
ledger-service pods are Running and ready
fraud-service pods are Running and ready
notification-service pods are Running and ready
```

Check live gateway health after DNS/TLS is configured:

```powershell
curl.exe https://your-domain/health
```

Expected result: HTTP 200 from the gateway health aggregator.

## Rollback Demonstration

Use this command to demonstrate the rollback path for a deployment:

```powershell
kubectl rollout undo deployment/api-gateway -n banking
kubectl rollout status deployment/api-gateway -n banking --timeout=5m
```

The CD workflow must run the same rollback pattern automatically when a rollout fails.

## Next Step

Run the tasks workflow after reviewing this plan:

```text
$speckit-tasks for specs/004-phase-4-cloud-deployment
```
