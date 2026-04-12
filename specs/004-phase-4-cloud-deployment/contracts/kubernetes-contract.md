# Kubernetes Contract

## Namespace

All resources deploy to namespace `banking`.

## Service Ports

| Service | Container Port | Service Type | Public Exposure |
|---------|----------------|--------------|-----------------|
| `api-gateway` | 8080 | ClusterIP behind ALB ingress, or LoadBalancer fallback | Yes, through TLS ingress |
| `account-service` | 3001 | ClusterIP | No |
| `transfer-service` | 3002 | ClusterIP | No |
| `ledger-service` | 3003 | ClusterIP | No |
| `fraud-service` | 3004 | ClusterIP | No |
| `notification-service` | 3005 | ClusterIP | No |

## Deployment Requirements

Each service deployment must include:

- `replicas: 3` for `api-gateway`; `replicas: 2` for all other services.
- Resource requests of `cpu: 100m` and `memory: 128Mi`.
- Resource limits of `cpu: 500m` and `memory: 512Mi`.
- Liveness probe: HTTP GET `/health`, `initialDelaySeconds: 30`, `periodSeconds: 10`.
- Readiness probe: HTTP GET `/health`, `initialDelaySeconds: 10`, `periodSeconds: 5`.
- `securityContext.runAsNonRoot: true`.
- `securityContext.runAsUser: 10001`.
- `securityContext.runAsGroup: 10001`.
- `securityContext.allowPrivilegeEscalation: false`.
- `securityContext.readOnlyRootFilesystem: true`.
- `emptyDir` mounted at `/tmp`.
- `startupProbe`, `terminationGracePeriodSeconds: 60`, and `preStop` drain hook.
- Secret values only via `secretKeyRef`.
- Non-secret config only via `configMapKeyRef`.

## HPA Requirements

Each service must include an `autoscaling/v2` HPA:

- `minReplicas: 3` for `api-gateway`; `minReplicas: 2` for internal services.
- `maxReplicas: 10`.
- CPU average utilization target: `70`.
- Memory average utilization target: `80`.

EKS must have metrics-server or equivalent metrics support installed before HPA behavior can be validated.

## ConfigMap Keys

Common non-secret keys:

- `NODE_ENV=production`
- `LOG_LEVEL=info`
- `KAFKA_CLIENT_ID=cn-banking-platform`
- `KAFKA_SSL=true`
- `KAFKA_SASL_MECHANISM=scram-sha-512`
- `KAFKA_GROUP_ID_PREFIX=cn-banking`

Service-specific non-secret keys:

- `ACCOUNT_SERVICE_PORT=3001`
- `TRANSFER_SERVICE_PORT=3002`
- `LEDGER_SERVICE_PORT=3003`
- `FRAUD_SERVICE_PORT=3004`
- `NOTIFICATION_SERVICE_PORT=3005`
- `PORT=8080`
- `ACCOUNT_SERVICE_URL=http://account-service:3001`
- `TRANSFER_SERVICE_URL=http://transfer-service:3002`
- `MONGODB_DB_NAME=banking_events`
- Kafka topic names from local compose.

## Secret Keys

Common secret keys:

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `REDIS_PASSWORD`
- `DB_ACCOUNTS_PASSWORD`
- `DB_TRANSFERS_PASSWORD`

Service-specific secret keys:

- `ACCOUNTS_DATABASE_URL` or discrete account DB host/user/password values.
- `TRANSFERS_DATABASE_URL` or discrete transfer DB host/user/password values.
- `REDIS_URL`.
- `KAFKA_BROKERS`.
- `KAFKA_SASL_USERNAME`.
- `KAFKA_SASL_PASSWORD`.
- `MONGODB_URI` for `ledger-service` and `fraud-service` if MongoDB-compatible persistence remains.

## Ingress Requirements

`infra/k8s/ingress.yaml` must define ALB ingress for `api-gateway`:

- TLS through ACM certificate ARN placeholder.
- Host/domain placeholder, not a hardcoded real production domain.
- Routing to the `api-gateway` Kubernetes service.
- No direct ingress for internal services.
- `spec.ingressClassName: alb`, HTTP and HTTPS listeners, and ALB SSL redirect to 443.

## Disruption and Network Isolation

- A PodDisruptionBudget with `minAvailable: 1` must exist for each deployment.
- A default-deny NetworkPolicy must exist in namespace `banking`.
- Explicit allow policies must cover DNS, ALB/gateway ingress, gateway-to-service traffic, required internal service calls, and controlled egress to managed data services.

## Manifest Validation Checklist

- `infra/k8s/namespace.yaml` defines namespace `banking`.
- `infra/k8s/secrets.yaml` uses placeholder-only `stringData` values.
- `infra/k8s/ingress.yaml` routes only to `api-gateway`.
- Every `infra/k8s/services/*/deployment.yaml` uses `secretKeyRef` for secrets and `configMapKeyRef` for non-secret config.
- Every `infra/k8s/services/*/service.yaml` uses `type: ClusterIP`.
- Every `infra/k8s/services/*/hpa.yaml` uses `autoscaling/v2` with CPU and memory metrics.
- `infra/k8s/poddisruptionbudgets.yaml` and `infra/k8s/networkpolicies.yaml` validate against Kubernetes 1.29 schemas.
