# Container Validation

Phase 4 production images must satisfy the service image contract before they are pushed to ECR.

## Policy Test

```powershell
node --test tests/container/dockerfile-policy.test.mjs
```

The policy test checks every service Dockerfile for:

- Node 20 Alpine builder and runner stages.
- `npm ci` dependency installation and a build step.
- Non-root `appuser` runtime.
- Correct `EXPOSE` port.
- `/health` Docker healthcheck using `wget --spider`.
- No `.env` copies into the image.

## Image Build Smoke Test

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate-service-images.ps1
```

On macOS/Linux:

```bash
sh scripts/validate-service-images.sh
```

Expected service ports:

- `api-gateway`: 8080
- `account-service`: 3001
- `transfer-service`: 3002
- `ledger-service`: 3003
- `fraud-service`: 3004
- `notification-service`: 3005
