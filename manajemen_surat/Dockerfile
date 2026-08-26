FROM node:20-bookworm-slim AS deps

WORKDIR /app
ENV npm_config_audit=false \
  npm_config_fund=false \
  npm_config_progress=false \
  npm_config_registry=https://registry.npmjs.org/ \
  npm_config_fetch_retries=5 \
  npm_config_fetch_retry_mintimeout=20000 \
  npm_config_fetch_retry_maxtimeout=120000 \
  npm_config_fetch_timeout=300000
COPY package*.json ./
RUN set -eux; \
  npm --version; \
  npm cache clean --force; \
  npm ci --include=dev --no-audit --no-fund --loglevel=warn; \
  test -f node_modules/next/dist/bin/next; \
  node -e "console.log('NEXT VERSION:', require('next/package.json').version)"

FROM node:20-bookworm-slim AS builder

WORKDIR /app
ARG NEXT_PUBLIC_BASE_PATH=/aleta
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}

COPY . .
RUN rm -rf node_modules .next
COPY --from=deps /app/node_modules ./node_modules

RUN set -eux; \
  echo "=== NEXT CHECK ==="; \
  ls -lah node_modules/next || true; \
  ls -lah node_modules/next/dist/bin/next; \
  mkdir -p node_modules/.bin; \
  ln -sf ../next/dist/bin/next node_modules/.bin/next; \
  chmod +x node_modules/next/dist/bin/next; \
  ls -lah node_modules/.bin/next; \
  node -e "console.log('NEXT VERSION:', require('next/package.json').version)"; \
  npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app
ARG NEXT_PUBLIC_BASE_PATH=/aleta
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app ./

EXPOSE 3000
CMD ["npm", "start"]
