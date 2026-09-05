#!/usr/bin/env bash
# =============================================================================
# Membuat paket installer LENGKAP ALETA (.tar.gz) — fresh install + update.
# Berisi seluruh kode aplikasi TANPA: secret/.env, node_modules, .next,
# database, PDF, session WhatsApp, log, atau file backup.
#
# Pemakaian:
#   bash scripts/aleta-make-installer.sh <versi>
#   contoh: bash scripts/aleta-make-installer.sh 1.4.15
# Hasil di: reports/installer/aleta-installer-<versi>.tar.gz (+ .sha256)
# =============================================================================
set -Eeuo pipefail

VERSION="${1:-}"
[ -n "$VERSION" ] || { echo "Usage: bash scripts/aleta-make-installer.sh <versi>"; exit 64; }

APP_DIR="${ALETA_APP_DIR:-$(pwd)}"
OUT_DIR="${ALETA_INSTALLER_OUTPUT_DIR:-$APP_DIR/reports/installer}"
STAMP="$(date +%Y%m%d-%H%M%S)"
PKG_NAME="aleta-installer-$VERSION"
BUILD_DIR="$OUT_DIR/build-$VERSION-$STAMP"
PKG_ROOT="$BUILD_DIR/$PKG_NAME"
APP_STAGE="$PKG_ROOT/app"
PKG_FILE="$OUT_DIR/$PKG_NAME.tar.gz"

# Top-level item yang IKUT dikemas (kode + template config, tanpa secret).
INCLUDE_ITEMS=(
  manajemen_surat
  aleta_bot
  deploy
  scripts
  docs
  # Ekstensi peramban untuk halaman SIPP. Tidak dipasang otomatis oleh
  # installer - petugas memuatnya sendiri lewat chrome://extensions - tetapi
  # tetap ikut dipaketkan supaya berkasnya sampai ke server bersama rilis.
  ekstensi-sipp
  docker-compose.yml
  docker-compose.override.yml
  .env.production.example
)

# Pola yang DIBUANG saat menyalin (junk / berat / rahasia / data).
EXCLUDES=(
  --exclude=node_modules
  --exclude=.next
  --exclude=.git
  --exclude=.turbo
  --exclude=.wwebjs_auth
  --exclude=temp
  --exclude=tmp
  --exclude=data
  --exclude=reports
  --exclude=runtime-logs
  --exclude=.runtime-logs
  --exclude=archive_unused
  --exclude=coverage
  --exclude=public/uploads
  --exclude=.env
  --exclude=.env.local
  --exclude=.env.production
  --exclude='*.env.production.bak-*'
  --exclude='*.bak'
  --exclude='*.bak-*'
  --exclude='*.swp'
  --exclude='*.log'
  --exclude='*.err.log'
  --exclude='*.out.log'
  --exclude='*.tar.gz'
  --exclude='*.pdf'
  --exclude='next-env.d.ts'
)

echo "==> Menyiapkan staging: $APP_STAGE"
mkdir -p "$APP_STAGE" "$OUT_DIR"

# Salin hanya item yang di-include, sambil membuang pola excludes.
# tar-pipe: efisien, tidak pernah menyentuh node_modules.
present=()
for it in "${INCLUDE_ITEMS[@]}"; do
  [ -e "$APP_DIR/$it" ] && present+=("$it") || echo "    (lewati, tidak ada) $it"
done
tar -C "$APP_DIR" "${EXCLUDES[@]}" -cf - "${present[@]}" | tar -C "$APP_STAGE" -xf -

# Pengaman ekstra: hapus sisa file sensitif bila lolos filter.
find "$APP_STAGE" -type f \( -name ".env" -o -name ".env.production" -o -name ".env.local" \) \
  ! -name ".env.example" ! -name ".env.production.example" -delete 2>/dev/null || true
find "$APP_STAGE" -type d -name node_modules -prune -exec rm -rf {} + 2>/dev/null || true
find "$APP_STAGE" -type d -name .next -prune -exec rm -rf {} + 2>/dev/null || true

# Sertakan installer & panduan di root paket.
cp "$APP_DIR/deploy/installer/install.sh" "$PKG_ROOT/install.sh"
cp "$APP_DIR/deploy/installer/INSTALL.md" "$PKG_ROOT/INSTALL.md"
chmod +x "$PKG_ROOT/install.sh"

# Manifest.
FILE_COUNT="$(find "$APP_STAGE" -type f | wc -l | tr -d ' ')"
cat > "$PKG_ROOT/aleta-installer.json" <<JSON
{
  "product": "ALETA (Portal Manajemen Surat + WhatsApp Bot)",
  "version": "$VERSION",
  "builtAt": "$(date -Iseconds)",
  "packageName": "$PKG_NAME.tar.gz",
  "supports": ["fresh-install", "update"],
  "fileCount": $FILE_COUNT,
  "excludesSecrets": true,
  "notes": [
    "Jalankan install.sh di server; mode fresh/update terdeteksi otomatis.",
    "Paket tidak berisi .env, node_modules, .next, database, PDF, atau session WhatsApp."
  ]
}
JSON

# ---------------------------------------------------------------------------
# NORMALKAN AKHIR BARIS SEBELUM DIKEMAS
#
# Repositori ini dikembangkan di Windows. Bila working tree tempat paket
# dibuat punya core.autocrlf aktif, berkas skrip ikut ber-CRLF - dan Linux
# menolaknya dengan galat yang menyesatkan:
#
#     : nama pilihan tidak valid pipefail
#
# Karakter CR memindahkan kursor ke awal baris sehingga pesan aslinya
# tertimpa, dan tidak ada petunjuk sama sekali bahwa masalahnya akhir baris.
#
# .gitattributes sudah mencegahnya di tingkat git, tetapi penjagaan ini tetap
# ada karena paket dapat dibuat dari salinan yang tidak melewati git sama
# sekali - misalnya folder hasil unzip atau hasil salin manual.
# ---------------------------------------------------------------------------
echo "==> Menormalkan akhir baris berkas yang dijalankan di Linux..."
find "$PKG_ROOT" -type f \( \
  -name "*.sh" -o -name "*.bash" -o -name "*.sql" -o \
  -name "Dockerfile" -o -name ".dockerignore" -o \
  -name "*.conf" -o -name "*.service" -o -name "*.yml" -o -name "*.yaml" \
\) -exec sed -i "s/\r$//" {} + 2>/dev/null || true

# Skrip harus dapat dijalankan setelah paket dibuka.
find "$PKG_ROOT" -type f -name "*.sh" -exec chmod +x {} + 2>/dev/null || true

echo "==> Mengemas: $PKG_FILE"
tar -czf "$PKG_FILE" -C "$BUILD_DIR" "$PKG_NAME"
( cd "$OUT_DIR" && sha256sum "$PKG_NAME.tar.gz" > "$PKG_NAME.tar.gz.sha256" )
rm -rf "$BUILD_DIR"

SIZE="$(du -h "$PKG_FILE" | cut -f1)"
echo
echo "  ✅ Paket installer siap:"
echo "     $PKG_FILE   ($SIZE, $FILE_COUNT file)"
echo "     $PKG_FILE.sha256"
echo
echo "  Bagikan file .tar.gz ini. Di server tujuan:"
echo "     tar -xzf $PKG_NAME.tar.gz && cd $PKG_NAME && sudo bash install.sh"
