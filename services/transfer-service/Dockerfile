FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY services/transfer-service ./services/transfer-service
COPY shared/types ./shared/types

RUN npm ci

CMD ["npm", "run", "--workspace", "@cn-banking/transfer-service", "dev"]
