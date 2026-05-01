# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# install dependencies first (layer cache)
COPY package.json package-lock.json ./
RUN npm ci

# copy source and build
COPY . .
RUN npm run build

# ── Stage 2: Serve ──────────────────────────────────────────────
FROM nginx:alpine AS runner

# remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# copy our SPA nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
