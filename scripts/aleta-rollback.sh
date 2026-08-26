#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${ALETA_APP_DIR:-$(pwd)}"
if [ ! -f "$APP_DIR/docker-compose.yml" ]; then
  echo "Folder aplikasi tidak valid: $APP_DIR"
  echo "Jalankan dari /var/www/html/aleta atau set ALETA_APP_DIR."
  exit 66
fi

if [ -d "/var/www/html/aleta-data/reports" ]; then
  REPORT_DIR="${ALETA_REPORT_DIR:-/var/www/html/aleta-data/reports}"
else
  REPORT_DIR="${ALETA_REPORT_DIR:-$APP_DIR/reports}"
fi

STATE_FILE="${ALETA_UPDATE_STATE_PATH:-$REPORT_DIR/aleta-update-state.json}"
HISTORY_FILE="${ALETA_UPDATE_HISTORY_PATH:-$REPORT_DIR/updates/history.jsonl}"
BACKUP_ROOT="${ALETA_BACKUP_ROOT:-$(dirname "$APP_DIR")/aleta-backups}"
BACKUP_INPUT="${1:-}"

mkdir -p "$REPORT_DIR/updates"

if [ -n "$BACKUP_INPUT" ]; then
  case "$BACKUP_INPUT" in
    /*) BACKUP_FILE="$BACKUP_INPUT" ;;
    *) BACKUP_FILE="$(pwd)/$BACKUP_INPUT" ;;
  esac
else
  BACKUP_FILE="$(ls -t "$BACKUP_ROOT"/aleta-backup-*.tar.gz 2>/dev/null | head -n 1 || true)"
fi

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup rollback tidak ditemukan."
  echo "Daftar backup:"
  ls -lah "$BACKUP_ROOT" 2>/dev/null || true
  exit 66
fi

extract_json_string() {
  local file="$1"
  local key="$2"
  sed -n "s/.*\"$key\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p" "$file" | head -n 1
}

get_runtime_version() {
  if [ -f "$STATE_FILE" ]; then
    local state_version
    state_version="$(extract_json_string "$STATE_FILE" "currentVersion")"
    if [ -n "$state_version" ]; then
      echo "$state_version"
      return
    fi
  fi

  if [ -f "$APP_DIR/manajemen_surat/src/lib/patch-notes.ts" ]; then
    sed -n 's/^export const APP_VERSION = "\([^"]*\)";.*/\1/p' "$APP_DIR/manajemen_surat/src/lib/patch-notes.ts" | head -n 1
    return
  fi

  echo "unknown"
}

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  else
    docker-compose "$@"
  fi
}

CURRENT_VERSION="$(get_runtime_version)"

echo "Backup yang akan dipulihkan:"
echo "  $BACKUP_FILE"
echo "Versi aktif saat ini:"
echo "  $CURRENT_VERSION"

if [ "${ALETA_ROLLBACK_ASSUME_YES:-0}" != "1" ]; then
  printf "Lanjut rollback? ketik YES: "
  read -r CONFIRMATION
  if [ "$CONFIRMATION" != "YES" ]; then
    echo "Rollback dibatalkan."
    exit 0
  fi
fi

echo "Memulihkan file aplikasi dari backup..."
tar -xzf "$BACKUP_FILE" -C "$APP_DIR"
rm -rf "$APP_DIR/manajemen_surat/node_modules" "$APP_DIR/manajemen_surat/.next"

echo "Build ulang container setelah rollback..."
(
  cd "$APP_DIR"
  compose build portal aleta_bot
  compose up -d portal aleta_bot
)

RESTORED_VERSION="$(get_runtime_version)"
if [ "$RESTORED_VERSION" = "$CURRENT_VERSION" ] && [ -f "$APP_DIR/manajemen_surat/src/lib/patch-notes.ts" ]; then
  RESTORED_VERSION="$(sed -n 's/^export const APP_VERSION = "\([^"]*\)";.*/\1/p' "$APP_DIR/manajemen_surat/src/lib/patch-notes.ts" | head -n 1)"
fi

cat > "$STATE_FILE" <<JSON
{
  "currentVersion": "$RESTORED_VERSION",
  "previousVersion": "$CURRENT_VERSION",
  "installedAt": "$(date -Iseconds)",
  "lastUpdateStatus": "rolled_back",
  "lastUpdateMessage": "Rollback berhasil diterapkan.",
  "backupFile": "$BACKUP_FILE"
}
JSON

printf '{"version":"%s","previousVersion":"%s","status":"rolled_back","appliedAt":"%s","backupFile":"%s","message":"Rollback berhasil diterapkan."}\n' \
  "$RESTORED_VERSION" "$CURRENT_VERSION" "$(date -Iseconds)" "$BACKUP_FILE" >> "$HISTORY_FILE"

echo "Rollback ALETA berhasil."
echo "Versi sebelumnya aktif : $CURRENT_VERSION"
echo "Versi setelah rollback : $RESTORED_VERSION"
