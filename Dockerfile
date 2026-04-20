# ════════════════════════════════════════════════════════
#  CFL Angular Front — Multi-stage Docker build
#  Alineado con PLATFORM_INTEGRATION_SPEC §7.2.
# ════════════════════════════════════════════════════════

# ── Stage 1: Build ─────────────────────────────────────
FROM node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# ── Stage 2: Serve ─────────────────────────────────────
FROM nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10 AS runtime

RUN rm -rf /usr/share/nginx/html/*

# Angular 17+ emite dist/<proyecto>/browser/
COPY --from=builder /app/dist/cfl-front-ng /tmp/dist
RUN if [ -d /tmp/dist/browser ]; then \
      cp -a /tmp/dist/browser/. /usr/share/nginx/html/; \
    else \
      cp -a /tmp/dist/. /usr/share/nginx/html/; \
    fi \
    && rm -rf /tmp/dist

COPY nginx.conf /etc/nginx/nginx.conf

RUN chown -R nginx:nginx /var/cache/nginx /var/run /var/log/nginx

USER nginx

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
