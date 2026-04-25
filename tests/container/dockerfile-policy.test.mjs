import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const services = [
  ['api-gateway', 8080, 'api-gateway'],
  ['account-service', 3001, '@cn-banking/account-service'],
  ['transfer-service', 3002, '@cn-banking/transfer-service'],
  ['ledger-service', 3003, '@cn-banking/ledger-service'],
  ['fraud-service', 3004, '@cn-banking/fraud-service'],
  ['notification-service', 3005, '@cn-banking/notification-service'],
];

for (const [service, port, workspace] of services) {
  test(`${service} Dockerfile uses the Phase 4 production image contract`, () => {
    const dockerfile = readFileSync(`services/${service}/Dockerfile`, 'utf8');

    assert.match(dockerfile, /FROM node:20-alpine AS builder/);
    assert.match(dockerfile, /FROM node:20-alpine AS runner/);
    assert.match(dockerfile, /npm ci/);
    assert.match(dockerfile, /npm run build/);
    assert.match(dockerfile, /addgroup -S -g 10001 app/);
    assert.match(dockerfile, /adduser -S -G app -u 10001 appuser/);
    assert.match(dockerfile, /USER 10001/);
    assert.match(dockerfile, new RegExp(`npm ci --omit=dev[\\s\\S]+--workspace ${workspace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.match(dockerfile, new RegExp(`EXPOSE ${port}`));
    assert.match(dockerfile, new RegExp(`HEALTHCHECK[\\s\\S]+wget --spider -q http://localhost:${port}/health`));
    assert.match(dockerfile, new RegExp(`HEALTHCHECK[\\s\\S]+--timeout=5s[\\s\\S]+--retries=3`));
    assert.match(dockerfile, new RegExp(`CMD \\["node", "services/${service}/dist/index\\.js"\\]`));
    assert.doesNotMatch(dockerfile, /COPY\s+.*\.env/i);
    assert.doesNotMatch(dockerfile, /USER\s+appuser/);
  });
}

test('web-portal Dockerfile uses the Phase 15 static portal image contract', () => {
  const dockerfile = readFileSync('services/web-portal/Dockerfile', 'utf8');
  const nginxConfig = readFileSync('services/web-portal/nginx.conf', 'utf8');

  assert.match(dockerfile, /FROM node:20-alpine AS builder/);
  assert.match(dockerfile, /FROM nginxinc\/nginx-unprivileged:1\.27-alpine AS runner/);
  assert.match(dockerfile, /npm ci/);
  assert.match(dockerfile, /npm run build --workspace @cn-banking\/web-portal/);
  assert.match(dockerfile, /COPY --from=builder \/app\/services\/web-portal\/dist \/usr\/share\/nginx\/html/);
  assert.match(dockerfile, /EXPOSE 8080/);
  assert.match(dockerfile, /HEALTHCHECK[\s\S]+http:\/\/127\.0\.0\.1:8080\/healthz/);
  assert.match(dockerfile, /CMD \["nginx", "-g", "daemon off;"\]/);
  assert.doesNotMatch(dockerfile, /COPY\s+.*\.env/i);

  assert.match(nginxConfig, /Content-Security-Policy/);
  assert.match(nginxConfig, /location = \/config\.js[\s\S]+Cache-Control "no-store"/);
  assert.match(nginxConfig, /location \/assets\/[\s\S]+max-age=31536000, immutable/);
  assert.match(nginxConfig, /try_files \$uri \$uri\/ \/index\.html/);
});
