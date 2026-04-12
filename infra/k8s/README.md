# Kubernetes Manifests

All Kubernetes resources for Phase 4 live under `infra/k8s/` and deploy to namespace `banking`.

## Conventions

- `api-gateway` is the only externally routed service.
- Internal services use ClusterIP.
- Secret values must come from `secretKeyRef`.
- Non-secret configuration must come from `configMapKeyRef`.
- Deployments run as non-root with read-only root filesystems.
- Deployments run as UID/GID `10001` and mount `/tmp` as an `emptyDir` for runtime scratch writes.
- PodDisruptionBudgets and NetworkPolicies are part of the global manifest set.
- HPA resources use CPU and memory targets and require metrics-server or equivalent metrics support in EKS.
- `ingress.yaml` uses AWS ALB annotations and requires the AWS Load Balancer Controller to be installed with IRSA permissions before applying it to EKS.

## Validation

```powershell
kubectl apply --dry-run=client -f infra/k8s/namespace.yaml
kubectl apply --dry-run=client -f infra/k8s/
kubectl get pods -n banking
kubectl rollout status deployment/api-gateway -n banking --timeout=5m
```

Replace placeholder image names, ACM certificate ARN, domain, and secret values before applying to a real cluster. Use a network-policy-capable CNI before relying on pod-to-pod isolation.
