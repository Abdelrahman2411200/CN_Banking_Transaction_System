FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY services/account-service ./services/account-service
COPY shared/types ./shared/types

RUN npm ci

CMD ["npm", "run", "--workspace", "@cn-banking/account-service", "dev"]
