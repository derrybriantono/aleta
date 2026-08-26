#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/html/aleta}"

cd "$APP_DIR"
docker-compose stop
docker-compose ps

echo "Container ALETA dihentikan tanpa menghapus data, volume, atau sesi WhatsApp."
