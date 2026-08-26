#!/usr/bin/env bash
set -Eeuo pipefail

PACKAGE_PATH="${1:-}"
if [[ -z "$PACKAGE_PATH" ]]; then
  echo "Usage: bash scripts/aleta-update.sh /path/to/aleta-update-<version>.tar.gz"
  exit 1
fi

if [[ ! -f "$PACKAGE_PATH" ]]; then
  echo "Package not found: $PACKAGE_PATH"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_ROOT="${ALETA_BACKUP_DIR:-"$(cd "$APP_DIR/.." && pwd)/aleta-backups"}"
BACKUP_NAME="aleta-backup-$(date -u +"%Y%m%dT%H%M%SZ").tar.gz"
BACKUP_PATH="$BACKUP_ROOT/$BACKUP_NAME"
HISTORY_PATH="${ALETA_UPDATE_HISTORY:-"$APP_DIR/reports/aleta-update-history.log"}"
PACKAGE_DIR="$(cd "$(dirname "$PACKAGE_PATH")" && pwd)"
PACKAGE_FILE="$(basename "$PACKAGE_PATH")"

mkdir -p "$BACKUP_ROOT" "$(dirname "$HISTORY_PATH")"

remove_managed_path() {
  local relative_path="$1"
  local target_path="$APP_DIR/$relative_path"

  if [[ ! -e "$target_path" ]]; then
    return
  fi

  case "$relative_path" in
    src|drizzle)
      ;;
    *)
      echo "Refusing to remove unmanaged path: $relative_path"
      exit 1
      ;;
  esac

  echo "Removing managed source path before extract: $target_path"
  rm -rf "$target_path"
}

if [[ -f "$PACKAGE_PATH.sha256" ]]; then
  echo "Verifying checksum: $PACKAGE_PATH.sha256"
  (cd "$PACKAGE_DIR" && sha256sum -c "$PACKAGE_FILE.sha256")
fi

echo "Creating backup: $BACKUP_PATH"
tar -czf "$BACKUP_PATH" -C "$APP_DIR" \
  --exclude=.git \
  --exclude=.next \
  --exclude=node_modules \
  --exclude=tmp \
  --exclude=data \
  --exclude=reports \
  --exclude=uploads \
  --exclude=aleta-pdf \
  --exclude='*.pdf' \
  --exclude='*.PDF' \
  --exclude=.wwebjs_auth \
  --exclude=.wwebjs_cache \
  .

remove_managed_path "src"
remove_managed_path "drizzle"

echo "Extracting package into $APP_DIR"
tar -xzf "$PACKAGE_PATH" -C "$APP_DIR"

if [[ "${ALETA_RUN_DB_MIGRATIONS:-0}" == "1" ]]; then
  echo "Running database migrations"
  npm run db:migrate
else
  echo "Skipping database migrations. Set ALETA_RUN_DB_MIGRATIONS=1 to run them."
fi

if [[ -n "${ALETA_REBUILD_CMD:-}" ]]; then
  echo "Running rebuild command: $ALETA_REBUILD_CMD"
  bash -lc "$ALETA_REBUILD_CMD"
else
  echo "No ALETA_REBUILD_CMD set. Run your usual rebuild command after this script."
fi

if [[ -n "${ALETA_RESTART_CMD:-}" ]]; then
  echo "Running restart command: $ALETA_RESTART_CMD"
  bash -lc "$ALETA_RESTART_CMD"
else
  echo "No ALETA_RESTART_CMD set. Restart the portal/aleta_bot services using your server procedure."
fi

{
  echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") package=$PACKAGE_FILE backup=$BACKUP_PATH migrations=${ALETA_RUN_DB_MIGRATIONS:-0}"
} >> "$HISTORY_PATH"

echo "Update applied. Backup saved at:"
echo "  $BACKUP_PATH"
