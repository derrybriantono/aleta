#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/html/aleta}"
DATA_DIR="${DATA_DIR:-/var/www/html/aleta-data}"
PDF_DIR="${PDF_DIR:-/var/www/html/aleta-pdf}"

cd "$APP_DIR"

if [ ! -f ".env.production" ]; then
  echo "File .env.production belum ada. Salin dari .env.production.example lalu isi secret di server."
  exit 1
fi

mkdir -p "$DATA_DIR/uploads" "$DATA_DIR/reports" "$DATA_DIR/wwebjs_auth" "$DATA_DIR/aleta-bot-runtime" "$PDF_DIR"

docker-compose up -d
docker-compose ps

echo "ALETA dijalankan. Akses pengguna melalui http://192.168.10.10/aleta setelah reverse proxy aktif."
