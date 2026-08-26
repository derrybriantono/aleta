#!/usr/bin/env bash
set -Eeuo pipefail

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "Usage: bash scripts/aleta-make-update.sh <version>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RELEASE_DIR="${ALETA_RELEASE_DIR:-"$APP_DIR/releases"}"
PACKAGE_NAME="aleta-update-${VERSION}.tar.gz"
PACKAGE_PATH="$RELEASE_DIR/$PACKAGE_NAME"
MANIFEST_PATH="$RELEASE_DIR/aleta-update-latest.json"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$RELEASE_DIR"
rm -f "$PACKAGE_PATH" "$PACKAGE_PATH.sha256" "$MANIFEST_PATH"

EXCLUDES=(
  "--exclude=.git"
  "--exclude=.next"
  "--exclude=node_modules"
  "--exclude=tmp"
  "--exclude=data"
  "--exclude=releases"
  "--exclude=reports"
  "--exclude=uploads"
  "--exclude=aleta-pdf"
  "--exclude=.runtime-logs"
  "--exclude=.backup"
  "--exclude=.codex-logs"
  "--exclude=.vscode"
  "--exclude=coverage"
  "--exclude=test-results"
  "--exclude=playwright-report"
  "--exclude=*.log"
  "--exclude=*.bak"
  "--exclude=*.bak-*"
  "--exclude=*.backup"
  "--exclude=*.tsbuildinfo"
  "--exclude=./*.png"
  "--exclude=./*-runtime.json"
  "--exclude=*.pdf"
  "--exclude=*.PDF"
  "--exclude=.env"
  "--exclude=.env.*"
  "--exclude=package.json"
  "--exclude=package.json.*"
  "--exclude=package-lock.json"
  "--exclude=package-lock.json.*"
  "--exclude=next.config.ts"
  "--exclude=next.config.ts.*"
  "--exclude=Dockerfile"
  "--exclude=Dockerfile.*"
  "--exclude=docker-compose.postgres.yml"
  "--exclude=docker-compose.postgres.yml.*"
  "--exclude=.wwebjs_auth"
  "--exclude=.wwebjs_cache"
)

cat > "$TMP_DIR/aleta-update.json" <<JSON
{
  "version": "$VERSION",
  "package": "$PACKAGE_NAME",
  "checksum": "$PACKAGE_NAME.sha256",
  "createdAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "notes": "Default package excludes local/server config, env, database/runtime data, uploads, PDFs, sessions, node_modules, .next, tmp, and reports."
}
JSON

echo "Creating $PACKAGE_PATH"
tar -czf "$PACKAGE_PATH" "${EXCLUDES[@]}" -C "$TMP_DIR" aleta-update.json -C "$APP_DIR" .

if command -v sha256sum >/dev/null 2>&1; then
  (cd "$RELEASE_DIR" && sha256sum "$PACKAGE_NAME" > "$PACKAGE_NAME.sha256")
else
  shasum -a 256 "$PACKAGE_PATH" | sed "s#  $PACKAGE_PATH#  $PACKAGE_NAME#" > "$PACKAGE_PATH.sha256"
fi

cp "$TMP_DIR/aleta-update.json" "$MANIFEST_PATH"

echo "Created:"
echo "  $PACKAGE_PATH"
echo "  $PACKAGE_PATH.sha256"
echo "  $MANIFEST_PATH"
