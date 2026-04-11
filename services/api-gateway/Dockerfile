FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY services/api-gateway ./services/api-gateway
RUN npm ci --omit=dev
EXPOSE 8080
CMD ["npm", "start", "--workspace", "api-gateway"]
