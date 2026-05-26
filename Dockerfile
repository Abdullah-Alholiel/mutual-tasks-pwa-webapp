# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm install express cors
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY tsconfig.json ./

# Install tsx for running TypeScript server
RUN npm install -g tsx

EXPOSE 3001
ENV API_PORT=3001
CMD ["tsx", "server/index.ts"]
