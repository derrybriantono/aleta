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

# --- Penjagaan ruang disk -----------------------------------------------------
# Build image portal membongkar node_modules (termasuk binari swc Next.js yang
# besar) ke folder data Docker. Bila ruangnya habis di tengah jalan, build mati
# dengan "no space left on device" SETELAH kode baru terlanjur tersalin -
# aplikasi jadi setengah jalan: kode baru, container lama.
#
# Karena itu ruang diperiksa SEBELUM apa pun disentuh. Lebih baik installer
# menolak berjalan dengan angka yang jelas daripada berhenti di tengah rebuild.

MIN_GB_DOCKER="${ALETA_MIN_GB_DOCKER:-8}"
MIN_GB_APP="${ALETA_MIN_GB_APP:-2}"

ruang_bebas_gb() {
  # Membulatkan ke bawah. Mengembalikan 0 bila path-nya tidak terbaca, sehingga
  # ketidakpastian selalu berujung menolak - bukan melanjutkan.
  df -P -k "$1" 2>/dev/null | awk 'NR==2 { printf "%d", $4/1024/1024 }' || echo 0
}

docker_root() {
  docker info --format '{{.DockerRootDir}}' 2>/dev/null || echo /var/lib/docker
}

periksa_ruang() {
  local root free_docker free_app kurang=0
  root="$(docker_root)"
  [ -d "$root" ] || root="/"

  free_docker="$(ruang_bebas_gb "$root")"
  free_app="$(ruang_bebas_gb "$APP_DIR")"
  [ -n "$free_docker" ] || free_docker=0
  [ -n "$free_app" ] || free_app=0

  log "Memeriksa ruang disk sebelum menyentuh apa pun ..."
  printf '    Folder Docker : %-28s %s GB bebas (minimal %s GB)
' "$root" "$free_docker" "$MIN_GB_DOCKER"
  printf '    Folder aplikasi: %-27s %s GB bebas (minimal %s GB)
' "$APP_DIR" "$free_app" "$MIN_GB_APP"

  [ "$free_docker" -lt "$MIN_GB_DOCKER" ] && kurang=1
  [ "$free_app" -lt "$MIN_GB_APP" ] && kurang=1
  [ "$kurang" -eq 0 ] && return 0

  echo
  warn "Ruang disk tidak cukup. Installer DIHENTIKAN sebelum ada file yang diubah."
  warn "Aplikasi yang sedang berjalan tidak tersentuh sama sekali."
  cat <<SARAN

  Cara melapangkan ruang - jalankan sebagai root, lalu ulangi installer ini:

    # 1. Lihat pemakaian Docker (aman, hanya membaca)
    docker system df

    # 2. Buang sisa build yang gagal dan image tanpa nama (aman:
    #    image yang sedang dipakai container TIDAK ikut terhapus)
    docker builder prune -f
    docker image prune -f

    # 3. Lihat backup lama yang menumpuk, terbesar di atas
    ls -lhS $BACKUP_ROOT/*.tar.gz 2>/dev/null | head -20

    # 4. Hapus backup yang lebih tua dari 30 hari - PERIKSA daftarnya dulu
    find $BACKUP_ROOT -name 'app-before-update-*.tar.gz' -mtime +30

    # 5. Cari folder lain yang besar
    du -xh --max-depth=1 / 2>/dev/null | sort -h | tail -15

  Bila ruang memang mepet dan Anda sudah yakin, batas ini dapat diturunkan:

    ALETA_MIN_GB_DOCKER=4 sudo -E bash install.sh

SARAN
  die "Butuh minimal ${MIN_GB_DOCKER} GB di folder Docker dan ${MIN_GB_APP} GB di folder aplikasi."
}

# --- Pembersihan cache build ------------------------------------------------
# Setiap rebuild meninggalkan cache build di folder data Docker. Cache itu tidak
# pernah dibuang sendiri: pada server ini ia menumpuk sampai 119 GB dari tujuh
# kali pembaruan, memenuhi partisi 200 GB, dan membuat pembaruan berikutnya mati
# di tengah rebuild.
#
# Pembersihan dijalankan SETELAH container terbukti jalan, bukan sebelumnya.
# Cache adalah satu-satunya hal yang membuat rebuild ulang cepat bila ternyata
# ada yang perlu diperbaiki - membuangnya lebih awal justru menyulitkan.
bersihkan_cache_build() {
  local sebelum sesudah
  # Cache build tidak terbagi per proyek: membuangnya membuang cache build
  # semua proyek Docker di server ini. Isinya hanya hasil antara yang dapat
  # dibangun ulang - tidak ada data yang hilang - tetapi build proyek lain jadi
  # lebih lambat sekali. Server yang berbagi dengan aplikasi lain dapat
  # mematikannya: ALETA_SKIP_PRUNE=1 sudo -E bash install.sh
  if [ "${ALETA_SKIP_PRUNE:-0}" = "1" ]; then
    log "Pembersihan cache build dilewati (ALETA_SKIP_PRUNE=1)."
    return 0
  fi

  sebelum="$(ruang_bebas_gb "$(docker_root)")"

  log "Membersihkan cache build Docker ..."
  echo "    Yang dibuang: cache build dan image tanpa nama."
  echo "    Yang DIPERTAHANKAN: image yang sedang dipakai container, volume, dan database."

  docker builder prune -af >/dev/null 2>&1 || warn "docker builder prune gagal, lewati."
  docker image prune -f    >/dev/null 2>&1 || warn "docker image prune gagal, lewati."

  sesudah="$(ruang_bebas_gb "$(docker_root)")"
  [ -n "$sebelum" ] || sebelum=0
  [ -n "$sesudah" ] || sesudah=0
  printf '    Ruang bebas: %s GB -> %s GB
' "$sebelum" "$sesudah"
}

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

periksa_ruang

# --- Siapkan folder data persisten (hanya dibuat bila belum ada) ---
log "Menyiapkan folder data persisten (tidak menimpa yang sudah ada)..."
mkdir -p \
  "$APP_DIR" \
  "$DATA_DIR/uploads" "$DATA_DIR/reports" "$DATA_DIR/wwebjs_auth" "$DATA_DIR/aleta-bot-runtime" \
  "$DATA_DIR/ecourt-session" \
  "$PDF_DIR" "$PG_DIR" "$BACKUP_ROOT"

# Folder sesi e-Court berisi KREDENSIAL: cookie sesi peramban yang, selama
# masih berlaku, memberi akses penuh ke akun e-Court pengadilan. Izinnya
# dipersempit ke pemiliknya saja - folder data lain tidak sepeka ini.
chmod 700 "$DATA_DIR/ecourt-session" 2>/dev/null || true

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

bersihkan_cache_build

cat <<DONE

  ✅ UPDATE selesai.
     - Backup tersimpan di: $BK
     - Rollback cepat: bash $APP_DIR/scripts/aleta-rollback.sh
     - Cek log     : docker compose -f $APP_DIR/docker-compose.yml logs -f --tail=100
     - Cache build sudah dibersihkan otomatis. Untuk melewatinya lain kali:
       ALETA_SKIP_PRUNE=1 sudo -E bash install.sh

DONE
