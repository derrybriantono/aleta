#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/html/aleta}"
DATA_DIR="${DATA_DIR:-/var/www/html/aleta-data}"
PDF_DIR="${PDF_DIR:-/var/www/html/aleta-pdf}"
BACKUP_DIR="${BACKUP_DIR:-/var/www/html/aleta-backup}"
STAMP="$(date +%F-%H%M%S)"
TARGET_DIR="$BACKUP_DIR/$STAMP"

mkdir -p "$TARGET_DIR"

echo "Membuat backup ALETA ke $TARGET_DIR"

if [ -d "$DATA_DIR" ]; then
  tar -czf "$TARGET_DIR/aleta-data.tar.gz" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"
fi

if [ -d "$PDF_DIR" ]; then
  tar -czf "$TARGET_DIR/aleta-pdf.tar.gz" -C "$(dirname "$PDF_DIR")" "$(basename "$PDF_DIR")"
fi

if [ -f "$APP_DIR/.env.production" ]; then
  cp "$APP_DIR/.env.production" "$TARGET_DIR/.env.production"
  chmod 600 "$TARGET_DIR/.env.production"
fi

cd "$APP_DIR"
if docker-compose ps postgres 2>/dev/null | grep -q "Up"; then
  POSTGRES_USER_VALUE="${POSTGRES_USER:-aleta}"
  POSTGRES_DB_VALUE="${POSTGRES_DB:-aleta}"
  docker-compose exec -T postgres pg_dump -U "$POSTGRES_USER_VALUE" "$POSTGRES_DB_VALUE" > "$TARGET_DIR/postgres.sql" || {
    echo "Backup database via pg_dump belum berhasil. Periksa kredensial PostgreSQL."
  }
fi

echo "Backup selesai. File secret tidak ditampilkan di log."
