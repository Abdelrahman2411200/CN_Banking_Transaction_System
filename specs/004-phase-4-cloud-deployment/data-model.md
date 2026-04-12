# Phase 1 Data Model: Phase 4 Cloud Deployment and CI/CD

This feature models infrastructure and delivery artifacts rather than end-user banking data.

## ServiceImage

**Purpose**: Production container image for one banking service.

**Fields**:

- `service_name`: One of `api-gateway`, `account-service`, `transfer-service`, `ledger-service`, `fraud-service`, `notification-service`.
- `dockerfile_path`: Service-local Dockerfile path.
- `runtime_port`: Service port exposed by the runner image.
- `healthcheck_path`: Always `/health`.
- `image_repository`: Matching ECR repository URL.
- `image_tag`: Git SHA from CI/CD.
- `runs_as_non_root`: Must be true.
- `contains_secrets`: Must be false.

**Validation Rules**:

- Dockerfile must use Node 20 Alpine for builder and runner stages.
- Runner stage must copy compiled/build output only, not the whole repo.
- Runner stage must create and use `appuser`.
- Healthcheck must use `wget --spider http://localhost:PORT/health`.

## TerraformEnvironment

**Purpose**: Deployable environment root under `infra/terraform/environments/`.

**Fields**:

- `name`: `dev` or `prod`.
- `region`: AWS region.
- `vpc_cidr`: `10.0.0.0/16`.
- `multi_az`: false for dev, true for prod.
- `state_bucket`: Supplied through backend config, not committed.
- `lock_table`: Supplied through backend config, not committed.
- `module_inputs`: Environment-specific values for networking, EKS, databases, messaging, and registry.

**Validation Rules**:

- `terraform.tfvars.example` may contain placeholders only.
- Real tfvars and backend values must not be committed.
- `prod` must set database multi-AZ to true unless explicitly waived.

## NetworkTopology

**Purpose**: VPC and security boundaries for EKS and managed services.

**Fields**:

- `vpc_id`
- `public_subnet_ids`: Three subnets for ALB and NAT.
- `private_subnet_ids`: Three subnets for EKS nodes and data services.
- `alb_security_group_id`
- `node_security_group_id`
- `database_security_group_id`
- `nat_gateway_id`

**Validation Rules**:

- ALB security group allows inbound 443 from the internet.
- Node security group denies direct public inbound traffic.
- Data services allow inbound only from EKS nodes or required pod security groups.

## EksCluster

**Purpose**: Managed Kubernetes control plane and node group.

**Fields**:

- `cluster_name`
- `kubernetes_version`: `1.29`.
- `node_instance_type`: `t3.medium`.
- `node_min_size`: 2.
- `node_desired_size`: 3.
- `node_max_size`: 6.
- `cluster_role_arn`
- `node_role_arn`
- `oidc_provider_arn`

**Validation Rules**:

- Node role must have ECR read permissions.
- OIDC provider must be enabled for GitHub Actions and future service-account federation patterns.

## DatabaseInstance

**Purpose**: Managed or documented database dependency.

**Fields**:

- `name`: `accounts-db`, `transfers-db`, `redis`, or MongoDB-compatible ledger/fraud store.
- `engine`: PostgreSQL 15, Redis 7, or MongoDB-compatible engine.
- `instance_class`: `db.t3.micro`, `cache.t3.micro`, or service-specific MongoDB-compatible size.
- `subnet_ids`: Private subnets.
- `security_group_id`: Database security group.
- `secret_keys`: Required Kubernetes/GitHub secret names.

**Validation Rules**:

- Account and transfer database passwords must come from secrets.
- Redis password/auth token must come from secrets where supported.
- MongoDB-compatible URI must be provided to ledger/fraud if those services retain current storage code.

## MessagingCluster

**Purpose**: Kafka infrastructure.

**Fields**:

- `mode`: `msk` or documented `self-hosted`.
- `broker_instance_type`: `kafka.t3.small` for MSK.
- `broker_count`: 3.
- `bootstrap_brokers`
- `topics`: Existing banking topics from local compose.

**Validation Rules**:

- MSK brokers must live in private subnets.
- Application config must point `KAFKA_BROKERS` at private bootstrap brokers.
- Self-hosted mode must be documented as a cost alternative, not the default production path.

## KubernetesWorkload

**Purpose**: Deployment bundle for one service.

**Fields**:

- `deployment_name`
- `container_name`
- `replicas`: 3 for `api-gateway`; 2 for other services.
- `service_type`: ClusterIP for internal services; ALB ingress target for `api-gateway`.
- `configmap_name`
- `secret_name`
- `hpa_name`
- `liveness_probe`: GET `/health`, initial delay 30 seconds, period 10 seconds.
- `readiness_probe`: GET `/health`, initial delay 10 seconds, period 5 seconds.

**Validation Rules**:

- Requests must be CPU `100m` and memory `128Mi`.
- Limits must be CPU `500m` and memory `512Mi`.
- Security context must set `runAsNonRoot=true` and `readOnlyRootFilesystem=true`.
- Secret values must come from `secretKeyRef`; non-secret values from `configMapKeyRef`.

## Workflow

**Purpose**: GitHub Actions workflow.

**Fields**:

- `name`: `ci` or `cd`.
- `trigger`: Push/PR rules.
- `jobs`: Ordered or parallel job list.
- `aws_auth`: OIDC role for deployment jobs.
- `artifacts`: Coverage reports and Terraform planfile.

**Validation Rules**:

- CI must not push images from PRs.
- CD must run on `main` only and after CI success.
- CD must tag images with `${{ github.sha }}`.
- Rollout failures must run `kubectl rollout undo`.
