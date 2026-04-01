FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY shared/types/package.json ./shared/types/package.json
COPY services/account-service/package.json ./services/account-service/package.json
COPY services/transfer-service/package.json ./services/transfer-service/package.json
COPY services/ledger-service/package.json ./services/ledger-service/package.json
COPY services/fraud-service/package.json ./services/fraud-service/package.json
COPY services/notification-service/package.json ./services/notification-service/package.json
COPY shared/types ./shared/types
COPY services/ledger-service ./services/ledger-service

RUN npm ci

CMD ["npm", "run", "--workspace", "@cn-banking/ledger-service", "dev"]
