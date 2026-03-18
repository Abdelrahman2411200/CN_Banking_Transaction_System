FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY services/fraud-service ./services/fraud-service
COPY shared/types ./shared/types
COPY shared/kafka ./shared/kafka

RUN npm install

CMD ["npm", "run", "--workspace", "@cn-banking/fraud-service", "dev"]
