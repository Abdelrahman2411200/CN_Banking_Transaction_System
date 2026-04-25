# Web Portal Operations

The web portal is a static Vite build served by Nginx. It remains a gateway-only client:

- Browser API calls use `window.__CN_BANKING_CONFIG__.apiBaseUrl`.
- Local builds use `public/config.js`, which points at `http://localhost:8080`.
- EKS mounts `infra/k8s/services/web-portal/configmap.yaml` over `/config.js`.
- Production ingress serves the portal at `portal.${PUBLIC_DOMAIN}`.
- The API gateway remains at `${PUBLIC_DOMAIN}` and is the only backend API boundary.

## Build Validation

```powershell
npm run lint --workspace @cn-banking/web-portal
npm run typecheck --workspace @cn-banking/web-portal
npm test --workspace @cn-banking/web-portal
npm run test:e2e --workspace @cn-banking/web-portal
npm run build --workspace @cn-banking/web-portal
docker build -f services/web-portal/Dockerfile -t cn-banking/web-portal:local .
```

## Headers

`nginx.conf` applies:

- `Content-Security-Policy` allowing app scripts from self, Google-hosted Inter and Material Symbols font loading, and gateway HTTP/S connections.
- `Cache-Control: no-store` for `index.html`, SPA fallbacks, and `config.js`.
- `Cache-Control: public, max-age=31536000, immutable` for hashed Vite assets.
- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and a restrictive `Permissions-Policy`.

## Image Scanning

CI builds and scans the `web-portal` image with Trivy alongside backend service images. CD builds and pushes the same image to ECR before applying the EKS manifests.
