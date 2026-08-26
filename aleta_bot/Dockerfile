FROM node:20-bookworm-slim

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libgtk-3-0 \
    procps \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3003
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package*.json ./

RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev --no-audit --no-fund; \
    else \
      npm install --omit=dev --no-audit --no-fund; \
    fi

COPY . .

RUN mkdir -p temp/resources/file/doc/ reports .wwebjs_auth

EXPOSE 3003

CMD ["sh", "-c", "mkdir -p temp/resources/file/doc/ && node app.js"]
