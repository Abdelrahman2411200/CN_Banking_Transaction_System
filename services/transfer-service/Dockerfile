FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY services ./services
COPY shared ./shared

RUN npm ci

CMD ["npm", "run", "--workspace", "@cn-banking/transfer-service", "dev"]
