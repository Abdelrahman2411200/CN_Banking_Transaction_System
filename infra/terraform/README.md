# Terraform Infrastructure

Phase 4 provisions AWS infrastructure for the CN Banking Transaction System with reusable modules and separate `dev` and `prod` environment roots.

## Backend Bootstrap

Create the S3 state bucket and DynamoDB lock table manually before the first `terraform init`.

```powershell
aws s3 mb s3://YOUR_TF_STATE_BUCKET --region YOUR_REGION
aws dynamodb create-table --table-name YOUR_TF_LOCK_TABLE --attribute-definitions AttributeName=LockID,AttributeType=S --key-schema AttributeName=LockID,KeyType=HASH --billing-mode PAY_PER_REQUEST --region YOUR_REGION
```

Never commit real backend config, real `*.tfvars`, state files, plans, or cloud credentials.

## Validation

```powershell
terraform -chdir=infra/terraform/environments/dev fmt -recursive
terraform -chdir=infra/terraform/environments/dev init -backend-config="bucket=$env:TF_STATE_BUCKET" -backend-config="dynamodb_table=$env:TF_LOCK_TABLE" -backend-config="region=$env:AWS_REGION"
terraform -chdir=infra/terraform/environments/dev validate
terraform -chdir=infra/terraform/environments/dev plan -out=tfplan
```

Use `environments/prod` with production variables after reviewing the dev plan and cost profile.

Production defaults are hardened: private EKS API endpoint, control-plane logging, per-AZ NAT gateways, RDS final snapshots and deletion protection, Redis failover, TLS/SCRAM MSK, immutable KMS-encrypted ECR repositories, and environment-scoped registry paths. If GitHub Actions deploys to the private EKS endpoint, run deployment from a self-hosted runner with VPC access or provide an equivalent private network path.
