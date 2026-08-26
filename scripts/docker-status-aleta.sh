#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/html/aleta}"

cd "$APP_DIR"

load_internal_token() {
  if [ -f "$APP_DIR/.env.production" ]; then
    set -a
    # shellcheck disable=SC1091
    . "$APP_DIR/.env.production"
    set +a
  fi

  printf '%s' "${ALETA_BOT_INTERNAL_TOKEN:-${ALETA_BOT_INTERNAL_API_TOKEN:-}}"
}

echo "== Container =="
docker-compose ps

echo
echo "== Port lokal =="
if command -v ss >/dev/null 2>&1; then
  ss -ltnp | grep -E ':(3000|3003)\b' || true
else
  netstat -ltnp 2>/dev/null | grep -E ':(3000|3003)\b' || true
fi

echo
echo "== Portal =="
curl -fsSI http://127.0.0.1:3000/aleta | head -n 1 || echo "Portal /aleta belum merespons."
curl -fsSI http://127.0.0.1:3000/aleta/portal | head -n 1 || echo "Portal /aleta/portal belum merespons."

echo
echo "== ALETA Bot =="
INTERNAL_TOKEN="$(load_internal_token)"
if [ -z "$INTERNAL_TOKEN" ]; then
  echo "Token internal ALETA Bot belum tersedia di .env.production. Isi ALETA_BOT_INTERNAL_TOKEN sebelum cek endpoint internal."
else
  curl -fsS -H "x-aleta-internal-token: ${INTERNAL_TOKEN}" http://127.0.0.1:3003/internal/aleta-bot/status \
    | sed -E 's/(qr|qrCode|rawQr|token|secret|password)":"[^"]*"/\1":"[disembunyikan]"/g' \
    || echo "ALETA Bot belum merespons atau token internal tidak sesuai."
fi

echo
echo "Catatan: jangan buka port 3000/3003 untuk pengguna umum. Gunakan http://192.168.10.10/aleta."
