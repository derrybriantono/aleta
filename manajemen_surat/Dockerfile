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

# ============================================================================
# CAP BUILD - DIHITUNG SENDIRI, BUKAN DIISI TANGAN
# ============================================================================
#
# APP_VERSION dinaikkan manusia, dan karena itu kerap TIDAK berubah antar
# deploy: pada 6 Sep 2026 empat kali penaikan berturut-turut sama-sama
# menyebut 1.86.0, sehingga tidak ada cara melihat apakah kode baru sudah
# hidup selain memanggil rutenya satu per satu.
#
# Cap ini dihitung oleh Docker saat membangun, jadi tidak ada langkah manusia
# yang bisa terlupa. Ditaruh di dalam RUN yang sama dengan `npm run build`
# supaya perilakunya benar terhadap singgahan: bila sumbernya tidak berubah,
# lapisan ini disinggah dan capnya TETAP - dan memang begitu seharusnya,
# karena keluaran buildnya pun sama.
#
# Waktunya WITA, bukan UTC, dan zonanya IKUT DITULIS lewat %Z. Cap pertama
# memakai UTC dan berbunyi "0743" untuk build yang dikerjakan pukul 15:43 -
# selisih delapan jam yang justru akan membuat orang menyimpulkan deploynya
# gagal. %Z membuat capnya membuktikan dirinya sendiri: bila zoneinfo suatu
# saat hilang dari base image, yang tertulis "UTC" dan selisihnya kelihatan,
# bukan menyelinap diam-diam.
#
# ALETA_BUILD_REF diisi penanda git bila yang menaikkan mengetahuinya. Server
# ini tidak punya git, jadi nilainya dikirim dari luar dan boleh kosong.
ARG ALETA_BUILD_REF=

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
  ALETA_STAMP="$(TZ=Asia/Makassar date +'%Y%m%d-%H%M %Z')${ALETA_BUILD_REF:+ ${ALETA_BUILD_REF}}"; \
  echo "=== CAP BUILD: ${ALETA_STAMP} ==="; \
  export NEXT_PUBLIC_ALETA_BUILD_STAMP="${ALETA_STAMP}"; \
  npm run build; \
  printf '%s\n' "${ALETA_STAMP}" > /app/BUILD-STAMP.txt

FROM node:20-bookworm-slim AS runner

# ============================================================================
# ALAT ARSIP DI DALAM CONTAINER
# ============================================================================
#
# Update Manager membuat arsip aplikasi dan basis data dari dalam container:
#   p7zip-full        7z LZMA2 tingkat 9 - sama kuat atau lebih kuat dari RAR,
#                     bebas dipakai, dibuka WinRAR maupun 7-Zip
#   xz-utils          cadangan bila 7z tidak dapat dipakai
#   postgresql-client pg_dump untuk SQL polos DAN format kustom pg_restore
#
# rar TIDAK dipasang: berbayar dan tertutup. Bila kelak dipasang di citra ini,
# arsipnya otomatis menjadi .rar - alatnya diperiksa saat berjalan, bukan
# dipatok di kode.
RUN set -eux; \
  apt-get update; \
  apt-get install -y --no-install-recommends p7zip-full xz-utils postgresql-client; \
  rm -rf /var/lib/apt/lists/*

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
