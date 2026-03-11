# ════════════════════════════════════════════════════════
#  CFL Angular Front — Multi-stage Docker build
#  Uso: docker build -t cfl-front-ng . && docker run -p 8080:80 cfl-front-ng
# ════════════════════════════════════════════════════════

# ── Stage 1: Build ─────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps first (layer cached unless package.json changes)
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source and build
COPY . .
RUN npm run build

# ── Stage 2: Serve ─────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Remove default nginx content
RUN rm -rf /usr/share/nginx/html/*

# Copy built app. Angular may emit either:
# - dist/<project>/...
# - dist/<project>/browser/...
COPY --from=builder /app/dist/cfl-front-ng /tmp/dist
RUN if [ -d /tmp/dist/browser ]; then \
      cp -a /tmp/dist/browser/. /usr/share/nginx/html/; \
    else \
      cp -a /tmp/dist/. /usr/share/nginx/html/; \
    fi \
    && rm -rf /tmp/dist

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
