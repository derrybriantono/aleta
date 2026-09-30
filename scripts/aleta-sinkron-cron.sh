#!/usr/bin/env bash
# ALETA - pemicu Sinkron & cadangan dari cron host (butir 29/30, 30 Sep 2026).
#
# TIDAK WAJIB. Bawaannya penjadwal hidup di dalam portal (src/instrumentation.ts,
# detak semenit sekali). Pakai skrip ini hanya bila penjadwal portal dimatikan
# dengan ALETA_SINKRON_PENJADWAL=0 di .env.production - misalnya supaya jadwal
# ikut cron host yang sudah diawasi.
#
# Portal hanya menjalankan tugas yang JATUH TEMPO menurut layar Admin > Sinkron &
# cadangan, jadi memanggilnya tiap 5 menit TIDAK membuat cadangan tiap 5 menit.
#
# Pasang (dilakukan pengguna sendiri di server, sebagai root):
#   chmod +x /var/www/html/aleta/scripts/aleta-sinkron-cron.sh
#   echo '*/5 * * * * root /var/www/html/aleta/scripts/aleta-sinkron-cron.sh >> /var/log/aleta-sinkron.log 2>&1' \
#     > /etc/cron.d/aleta-sinkron
#
# Token = token internal portal-bot yang sudah ada di .env.production. Tidak
# dicetak ke log.
set -euo pipefail

APP_DIR="${ALETA_APP_DIR:-/var/www/html/aleta}"
ENV_FILE="${ALETA_ENV_FILE:-$APP_DIR/.env.production}"
PORTAL="${ALETA_PORTAL_URL:-http://127.0.0.1:3000/aleta}"

TOKEN="$(grep -E '^ALETA_BOT_INTERNAL_API_TOKEN=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '"'"'"'\r' || true)"
if [ -z "$TOKEN" ]; then
  TOKEN="$(grep -E '^ALETA_BOT_INTERNAL_TOKEN=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '"'"'"'\r' || true)"
fi
if [ -z "$TOKEN" ]; then
  echo "$(date -Is) token internal tidak ditemukan di $ENV_FILE" >&2
  exit 1
fi

KODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  -H "x-aleta-internal-token: $TOKEN" \
  --max-time 30 \
  "$PORTAL/api/sinkron/picu" || echo 000)"
echo "$(date -Is) picu sinkron: HTTP $KODE"
[ "$KODE" = "200" ]
