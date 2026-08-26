#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_ROOT="${ALETA_BACKUP_DIR:-"$(cd "$APP_DIR/.." && pwd)/aleta-backups"}"
BACKUP_PATH="${1:-}"
HISTORY_PATH="${ALETA_UPDATE_HISTORY:-"$APP_DIR/reports/aleta-update-history.log"}"

if [[ -z "$BACKUP_PATH" ]]; then
  BACKUP_PATH="$(ls -1t "$BACKUP_ROOT"/aleta-backup-*.tar.gz 2>/dev/null | head -n 1 || true)"
fi

if [[ -z "$BACKUP_PATH" || ! -f "$BACKUP_PATH" ]]; then
  echo "Backup not found. Pass an explicit backup file or check $BACKUP_ROOT."
  exit 1
fi

echo "Rollback will restore:"
echo "  $BACKUP_PATH"
echo "Into:"
echo "  $APP_DIR"
read -r -p "Type YES to continue: " CONFIRMATION
if [[ "$CONFIRMATION" != "YES" ]]; then
  echo "Rollback cancelled."
  exit 1
fi

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

  echo "Removing managed source path before rollback extract: $target_path"
  rm -rf "$target_path"
}

remove_managed_path "src"
remove_managed_path "drizzle"

tar -xzf "$BACKUP_PATH" -C "$APP_DIR"

if [[ -n "${ALETA_REBUILD_CMD:-}" ]]; then
  echo "Running rebuild command: $ALETA_REBUILD_CMD"
  bash -lc "$ALETA_REBUILD_CMD"
else
  echo "No ALETA_REBUILD_CMD set. Run your usual rebuild command after rollback."
fi

if [[ -n "${ALETA_RESTART_CMD:-}" ]]; then
  echo "Running restart command: $ALETA_RESTART_CMD"
  bash -lc "$ALETA_RESTART_CMD"
else
  echo "No ALETA_RESTART_CMD set. Restart the portal/aleta_bot services using your server procedure."
fi

mkdir -p "$(dirname "$HISTORY_PATH")"
{
  echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") rollback=$BACKUP_PATH"
} >> "$HISTORY_PATH"

echo "Rollback completed from:"
echo "  $BACKUP_PATH"
