#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/html/aleta}"

cd "$APP_DIR"
docker-compose restart portal aleta_bot
docker-compose ps

echo "Portal dan ALETA Bot sudah dimuat ulang. Data dan sesi WhatsApp tetap dipertahankan."
