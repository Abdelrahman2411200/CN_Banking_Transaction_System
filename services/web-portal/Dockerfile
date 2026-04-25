FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY shared/types/package.json ./shared/types/package.json
COPY shared/kafka/package.json ./shared/kafka/package.json
COPY services/api-gateway/package.json ./services/api-gateway/package.json
COPY services/account-service/package.json ./services/account-service/package.json
COPY services/transfer-service/package.json ./services/transfer-service/package.json
COPY services/ledger-service/package.json ./services/ledger-service/package.json
COPY services/fraud-service/package.json ./services/fraud-service/package.json
COPY services/notification-service/package.json ./services/notification-service/package.json
COPY services/web-portal/package.json ./services/web-portal/package.json
RUN npm ci

COPY services/web-portal ./services/web-portal
RUN npm run build --workspace @cn-banking/web-portal

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runner

ARG VERSION=dev
LABEL org.opencontainers.image.title="CN Banking Web Portal" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.description="Static React portal for gateway-only CN Banking operations"

COPY services/web-portal/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/services/web-portal/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget --spider -q http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
