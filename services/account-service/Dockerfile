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
RUN npm ci

COPY shared ./shared
COPY services/account-service ./services/account-service
RUN npm run build --workspace @cn-banking/shared-types \
    && npm run build --workspace @cn-banking/shared-kafka \
    && npm run build --workspace @cn-banking/account-service

FROM node:20-alpine AS runner
WORKDIR /app

ARG VERSION=dev
ENV NODE_ENV=production \
    APP_VERSION=$VERSION

COPY package*.json ./
COPY shared/types/package.json ./shared/types/package.json
COPY shared/kafka/package.json ./shared/kafka/package.json
COPY services/api-gateway/package.json ./services/api-gateway/package.json
COPY services/account-service/package.json ./services/account-service/package.json
COPY services/transfer-service/package.json ./services/transfer-service/package.json
COPY services/ledger-service/package.json ./services/ledger-service/package.json
COPY services/fraud-service/package.json ./services/fraud-service/package.json
COPY services/notification-service/package.json ./services/notification-service/package.json
RUN npm ci --omit=dev --workspace @cn-banking/shared-types --workspace @cn-banking/shared-kafka --workspace @cn-banking/account-service --include-workspace-root=false && npm cache clean --force

COPY --from=builder /app/shared/types/dist ./shared/types/dist
COPY --from=builder /app/shared/kafka/dist ./shared/kafka/dist
COPY --from=builder /app/services/account-service/dist/services/account-service/src ./services/account-service/dist

RUN addgroup -S -g 10001 app && adduser -S -G app -u 10001 appuser
USER 10001

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget --spider -q http://localhost:3001/health || exit 1

CMD ["node", "services/account-service/dist/index.js"]
