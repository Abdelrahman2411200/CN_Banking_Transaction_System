# Phase 4 Cloud Deployment — Code Review

**Reviewer**: Claude (automated review)
**Scope**: All artifacts produced for Phase 4 (`specs/004-phase-4-cloud-deployment/tasks.md` T001–T080).
**Date**: 2026-04-12

---

## 1. Summary

Phase 4 delivers the agreed artifacts: six hardened Dockerfiles, a Terraform module layout with dev/prod environments, a Kubernetes manifest tree for the `banking` namespace, and CI/CD workflows. The tasks file is marked complete end-to-end and the surface-level contract (Node 20 Alpine, non-root, `/health` probes, ClusterIP + ALB ingress, HPA v2, OIDC-authenticated CD) is honored.

That said, there are a number of correctness, security, and production-readiness gaps that I would block on before pointing this at a real AWS account. Findings below are grouped by severity.

---

## 2. Blocker Findings (fix before a real apply / deploy)

### 2.1 Kubernetes will reject pods under `runAsNonRoot: true` — no numeric UID

All [deployment.yaml](../../infra/k8s/services/api-gateway/deployment.yaml) files set `securityContext.runAsNonRoot: true` but never set `runAsUser`. The Dockerfiles create the runtime user with `adduser -S appuser` and then `USER appuser` (name, not UID). Kubernetes cannot verify the container will run as non-root from a username alone; the kubelet admission check fails with `CreateContainerConfigError: container has runAsNonRoot and image has non-numeric user (appuser), cannot verify user is non-root`.

**Fix**: either (a) pin a numeric UID in every Dockerfile — `addgroup -S -g 10001 app && adduser -S -G app -u 10001 appuser` and `USER 10001`, or (b) set `securityContext.runAsUser: 10001` on every deployment. Preferably both.

Affected: [services/*/Dockerfile](../../services/api-gateway/Dockerfile), [infra/k8s/services/*/deployment.yaml](../../infra/k8s/services/api-gateway/deployment.yaml).

### 2.2 `readOnlyRootFilesystem: true` with no writable `/tmp`

Every deployment sets `readOnlyRootFilesystem: true` but mounts no `emptyDir` for `/tmp`. Node.js, `npm`, and several dependencies (pino, kafkajs buffer spills) write to `/tmp`. At runtime this surfaces as `EACCES` and restart loops.

**Fix**: add an `emptyDir` volume mounted at `/tmp` (and `/app/.npm` if `npm run start` is the entrypoint) in every service deployment.

### 2.3 Prod RDS has `skip_final_snapshot = true` and no deletion protection

[infra/terraform/modules/databases/rds.tf:24,47](../../infra/terraform/modules/databases/rds.tf) hard-codes `skip_final_snapshot = true` and never sets `deletion_protection` on the `accounts` and `transfers` instances. A `terraform destroy` (or accidental `-replace`) against the prod environment silently loses account and transfer data.

**Fix**: parameterize `skip_final_snapshot` and `deletion_protection` on `var.environment`, default to safe values in prod (`false` / `true`), set `backup_retention_period`, `final_snapshot_identifier`, and `apply_immediately = false`.

### 2.4 EKS cluster API endpoint is public to `0.0.0.0/0`

[infra/terraform/modules/eks/main.tf:10](../../infra/terraform/modules/eks/main.tf) sets `endpoint_public_access = true` with no `public_access_cidrs`. This exposes the Kubernetes API server to the internet with no IP allowlist.

**Fix**: either set `endpoint_public_access = false` (private-only, CD runs from a VPC runner or bastion), or set `public_access_cidrs` to the GitHub Actions IP ranges and operator IPs. The default AWS managed setting should not remain for a banking workload.

### 2.5 MSK allows plaintext client connections

[infra/terraform/modules/messaging/main.tf:23](../../infra/terraform/modules/messaging/main.tf) sets `encryption_in_transit.client_broker = "TLS_PLAINTEXT"`, which permits plaintext on 9092 in addition to TLS. There is also no `client_authentication` block (no SASL/SCRAM or IAM auth), so any pod on the node security group can publish to any topic.

**Fix**: `client_broker = "TLS"` and add `client_authentication { sasl { iam = true } }` (or SCRAM), then use IAM auth in the KafkaJS clients.

### 2.6 Partial deployment rollback in CD leaves split-brain state

[.github/workflows/cd.yml:142-152](../../.github/workflows/cd.yml) rolls out services in a `for` loop and on failure only runs `kubectl rollout undo` for the **current** service, then exits. If service #4 fails, services #1–#3 have already rolled forward to the new image — rollback is partial, and the cluster is now running a mixed-version set.

**Fix**: either (a) run `kubectl set image` for all six deployments first, then loop a second time to `rollout status` each, and on any failure `rollout undo` every service, or (b) use a single `kubectl apply` with all rendered manifests (which the workflow already does on line 141 — the separate `set image` loop is redundant; see §3.3).

### 2.7 `ledger-service` and `fraud-service` deployments have no `DB_HOST`/`MONGODB_DB_NAME` envs wired from the terraform endpoint

The CD "Render and apply manifests" step only substitutes `replace-with-accounts-rds-endpoint` and `replace-with-transfers-rds-endpoint` ([cd.yml:139-140](../../.github/workflows/cd.yml)). There is no substitution for `replace-with-mongodb-compatible-endpoint` in the configmaps — the ledger/fraud/notification deployments will receive the literal placeholder from secrets only (which *is* substituted because the secret is rebuilt from terraform outputs). This works today by coincidence because ledger/fraud only read Mongo via `MONGODB_URI` secret, but the placeholder in the configmap is a landmine for any future env that relies on it.

**Fix**: either remove dangling placeholders from configmaps or add matching sed substitutions.

---

## 3. High-Severity Findings

### 3.1 Docker runner stage installs production deps for every service

Each service's runner stage copies **all six** workspace `package.json` files and runs `npm ci --omit=dev` at the repo root ([services/api-gateway/Dockerfile:26-35](../../services/api-gateway/Dockerfile)). The result: the gateway image ships the production `node_modules` for account, transfer, ledger, fraud, and notification services — and vice versa. This inflates every image by ~4–6x, slows cold starts, and enlarges the attack surface / CVE blast radius.

**Fix**: copy only the target workspace's `package.json` plus `shared/*/package.json` in the runner stage, or `npm prune --workspace <x> --omit=dev` after pruning other workspaces out of the lockfile.

### 3.2 HPA `minReplicas: 2` conflicts with `replicas: 3` on the gateway

[infra/k8s/services/api-gateway/deployment.yaml:9](../../infra/k8s/services/api-gateway/deployment.yaml) sets `replicas: 3` but [hpa.yaml](../../infra/k8s/services/api-gateway/hpa.yaml) sets `minReplicas: 2`. On first reconcile the HPA will immediately scale the deployment down to 2. Either remove `replicas` from deployments that are under HPA control (recommended) or set `replicas: 2` to match `minReplicas`.

### 3.3 CD sets the image twice, once uselessly

[cd.yml:127-141](../../.github/workflows/cd.yml) already renders `${IMAGE_TAG}` into every deployment YAML via `sed` and `kubectl apply`s the tree. The subsequent `kubectl set image` loop on lines 142-152 overwrites that with the same value. Drop the `set image` loop; replace it with a simple `rollout status` loop that calls `rollout undo` on failure across *all* deployments.

### 3.4 ECR repositories are mutable and unencrypted with a CMK

[infra/terraform/modules/registry/main.tf:4,11](../../infra/terraform/modules/registry/main.tf): `image_tag_mutability = "MUTABLE"` and `encryption_type = "AES256"`. For a production banking system, tags should be `IMMUTABLE` (prevents retagging attacks, makes CD idempotent), and encryption should use a customer-managed KMS key so you can rotate/revoke independently of AWS.

### 3.5 Redis is single-node (no failover) even in prod

[infra/terraform/modules/databases/redis.tf:12-13](../../infra/terraform/modules/databases/redis.tf) pins `num_cache_clusters = 1` and `automatic_failover_enabled = false`. The replication group exists in name only. Gateway rate-limit, idempotency, and token-blacklist state are lost on any Redis maintenance window.

**Fix**: parameterize `num_cache_clusters` and `automatic_failover_enabled` on `var.environment` (≥2 and `true` in prod).

### 3.6 Single NAT gateway is a cross-AZ single point of failure

[infra/terraform/modules/networking/main.tf:63-71](../../infra/terraform/modules/networking/main.tf) creates exactly one NAT in the first public subnet, and all three private subnets route 0.0.0.0/0 to it. If AZ `a` goes down, every private workload loses egress (ECR pulls, outbound HTTPS, MSK TLS cert refresh).

**Fix**: create one NAT per AZ (or per private subnet) and one private route table per AZ, as is standard for multi-AZ VPCs.

### 3.7 Registry module `name_prefix` is hardcoded, ignoring env prefix

[infra/terraform/environments/dev/main.tf:41](../../infra/terraform/environments/dev/main.tf) and the matching prod file both pass `name_prefix = "cn-banking"` to the registry module, dropping the `cn-banking-dev` / `cn-banking-prod` prefix used elsewhere. Running `terraform apply` for dev and prod in the same AWS account will collide on repository names `cn-banking/api-gateway` etc. Intentional single-registry is a valid choice, but it should be called out and both envs' `outputs.ecr_repository_urls` will then be identical — the CD workflow uses the registry without environment scoping, so this is probably OK, but worth an explicit decision in [terraform-outputs.md](../../specs/004-phase-4-cloud-deployment/contracts/terraform-outputs.md).

### 3.8 CD has no manual-approval gate for prod

[cd.yml:47-88](../../.github/workflows/cd.yml) runs `terraform apply -auto-approve` on prod on every merge to `main` with no GitHub environment protection. A bad merge destroys prod infra. At minimum, the `terraform` and `deploy` jobs should use `environment: production` with required reviewers and wait timers.

### 3.9 EKS cluster has no control-plane logging enabled

[infra/terraform/modules/eks/main.tf](../../infra/terraform/modules/eks/main.tf) omits `enabled_cluster_log_types`. `api`, `audit`, `authenticator`, `controllerManager`, `scheduler` logs are all disabled by default — no forensic trail for authz decisions.

---

## 4. Medium-Severity Findings

### 4.1 Dockerfile path `COPY --from=builder /app/services/X/dist/services/X/src ./services/X/dist`

Pattern appears in every non-gateway Dockerfile ([account-service/Dockerfile:42](../../services/account-service/Dockerfile) etc.). The nested `dist/services/X/src` structure means `tsconfig.json` is emitting with `rootDir` higher than `src/`, producing the whole repo structure in `dist/`. This is fragile — any refactor of shared types into the service's tsconfig resolution will break the copy path silently. Preferable: set `rootDir: "./src"` in each service `tsconfig.json` so `dist/` contains a clean layout.

### 4.2 API-gateway runner references workspace by short name inconsistently

[services/api-gateway/Dockerfile:17,45](../../services/api-gateway/Dockerfile) uses `--workspace api-gateway` while every other service uses the scoped name (`@cn-banking/account-service`). Works today but it's two conventions to maintain.

### 4.3 Policy test is surface-level and misses the real hardening invariants

[tests/container/dockerfile-policy.test.mjs](../../tests/container/dockerfile-policy.test.mjs) only greps for regex matches. It does not:

- verify the `USER` is numeric (the §2.1 bug),
- check that `COPY .env` doesn't appear (it uses `/\.env/` which also matches `NODE_ENV`'s `E_ENV`? — actually the escaped dot is literal, so it matches "`.env`" specifically; the `NODE_ENV` identifier is safe, but a literal `.env` anywhere in a comment would trip the test. False-positive risk),
- verify the healthcheck port matches `EXPOSE`,
- confirm `HEALTHCHECK` interval/timeout/retries are reasonable,
- check for `--omit=dev` in the runner stage.

Worth expanding before treating this test as a guardrail.

### 4.4 CI `security` job duplicates the `build` job

[ci.yml:62-89](../../.github/workflows/ci.yml) rebuilds every image a second time purely to run Trivy on it. Reuse the image artifact from the `build` job (or merge into a single job) — current config ~2× the CI minutes.

### 4.5 `npm audit --audit-level=high` in a 6-way matrix

Same job runs `npm audit` six times in parallel — the lockfile is identical across all six, so this is ~6× wasteful. Move to a single job.

### 4.6 Trivy is configured to fail on any HIGH/CRITICAL with no ignore/allow-list

[ci.yml:84-89](../../.github/workflows/ci.yml). A single upstream Alpine CVE disclosed on a Friday afternoon blocks every PR until base image is rebased. Add a `.trivyignore` or a grace policy for CVEs <N days old.

### 4.7 Ingress uses deprecated annotation

[infra/k8s/ingress.yaml:7](../../infra/k8s/ingress.yaml) uses `kubernetes.io/ingress.class: alb`, deprecated since K8s 1.22. Use `spec.ingressClassName: alb` instead.

### 4.8 No HTTP→HTTPS redirect on the ALB ingress

Ingress listens only on 443. Any user hitting `http://` gets a connection reset. Add `alb.ingress.kubernetes.io/ssl-redirect: '443'` and a 80→443 listener.

### 4.9 No `PodDisruptionBudget` for any workload

Cluster upgrades or node rotations can evict all replicas of a deployment at once. Add a PDB with `minAvailable: 1` (or `maxUnavailable: 1`) per service.

### 4.10 No NetworkPolicy

All services are reachable pod-to-pod within `banking` regardless of intent. Add default-deny + explicit allow rules (e.g., only `api-gateway` can reach the six backend services; only `transfer-service` can reach `account-service`).

### 4.11 `kubectl create secret` passes passwords on the command line

[cd.yml:114-126](../../.github/workflows/cd.yml) builds the secret via `--from-literal=... --dry-run=client | kubectl apply`. GitHub masks these in logs, but they appear in the runner's process list briefly. Prefer `kubectl apply -f -` with a heredoc YAML, or External Secrets Operator sourcing from AWS Secrets Manager.

### 4.12 `terminationGracePeriodSeconds`, `startupProbe`, and `lifecycle.preStop` all missing

Node services doing Kafka consumer shutdown need more than the default 30s to drain. Add `terminationGracePeriodSeconds: 60` and a `preStop` hook that triggers graceful shutdown.

### 4.13 AWS_REGION stored as a secret

[cd.yml:17,34,65,78,112](../../.github/workflows/cd.yml) references `secrets.AWS_REGION`. Region is not sensitive — use `vars.AWS_REGION` to keep secrets minimal.

---

## 5. Low-Severity / Nits

- [dev/terraform.tfvars.example](../../infra/terraform/environments/dev/terraform.tfvars.example) uses the literal string `"replace-with-..."` — totally fine as a placeholder, but worth adding a comment pointing at the AWS Secrets Manager / SSM parameter that should supply the real value.
- [cd.yml:18](../../.github/workflows/cd.yml) uses `vars.PUBLIC_DOMAIN` but [cd.yml:138](../../.github/workflows/cd.yml) falls back to `banking.example.com` — the fallback will silently ship to a domain you don't own. Make the variable required (fail the workflow if unset).
- [infra/terraform/modules/messaging/main.tf](../../infra/terraform/modules/messaging/main.tf) has no `kafka_version` output or logging config; CloudWatch logs for MSK broker are off.
- [infra/k8s/secrets.yaml](../../infra/k8s/secrets.yaml) is committed with realistic-looking placeholders that include full URIs — since CD overrides them anyway, consider deleting the file outright and generating the secret only from the workflow to eliminate any chance of the placeholder being applied.
- [.dockerignore](../../.dockerignore) excludes `README.md` — harmless, but slightly unusual; some build systems read it for labels.
- [scripts/validate-service-images.ps1](../../scripts/validate-service-images.ps1) is PowerShell-only; no cross-platform equivalent for contributors on macOS/Linux.
- Messaging module shares the `databases` security group with Kafka ([dev/main.tf:75](../../infra/terraform/environments/dev/main.tf)) — functionally OK, but split them if you want to restrict which pods can reach Kafka vs. RDS.
- No EKS cluster log retention or CloudWatch log group cost controls.
- ECR lifecycle keeps 10 images — reasonable, but untagged images from failed pushes accumulate. Add a second rule: expire untagged > 7 days.
- [eks/main.tf:21-33](../../infra/terraform/modules/eks/main.tf) launch template has no `block_device_mappings` — nodes get default 20 GiB gp2. Tune for the workload and use gp3.
- Node.js PID 1 is `npm` (via `CMD ["npm", "run", "start", ...]`) in every Dockerfile — `npm` does not forward SIGTERM cleanly. Use `node dist/index.js` directly or add `tini`.

---

## 6. What Was Done Well

- Consistent multi-stage `builder/runner` pattern across all six services with a single Alpine base.
- Sensible secret/config split: non-secret env via `configMapKeyRef`, secret env via `secretKeyRef`, no secrets baked into images.
- Separate Terraform modules per concern (networking, eks, databases, messaging, registry) with clean outputs wiring, consistent tagging, and sensitive variable flags on all password inputs.
- OIDC-based AWS auth in CD — no long-lived access keys in repo.
- `.dockerignore` prevents `.env*`, tfstate, and tfvars from leaking into build contexts.
- Clear service catalog ([infra/service-catalog.md](../../infra/service-catalog.md)) as a single source of truth for ports, ECR names, and deployment names.
- `docker-compose.test.yml` is well-structured with health-gated `depends_on` and a dedicated test-runner container.

---

## 7. Recommended Next Steps

Ordered by priority:

1. **Fix §2.1, §2.2** — without these, no pod will start in EKS. Cheap to fix.
2. **Fix §2.3 prod RDS safety and §2.4 public EKS endpoint** — both are one-tfvar / one-line changes that remove real risk.
3. **Fix §2.5 MSK plaintext + auth** — requires matching code changes in KafkaJS consumers for IAM/SASL.
4. **Consolidate the CD rollout (§2.6, §3.3)** — simpler AND correct.
5. **Parameterize prod-vs-dev posture** (RDS, Redis, NAT, ECR mutability) in a `locals { prod_hardened = var.environment == "prod" }` block and flip every relevant resource off of it.
6. **Tighten the Dockerfile runner stage (§3.1)** — cuts image size and CVE footprint meaningfully.
7. **Add a GitHub environment with required reviewers for `prod`** (§3.8) before anyone merges to `main` with a wired-up backend.
8. **Expand [dockerfile-policy.test.mjs](../../tests/container/dockerfile-policy.test.mjs)** to catch numeric-UID, healthcheck port alignment, and runner `--omit=dev` (§4.3).
9. **Add PDBs and NetworkPolicies** (§4.9, §4.10) before scaling out.

---

## 8. Overall Assessment

The skeleton is correct and the contract in [tasks.md](tasks.md) is honored, but the current tree is **not production-safe** as a banking workload:

- Two blockers (§2.1, §2.2) will prevent *any* pod from starting.
- Three blockers (§2.3, §2.4, §2.5) would let a single incident or misclick cause data loss or a public breach.
- One blocker (§2.6) guarantees a bad CD run leaves the cluster in a mixed-version state.

The Phase 4 tasks mark these as `[X]` done because the task list validates structure (files exist, string contracts match), not runtime or security posture. I would recommend treating §2 as an immediate follow-up ticket set before marking Phase 4 truly complete, and §3 as a hardening backlog before opening the main-branch CD path on a real AWS account.
