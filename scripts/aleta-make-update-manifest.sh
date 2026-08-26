#!/usr/bin/env bash
# =============================================================================
# Membuat manifest rilis (JSON) yang dibaca semua ALETA satker untuk
# memberi tahu ada versi baru dan mengunduhnya.
#
#   bash scripts/aleta-make-update-manifest.sh <versi> <base-url> [judul] [ringkasan]
#
# Contoh:
#   bash scripts/aleta-make-update-manifest.sh 1.6.3 https://rilis.contoh.id/aleta \
#     "ALETA v1.6.3" "Perbaikan antrian online dan blangko jawaban."
#
# Hasil:
#   reports/installer/aleta-update-latest.json
#
# Unggah DUA berkas ke <base-url>:
#   - aleta-update-latest.json  (arahkan ALETA_UPDATE_MANIFEST_URL ke sini)
#   - aleta-installer-<versi>.tar.gz  (paket yang dibuat aleta-make-installer.sh)
#
# Checksum diambil dari berkas .sha256 yang menyertai paket, sehingga manifest
# selalu cocok dengan paket yang benar-benar dibangun.
# =============================================================================
set -Eeuo pipefail

VERSI="${1:-}"
BASE_URL="${2:-}"
JUDUL="${3:-ALETA v${VERSI}}"
RINGKASAN="${4:-Pembaruan ALETA versi ${VERSI}.}"

[ -n "$VERSI" ] || { echo "Versi wajib diisi. Contoh: bash $0 1.6.3 https://rilis.contoh.id/aleta" >&2; exit 1; }
[ -n "$BASE_URL" ] || { echo "Base URL wajib diisi (tempat berkas rilis di-hosting)." >&2; exit 1; }

DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALLER_DIR="$DIR/reports/installer"
PAKET="aleta-installer-${VERSI}.tar.gz"
PAKET_PATH="$INSTALLER_DIR/$PAKET"
SHA_PATH="$PAKET_PATH.sha256"

[ -f "$PAKET_PATH" ] || { echo "Paket tidak ditemukan: $PAKET_PATH" >&2; echo "Bangun dulu: bash scripts/aleta-make-installer.sh $VERSI" >&2; exit 1; }
[ -f "$SHA_PATH" ]   || { echo "Checksum tidak ditemukan: $SHA_PATH" >&2; exit 1; }

SHA256="$(awk '{print $1}' < "$SHA_PATH")"
BASE_URL="${BASE_URL%/}"
DOWNLOAD_URL="$BASE_URL/$PAKET"
DIRILIS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

MANIFEST="$INSTALLER_DIR/aleta-update-latest.json"
cat > "$MANIFEST" <<JSON
{
  "version": "${VERSI}",
  "title": "${JUDUL}",
  "channel": "stable",
  "releasedAt": "${DIRILIS}",
  "summary": "${RINGKASAN}",
  "packageName": "${PAKET}",
  "downloadUrl": "${DOWNLOAD_URL}",
  "packageSha256": "${SHA256}",
  "minCurrentVersion": "1.5.0",
  "requiredServices": ["portal", "aleta_bot"]
}
JSON

echo "Manifest dibuat: $MANIFEST"
echo
echo "Langkah publikasi:"
echo "  1. Unggah $PAKET ke $DOWNLOAD_URL"
echo "  2. Unggah aleta-update-latest.json ke $BASE_URL/aleta-update-latest.json"
echo "  3. Di tiap satker, set di .env.production:"
echo "       ALETA_UPDATE_MANIFEST_URL=$BASE_URL/aleta-update-latest.json"
echo
echo "Isi manifest:"
cat "$MANIFEST"
