#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/html/aleta}"

cd "$APP_DIR"
docker-compose logs --tail=200 "$@"
