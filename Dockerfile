# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx tsc server/index.ts --outDir dist-server --esModuleInterop --module nodenext --target es2020
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

COPY package*.json ./
RUN npm ci --omit=dev && npm install express cors
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server

EXPOSE 3001
ENV API_PORT=3001

USER appuser

HEALTHCHECK --interval=30s CMD curl -f http://localhost:3001/api/health || exit 1

CMD ["node", "dist-server/index.js"]
