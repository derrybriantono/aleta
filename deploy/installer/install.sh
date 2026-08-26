#!/usr/bin/env bash
# =============================================================================
# ALETA Installer — dijalankan di server Linux (CentOS 7) yang sudah ada Docker.
# Satu paket ini melayani DUA skenario secara otomatis:
#   1. FRESH  : server baru (satker lain) yang belum punya ALETA.
#   2. UPDATE : server yang sudah menjalankan ALETA (config sudah ada).
# Deteksi otomatis berdasarkan keberadaan file .env.production di folder aplikasi.
#
# Installer ini AMAN:
#   - Tidak pernah menimpa .env.production, docker-compose.yml, atau data/volume.
#   - Membuat backup sebelum menyentuh file lama (mode UPDATE).
#   - Tidak menghapus database, PDF, atau session WhatsApp.
# =============================================================================
set -Eeuo pipefail

PKG_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$PKG_DIR/app"

APP_DIR="${ALETA_APP_DIR:-/var/www/html/aleta}"
DATA_DIR="${ALETA_DATA_DIR:-/var/www/html/aleta-data}"
PDF_DIR="${ALETA_PDF_DIR:-/var/www/html/aleta-pdf}"
PG_DIR="${ALETA_PG_DIR:-/home/aleta-data/postgres}"
BACKUP_ROOT="${ALETA_BACKUP_ROOT:-/var/www/html/aleta-backup}"
ASSUME_YES="${ALETA_ASSUME_YES:-0}"
STAMP="$(date +%Y%m%d-%H%M%S)"

# --- Aplikasi kode yang diperbarui saat UPDATE (config TIDAK termasuk) ---
APP_CODE_ITEMS=(manajemen_surat aleta_bot deploy scripts docs .env.production.example)

log()  { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }

confirm() {
  [ "$ASSUME_YES" = "1" ] && return 0
  printf '%s [y/N]: ' "$1"
  read -r ans
  case "$ans" in y|Y|ya|YA|yes|YES) return 0 ;; *) return 1 ;; esac
}

compose() {
  if docker compose version >/dev/null 2>&1; then
    (cd "$APP_DIR" && docker compose "$@")
  else
    (cd "$APP_DIR" && docker-compose "$@")
  fi
}

# --- Pra-syarat ---
[ -d "$SRC_DIR" ] || die "Struktur paket tidak valid: folder 'app/' tidak ditemukan di $PKG_DIR."
command -v docker >/dev/null 2>&1 || die "Docker belum terpasang di server ini."
if ! docker compose version >/dev/null 2>&1 && ! command -v docker-compose >/dev/null 2>&1; then
  die "docker compose / docker-compose tidak ditemukan."
fi

# --- Deteksi mode ---
MODE="fresh"
[ -f "$APP_DIR/.env.production" ] && MODE="update"

cat <<BANNER

  ┌─────────────────────────────────────────────┐
  │   INSTALLER ALETA (Portal + WhatsApp Bot)    │
  └─────────────────────────────────────────────┘
  Mode terdeteksi : $MODE
  Folder aplikasi : $APP_DIR
  Folder data     : $DATA_DIR
  Folder PDF      : $PDF_DIR
  Folder Postgres : $PG_DIR
  Folder backup   : $BACKUP_ROOT

BANNER

# --- Siapkan folder data persisten (hanya dibuat bila belum ada) ---
log "Menyiapkan folder data persisten (tidak menimpa yang sudah ada)..."
mkdir -p \
  "$APP_DIR" \
  "$DATA_DIR/uploads" "$DATA_DIR/reports" "$DATA_DIR/wwebjs_auth" "$DATA_DIR/aleta-bot-runtime" \
  "$PDF_DIR" "$PG_DIR" "$BACKUP_ROOT"

# =============================================================================
# MODE FRESH — server satker baru
# =============================================================================
if [ "$MODE" = "fresh" ]; then
  log "FRESH INSTALL: menyalin seluruh file aplikasi ke $APP_DIR ..."
  cp -a "$SRC_DIR/." "$APP_DIR/"

  if [ ! -f "$APP_DIR/.env.production" ]; then
    cp "$APP_DIR/.env.production.example" "$APP_DIR/.env.production"
    chmod 600 "$APP_DIR/.env.production"
    log "File .env.production dibuat dari template (.env.production.example)."
  fi

  cat <<NEXT

  ✅ File aplikasi tersalin. FRESH INSTALL BELUM di-build otomatis
     karena Anda WAJIB mengisi konfigurasi & database dulu.

  Langkah selanjutnya (WAJIB, berurutan):

  1. Isi secret & alamat server di:
       $APP_DIR/.env.production
     Minimal ganti semua "CHANGE_ME_*":
       - POSTGRES_PASSWORD & DATABASE_URL (password sama)
       - BETTER_AUTH_SECRET  (acak panjang; contoh: openssl rand -hex 32)
       - ALETA_BOT_INTERNAL_TOKEN & ALETA_BOT_INTERNAL_API_TOKEN (nilai SAMA)
       - SERVER_IP & BETTER_AUTH_URL  (sesuai IP server satker Anda)
       - Kredensial DB SIPP (read-only) bila memakai notifikasi perkara.

  2. Sesuaikan IP pada docker-compose.yml bila IP satker BUKAN 192.168.10.10
     (cari baris "BETTER_AUTH_URL: http://192.168.10.10/aleta").

  3. Siapkan database MySQL untuk ALETA Bot (sebagai DBA MySQL):
       mysql -u root -p < $APP_DIR/deploy/sql/setup-aleta-mysql-databases.sql
       mysql -u root -p < $APP_DIR/deploy/sql/schema-aleta-bot-mysql.sql
     (Database portal PostgreSQL dibuat otomatis oleh container + migrasi.)

  4. Build & jalankan:
       cd $APP_DIR
       docker compose build
       docker compose up -d
       docker compose ps        # tunggu semua "healthy"

  5. Reverse proxy: tempel deploy/nginx/aleta.conf (atau deploy/apache/aleta.conf)
     ke web server host, arahkan /aleta -> 127.0.0.1:3000.

  6. Buka http://IP-SERVER/aleta -> ikuti Wizard Setup untuk membuat
     institusi & akun Super Admin pertama.

NEXT
  exit 0
fi

# =============================================================================
# MODE UPDATE — server yang sudah berjalan
# =============================================================================
log "UPDATE: membuat backup terlebih dahulu ..."
if [ -x "$APP_DIR/scripts/docker-backup-aleta.sh" ]; then
  APP_DIR="$APP_DIR" DATA_DIR="$DATA_DIR" PDF_DIR="$PDF_DIR" BACKUP_DIR="$BACKUP_ROOT" \
    bash "$APP_DIR/scripts/docker-backup-aleta.sh" || warn "Skrip backup bawaan gagal, lanjut backup file aplikasi manual."
fi
BK="$BACKUP_ROOT/app-before-update-$STAMP.tar.gz"
tar -czf "$BK" \
  --exclude='node_modules' --exclude='.next' --exclude='.wwebjs_auth' \
  -C "$(dirname "$APP_DIR")" "$(basename "$APP_DIR")" 2>/dev/null || warn "Backup file aplikasi tidak lengkap."
log "Backup file aplikasi: $BK"

echo
warn "Yang DIPERBARUI : kode portal + bot, deploy/, scripts/, docs/, .env.production.example"
warn "Yang DIPERTAHANKAN: .env.production, docker-compose.yml, database, PDF, session WhatsApp"
echo
confirm "Lanjutkan menyalin file kode baru dan rebuild?" || die "Dibatalkan oleh operator."

log "Menyalin kode baru (config server tidak disentuh) ..."
for item in "${APP_CODE_ITEMS[@]}"; do
  if [ -e "$SRC_DIR/$item" ]; then
    rm -rf "$APP_DIR/$item.old-$STAMP" 2>/dev/null || true
    # buang node_modules/.next lama di target agar build bersih, simpan tak perlu
    cp -a "$SRC_DIR/$item" "$APP_DIR/.stage-$STAMP-$(basename "$item")"
    rm -rf "$APP_DIR/$item"
    mv "$APP_DIR/.stage-$STAMP-$(basename "$item")" "$APP_DIR/$item"
    printf '   diperbarui: %s\n' "$item"
  fi
done

# Pastikan folder runtime yang dibutuhkan bot tetap ada
mkdir -p "$APP_DIR/aleta_bot/temp/resources/file/doc"

log "Rebuild image portal & aleta_bot ..."
compose build portal aleta_bot

log "Menjalankan ulang container ..."
compose up -d

log "Status container:"
compose ps || true

cat <<DONE

  ✅ UPDATE selesai.
     - Backup tersimpan di: $BK
     - Rollback cepat: bash $APP_DIR/scripts/aleta-rollback.sh
     - Cek log     : docker compose -f $APP_DIR/docker-compose.yml logs -f --tail=100

DONE
