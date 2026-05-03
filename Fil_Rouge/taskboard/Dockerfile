# syntax=docker/dockerfile:1.7

FROM node:20.19.0-bookworm-slim AS deps
WORKDIR /app

ENV npm_config_update_notifier=false \
	npm_config_fund=false \
	npm_config_audit=false

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM gcr.io/distroless/nodejs20-debian12:nonroot AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=deps --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --chown=nonroot:nonroot package*.json ./
COPY --chown=nonroot:nonroot src ./src
COPY --chown=nonroot:nonroot public ./public
COPY --chown=nonroot:nonroot healthcheck.js ./healthcheck.js

USER nonroot

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=25s --retries=3 CMD ["/nodejs/bin/node", "/app/healthcheck.js"]

CMD ["src/server.js"]