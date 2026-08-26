#!/usr/bin/env bash
set -Eeuo pipefail

BUNDLE_INPUT="${1:-}"
if [ -z "$BUNDLE_INPUT" ]; then
  echo "Usage: bash scripts/aleta-update.sh /path/aleta-update-<version>.tar.gz"
  exit 64
fi

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
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$REPORT_DIR/updates" "$BACKUP_ROOT"

case "$BUNDLE_INPUT" in
  /*) BUNDLE="$BUNDLE_INPUT" ;;
  *) BUNDLE="$(pwd)/$BUNDLE_INPUT" ;;
esac

if [ ! -f "$BUNDLE" ]; then
  echo "Paket update tidak ditemukan: $BUNDLE"
  exit 66
fi

if [ -f "$BUNDLE.sha256" ]; then
  (
    cd "$(dirname "$BUNDLE")"
    sha256sum -c "$(basename "$BUNDLE").sha256"
  )
fi

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

tar -xzf "$BUNDLE" -C "$TMP_DIR"
PACKAGE_ROOT="$(find "$TMP_DIR" -maxdepth 1 -mindepth 1 -type d | head -n 1)"
MANIFEST="$PACKAGE_ROOT/aleta-update.json"

if [ -z "$PACKAGE_ROOT" ] || [ ! -f "$MANIFEST" ]; then
  echo "Paket update tidak valid: manifest aleta-update.json tidak ditemukan."
  exit 65
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

TARGET_VERSION="$(extract_json_string "$MANIFEST" "version")"
if [ -z "$TARGET_VERSION" ]; then
  echo "Versi paket update tidak terbaca dari manifest."
  exit 65
fi

CURRENT_VERSION="$(get_runtime_version)"
BACKUP_FILE="$BACKUP_ROOT/aleta-backup-$STAMP-from-$CURRENT_VERSION-to-$TARGET_VERSION.tar.gz"

echo "Membuat backup sebelum update..."
(
  cd "$APP_DIR"
  backup_items=()
  for item in docker-compose.yml docker-compose.override.yml docker-compose.mode-b.yml .env.production .env.production.example deploy docs scripts manajemen_surat aleta_bot config; do
    if [ -e "$item" ]; then
      backup_items+=("$item")
    fi
  done

  tar \
    --exclude='manajemen_surat/node_modules' \
    --exclude='manajemen_surat/.next' \
    --exclude='manajemen_surat/public/uploads' \
    --exclude='aleta_bot/.wwebjs_auth' \
    --exclude='aleta_bot/temp' \
    --exclude='.git' \
    -czf "$BACKUP_FILE" "${backup_items[@]}"
)

echo "Backup dibuat: $BACKUP_FILE"
echo "Menerapkan paket update $TARGET_VERSION..."

echo "Membersihkan source aplikasi yang dikelola paket agar file lama tidak tertinggal..."
for managed_path in \
  manajemen_surat/src \
  manajemen_surat/drizzle
do
  if [ -d "$PACKAGE_ROOT/$managed_path" ]; then
    rm -rf "$APP_DIR/$managed_path"
  fi
done

cp -a "$PACKAGE_ROOT"/. "$APP_DIR"/
rm -rf "$APP_DIR/manajemen_surat/node_modules" "$APP_DIR/manajemen_surat/.next"

echo "Build ulang service aplikasi..."
if ! (
  cd "$APP_DIR"
  # Bangun ulang portal DAN aleta_bot secara bawaan: banyak perbaikan menyentuh
  # keduanya (mis. jam antrian di bot + tampilannya di portal). Membangun portal
  # saja membuat perbaikan sisi bot tidak pernah sampai ke server. Sesi WhatsApp
  # tetap aman karena tersimpan di volume wwebjs_auth.
  ALETA_UPDATE_SERVICES="${ALETA_UPDATE_SERVICES:-portal aleta_bot}"
  # shellcheck disable=SC2086
  compose build $ALETA_UPDATE_SERVICES
  # shellcheck disable=SC2086
  compose up -d $ALETA_UPDATE_SERVICES
); then
  MESSAGE="Update gagal saat build/start. Restore manual: bash scripts/aleta-rollback.sh $BACKUP_FILE"
  printf '{"version":"%s","previousVersion":"%s","status":"failed","appliedAt":"%s","backupFile":"%s","bundleFile":"%s","message":"%s"}\n' \
    "$TARGET_VERSION" "$CURRENT_VERSION" "$(date -Iseconds)" "$BACKUP_FILE" "$BUNDLE" "$MESSAGE" >> "$HISTORY_FILE"
  echo "$MESSAGE"
  exit 1
fi

if [ "${ALETA_RUN_DB_MIGRATIONS:-0}" = "1" ]; then
  echo "Menjalankan migrasi database..."
  (
    cd "$APP_DIR"
    compose exec -T portal npm run db:migrate
  )
fi

cat > "$STATE_FILE" <<JSON
{
  "currentVersion": "$TARGET_VERSION",
  "previousVersion": "$CURRENT_VERSION",
  "installedAt": "$(date -Iseconds)",
  "lastUpdateStatus": "success",
  "lastUpdateMessage": "Update berhasil diterapkan.",
  "backupFile": "$BACKUP_FILE",
  "bundleFile": "$BUNDLE"
}
JSON

cp "$MANIFEST" "$REPORT_DIR/aleta-update-current.json"
printf '{"version":"%s","previousVersion":"%s","status":"success","appliedAt":"%s","backupFile":"%s","bundleFile":"%s","message":"Update berhasil diterapkan."}\n' \
  "$TARGET_VERSION" "$CURRENT_VERSION" "$(date -Iseconds)" "$BACKUP_FILE" "$BUNDLE" >> "$HISTORY_FILE"

echo "Update ALETA berhasil."
echo "Versi sebelumnya : $CURRENT_VERSION"
echo "Versi sekarang   : $TARGET_VERSION"
echo "Rollback file    : $BACKUP_FILE"
