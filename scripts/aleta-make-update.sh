#!/usr/bin/env bash
set -Eeuo pipefail

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "Usage: bash scripts/aleta-make-update.sh <version>"
  echo "Contoh: bash scripts/aleta-make-update.sh 0.1.0-beta.9"
  exit 64
fi

APP_DIR="${ALETA_APP_DIR:-$(pwd)}"
OUTPUT_DIR="${ALETA_UPDATE_OUTPUT_DIR:-$APP_DIR/reports/updates}"
STAMP="$(date +%Y%m%d-%H%M%S)"
PACKAGE_NAME="aleta-update-$VERSION"
BUILD_DIR="$OUTPUT_DIR/build-$VERSION-$STAMP"
PACKAGE_ROOT="$BUILD_DIR/$PACKAGE_NAME"
PACKAGE_FILE="$OUTPUT_DIR/$PACKAGE_NAME.tar.gz"
LATEST_MANIFEST="$OUTPUT_DIR/aleta-update-latest.json"

mkdir -p "$PACKAGE_ROOT" "$OUTPUT_DIR"

copy_path() {
  local source="$1"
  if [ -e "$APP_DIR/$source" ]; then
    mkdir -p "$(dirname "$PACKAGE_ROOT/$source")"
    cp -a "$APP_DIR/$source" "$PACKAGE_ROOT/$source"
  fi
}

# Kode bot IKUT dipaketkan.
#
# Tanpa baris aleta_bot di bawah, scripts/aleta-update.sh tetap membangun ulang
# container aleta_bot - tetapi dari source LAMA yang sudah ada di server.
# Akibatnya perbaikan bot tidak pernah benar-benar terpasang, dan tidak ada
# galat apa pun yang menandakannya: update dilaporkan berhasil, service menyala,
# hanya perilakunya tidak berubah.
#
# Blok pembersihan di bawah sudah lama merujuk $PACKAGE_ROOT/aleta_bot/.wwebjs_auth,
# jadi bot memang dimaksudkan ikut sejak awal; barisnya saja yang tidak pernah
# ada di daftar salin ini.
# Berkas build IKUT dipaketkan, bukan hanya source.
#
# package.json, package-lock.json, Dockerfile, dan next.config.ts adalah
# bagian dari KODE, bukan config server. Tanpa package.json yang baru,
# npm ci di server tidak memasang dependensi yang dibutuhkan rilis ini.
# Tanpa Dockerfile yang baru, container bot dibangun dari base image lama.
# Keduanya gagal dengan cara yang membingungkan: build sukses, service
# menyala, lalu bermasalah saat dipakai.
#
# File .env yang berisi rahasia TETAP tidak ikut - dihapus oleh find di
# bawah, yang hanya menyisakan .env.example.
for item in \
  scripts \
  docs \
  manajemen_surat/src \
  manajemen_surat/drizzle \
  manajemen_surat/public \
  manajemen_surat/scripts \
  aleta_bot/services \
  aleta_bot/routes \
  aleta_bot/config \
  aleta_bot/utils \
  aleta_bot/tools \
  aleta_bot/scripts \
  aleta_bot/app.js \
  aleta_bot/absen.js \
  aleta_bot/detail.js \
  aleta_bot/pengumuman.js \
  aleta_bot/query.js \
  aleta_bot/notifikasi.js \
  aleta_bot/db_config.js \
  aleta_bot/package.json \
  aleta_bot/package-lock.json \
  aleta_bot/Dockerfile \
  aleta_bot/.env.example \
  manajemen_surat/package.json \
  manajemen_surat/package-lock.json \
  manajemen_surat/next.config.ts \
  manajemen_surat/tsconfig.json \
  manajemen_surat/tailwind.config.ts \
  manajemen_surat/postcss.config.js \
  manajemen_surat/drizzle.config.ts \
  manajemen_surat/eslint.config.mjs \
  manajemen_surat/.env.example
do
  copy_path "$item"
done

find "$PACKAGE_ROOT" \( -type d -name node_modules -o -type d -name .next -o -type d -name .git \) -prune -exec rm -rf {} + 2>/dev/null || true
rm -rf \
  "$PACKAGE_ROOT/manajemen_surat/public/uploads" \
  "$PACKAGE_ROOT/manajemen_surat/reports" \
  "$PACKAGE_ROOT/manajemen_surat/.runtime-logs" \
  "$PACKAGE_ROOT/aleta_bot/.wwebjs_auth" \
  "$PACKAGE_ROOT/aleta_bot/temp" \
  "$PACKAGE_ROOT/reports"

# ============================================================================
# SETELAN YANG DITULIS SAAT BERJALAN TIDAK IKUT DIPAKETKAN
# ============================================================================
#
# aleta-runtime.json ditulis BOT saat berjalan: seluruh setelan yang disunting
# petugas dari portal - penerima notifikasi, aturan pengklasifikasi, daftar
# kueri, jadwal penarikan - tersimpan di sana.
#
# Ia berada di dalam aleta_bot/config, dan folder itu memang harus ikut
# dipaketkan karena runtime-config.js di sebelahnya adalah KODE. Akibatnya
# berkas setelan ikut terbawa, dan tiap pembaruan menimpa setelan hidup di
# server dengan salinan yang kebetulan ada di mesin pengembang - diam-diam,
# tanpa satu pun peringatan, dan baru ketahuan ketika ada yang bertanya kenapa
# setelannya kembali seperti dulu.
#
# Yang dibuang hanya berkas setelannya; kodenya tetap ikut.
rm -f "$PACKAGE_ROOT/aleta_bot/config/aleta-runtime.json"

find "$PACKAGE_ROOT" -type f \( -name ".env" -o -name ".env.*" \) \
  ! -name ".env.example" \
  ! -name ".env.production.example" \
  -delete 2>/dev/null || true

cat > "$PACKAGE_ROOT/aleta-update.json" <<JSON
{
  "version": "$VERSION",
  "title": "ALETA $VERSION",
  "channel": "internal-source-only",
  "releasedAt": "$(date -Iseconds)",
  "packageName": "$PACKAGE_NAME.tar.gz",
  "requiredServices": ["portal", "aleta_bot"],
  "summary": "Paket update source ALETA untuk server Docker. Berisi kode portal dan bot beserta berkas build-nya. Tidak membawa config server, database, file PDF, session WhatsApp, dependency terpasang, atau build cache.",
  "notes": [
    "Backup otomatis dibuat oleh scripts/aleta-update.sh sebelum update diterapkan.",
    "Rollback dapat dijalankan dengan scripts/aleta-rollback.sh.",
    "File .env, docker-compose, database, upload, PDF, dan session WhatsApp server TIDAK ikut ditimpa.",
    "Dockerfile, package.json, package-lock.json, dan next.config.ts IKUT ditimpa karena merupakan bagian dari kode rilis. Backup otomatis dibuat sebelum update, dan rollback tersedia bila server memakai versi yang disesuaikan sendiri."
  ]
}
JSON

tar -czf "$PACKAGE_FILE" -C "$BUILD_DIR" "$PACKAGE_NAME"
SHA256="$(sha256sum "$PACKAGE_FILE" | awk '{print $1}')"
printf '%s  %s\n' "$SHA256" "$(basename "$PACKAGE_FILE")" > "$PACKAGE_FILE.sha256"

cat > "$LATEST_MANIFEST" <<JSON
{
  "version": "$VERSION",
  "title": "ALETA $VERSION",
  "channel": "internal",
  "releasedAt": "$(date -Iseconds)",
  "packageName": "$PACKAGE_NAME.tar.gz",
  "packageSha256": "$SHA256",
  "requiredServices": ["portal", "aleta_bot"],
  "summary": "Paket update ALETA siap diterapkan lewat scripts/aleta-update.sh."
}
JSON

rm -rf "$BUILD_DIR"

echo "Paket update dibuat:"
echo "  $PACKAGE_FILE"
echo "Checksum:"
echo "  $PACKAGE_FILE.sha256"
echo "Manifest notifikasi:"
echo "  $LATEST_MANIFEST"
