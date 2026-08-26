#!/usr/bin/env bash
# =============================================================================
# PEMULIHAN DARURAT super-admin ALETA (break-glass).
#
#   bash scripts/aleta-reset-super-admin.sh
#
# Mengatur ULANG password satu akun super-admin dan mengaktifkannya kembali,
# untuk keadaan benar-benar terkunci (lupa password, akun super-admin tak
# sengaja diblokir).
#
# INI BUKAN BACKDOOR. Tidak ada jalan masuk lewat web. Yang bisa memakainya
# hanya orang yang SUDAH memegang server (akses SSH/root + Docker), dan setiap
# pemakaian DICATAT di Audit Trail ALETA sebagai SUPER_ADMIN_EMERGENCY_RESET.
#
# Yang dilakukan, di dalam satu transaksi:
#   1. mengganti password akun kredensial super-admin,
#   2. mengaktifkan kembali akun bila sedang nonaktif,
#   3. mencatat kejadian ke audit_logs.
#
# Password diketik tanpa tampil di layar dan TIDAK pernah masuk daftar proses
# maupun riwayat shell (dibaca lewat prompt, bukan argumen).
# =============================================================================
set -Eeuo pipefail

APP_DIR="${ALETA_APP_DIR:-/var/www/html/aleta}"
ENV_FILE="${ALETA_ENV_FILE:-$APP_DIR/.env.production}"
POSTGRES_SERVICE="${ALETA_POSTGRES_SERVICE:-postgres}"

log()  { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || die "docker tidak ditemukan. Skrip ini dijalankan di host server."
[ -d "$APP_DIR" ] || die "Folder aplikasi tidak ditemukan: $APP_DIR (atur ALETA_APP_DIR bila berbeda)."

# --- Kredensial database diambil dari .env.production ------------------------
read_env() {
  local key="$1"
  [ -f "$ENV_FILE" ] || return 0
  # Ambil nilai terakhir, buang tanda kutip.
  grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

DB_USER="${POSTGRES_USER:-$(read_env POSTGRES_USER)}"
DB_NAME="${POSTGRES_DB:-$(read_env POSTGRES_DB)}"
DB_USER="${DB_USER:-aleta}"
DB_NAME="${DB_NAME:-aleta}"

# Menjalankan psql di dalam container postgres. -T agar bisa dialiri stdin.
psql_run() {
  ( cd "$APP_DIR" && docker compose exec -T "$POSTGRES_SERVICE" psql -U "$DB_USER" -d "$DB_NAME" "$@" )
}

log "Memeriksa koneksi database ($DB_USER@$DB_NAME di service $POSTGRES_SERVICE)"
psql_run -c "SELECT 1;" >/dev/null 2>&1 || die "Tidak dapat terhubung ke database. Pastikan 'docker compose up -d' sudah berjalan."

# --- Daftar super-admin ------------------------------------------------------
log "Akun super-admin yang terdaftar:"
psql_run -P pager=off -c \
  "SELECT username, email, CASE WHEN is_active = 1 THEN 'aktif' ELSE 'NONAKTIF' END AS status
   FROM users
   WHERE role_id = 'super-admin' AND deleted_at IS NULL
   ORDER BY username;"

# --- Pilih akun --------------------------------------------------------------
printf '\nKetik username super-admin yang akan dipulihkan: '
read -r TARGET_USERNAME
[ -n "$TARGET_USERNAME" ] || die "Username kosong."

# Cari user_id + email, sekaligus pastikan benar super-admin. Nilai username
# dikirim sebagai parameter psql (:'v') sehingga aman dari injeksi.
ROW="$(psql_run -At -F '|' -v uname="$TARGET_USERNAME" -c \
  "SELECT id, email FROM users
   WHERE username = :'uname' AND role_id = 'super-admin' AND deleted_at IS NULL
   LIMIT 1;")"
[ -n "$ROW" ] || die "Super-admin dengan username '$TARGET_USERNAME' tidak ditemukan."
TARGET_ID="${ROW%%|*}"
TARGET_EMAIL="${ROW##*|}"
log "Target: $TARGET_USERNAME  (id=$TARGET_ID, email=$TARGET_EMAIL)"

# --- Password baru (tidak tampil, tidak masuk argv/history) ------------------
printf 'Password baru: '
read -rs PASS1; echo
printf 'Ulangi password: '
read -rs PASS2; echo

# Login ALETA memangkas spasi di ujung, jadi hash pun dari nilai yang dipangkas
# supaya password yang diatur di sini benar-benar bisa dipakai masuk.
trim() { printf '%s' "$1" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'; }
PASS1="$(trim "$PASS1")"
PASS2="$(trim "$PASS2")"

[ "$PASS1" = "$PASS2" ] || die "Password tidak sama."
[ "${#PASS1}" -ge 8 ] || die "Password minimal 8 karakter."

# hashSecret ALETA = SHA-256 hex dari password. Cocok dengan verifikasi login.
PASS_HASH="$(printf '%s' "$PASS1" | sha256sum | awk '{print $1}')"
unset PASS1 PASS2

NOW="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
ACTOR="${SUDO_USER:-${USER:-operator}}@host"
AUDIT_ID="adt-reset-$(date -u +%Y%m%d%H%M%S)"
ACCOUNT_ID="acc-reset-$(date -u +%Y%m%d%H%M%S)"

printf '\nAkan mengatur ulang password %s dan mengaktifkannya. Lanjutkan? (ketik YA): ' "$TARGET_USERNAME"
read -r KONFIRM
[ "$KONFIRM" = "YA" ] || die "Dibatalkan."

# --- Terapkan dalam satu transaksi ------------------------------------------
# Semua nilai dikirim sebagai parameter psql (:'name') — tidak ada perakitan
# string SQL dari input, sehingga aman dari injeksi.
log "Menerapkan pemulihan..."
psql_run -v ON_ERROR_STOP=1 \
  -v uid="$TARGET_ID" \
  -v email="$TARGET_EMAIL" \
  -v phash="$PASS_HASH" \
  -v now="$NOW" \
  -v actor="$ACTOR" \
  -v aid="$AUDIT_ID" \
  -v accid="$ACCOUNT_ID" <<'SQL'
BEGIN;

-- 1) Perbarui password akun kredensial bila sudah ada.
UPDATE accounts
   SET password = :'phash', updated_at = :'now'
 WHERE provider_id = 'credential' AND user_id = :'uid';

-- 2) Bila belum ada akun kredensial, buatkan.
INSERT INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
SELECT :'accid', :'email', 'credential', :'uid', :'phash', :'now', :'now'
 WHERE NOT EXISTS (
   SELECT 1 FROM accounts WHERE provider_id = 'credential' AND user_id = :'uid'
 );

-- 3) Selaraskan password_hash pada tabel users dan aktifkan kembali.
UPDATE users
   SET password_hash = :'phash', is_active = 1, updated_at = :'now'
 WHERE id = :'uid';

-- 4) Catat di Audit Trail agar pemakaian break-glass ini terlihat.
INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, payload_json, created_at)
VALUES (:'aid', :'uid', 'SUPER_ADMIN_EMERGENCY_RESET', 'user', :'uid',
        json_build_object('via', 'scripts/aleta-reset-super-admin.sh', 'by', :'actor')::text,
        :'now');

COMMIT;
SQL

unset PASS_HASH
log "Selesai. Super-admin '$TARGET_USERNAME' dapat login dengan password baru."
warn "Segera masuk lalu ganti password lewat halaman Akun, dan tinjau Audit Trail (SUPER_ADMIN_EMERGENCY_RESET)."
