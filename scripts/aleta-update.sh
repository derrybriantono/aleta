#!/usr/bin/env bash
set -Eeuo pipefail

# ============================================================================
# SKRIP INI MENIMPA DIRINYA SENDIRI - JADI IA DIJALANKAN DARI SALINAN
# ============================================================================
#
# Paket pembaruan memuat scripts/, dan langkah "menerapkan paket" di bawah
# menyalinnya ke tempat berkas ini sendiri berada - sementara ia masih
# berjalan.
#
# Bash membaca skrip BERTAHAP, dari offset bita. Selama isi barunya sama
# persis dengan yang lama, offsetnya tetap cocok dan tidak ada yang terjadi -
# itulah sebabnya cacat ini tidak terlihat selama berbulan-bulan, sebab
# skripnya memang jarang berubah. Begitu isinya BERBEDA, bash melanjutkan
# membaca dari offset lama pada berkas yang baru, dan yang dibacanya potongan
# di tengah baris:
#
#     scripts/aleta-update.sh: baris 207: EOF tidak terduga
#
# Yang terjadi 23 September 2026: berkasnya sudah tersalin, tetapi build,
# migrasi, dan penyalaan ulang tidak pernah berjalan. Peladen tertinggal
# separuh - sumber versi baru, kontainer versi lama - dan itu keadaan yang
# tidak disebut satu baris pun di lognya.
#
# Karena itu langkah pertamanya menyalin diri ke /tmp lalu melanjutkan dari
# sana. Yang berjalan bukan lagi berkas yang kelak ditimpa.
if [ -z "${ALETA_UPDATE_DARI_SALINAN:-}" ]; then
  ALETA_SALINAN_SKRIP="$(mktemp /tmp/aleta-update-XXXXXXXX.sh)"
  cat "$0" > "$ALETA_SALINAN_SKRIP"
  chmod +x "$ALETA_SALINAN_SKRIP"
  export ALETA_UPDATE_DARI_SALINAN=1
  export ALETA_SALINAN_SKRIP
  exec bash "$ALETA_SALINAN_SKRIP" "$@"
fi
# Salinannya dibuang sesudah selesai, berhasil maupun gagal.
trap '[ -n "${ALETA_SALINAN_SKRIP:-}" ] && rm -f "$ALETA_SALINAN_SKRIP"' EXIT

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

  # ==========================================================================
  # KODE KELUAR 1 DARI tar ADALAH PERINGATAN, BUKAN KEGAGALAN
  # ==========================================================================
  #
  #   0   berhasil
  #   1   ada berkas yang berubah saat dibaca - arsipnya TETAP lengkap
  #   2+  galat sungguhan
  #
  # Skrip ini berjalan di bawah `set -Eeuo pipefail`, jadi kode 1 dulu
  # membunuhnya seketika - tepat sebelum baris "Backup dibuat" tercetak.
  # Terjadi 23 September 2026 pada pemasangan 2.33.0: cadangannya 7,6 MB
  # berisi 2.504 entri dan kesebelas kelompoknya lengkap, tetapi pemasangan
  # berhenti di situ dan peladen tetap di versi lama. Tidak ada yang rusak -
  # hanya tidak ada yang terjadi, dan sebabnya tidak terbaca dari lognya.
  #
  # Berkas yang berubah saat dibaca memang terjadi pada aplikasi yang sedang
  # berjalan, dan menolak mencadangkan karenanya berarti menolak memasang apa
  # pun selama aplikasinya hidup.
  set +e
  tar \
    --exclude='manajemen_surat/node_modules' \
    --exclude='manajemen_surat/.next' \
    --exclude='manajemen_surat/public/uploads' \
    --exclude='aleta_bot/.wwebjs_auth' \
    --exclude='aleta_bot/temp' \
    --exclude='.git' \
    -czf "$BACKUP_FILE" "${backup_items[@]}"
  TAR_RC=$?
  set -e
  if [ "$TAR_RC" -ge 2 ]; then
    echo "Backup GAGAL - tar keluar dengan kode $TAR_RC. Pemasangan dihentikan."
    exit "$TAR_RC"
  fi
  if [ "$TAR_RC" -eq 1 ]; then
    echo "Catatan: ada berkas yang berubah saat dicadangkan (tar kode 1). Arsipnya diperiksa di bawah."
  fi
)

# ============================================================================
# CADANGAN DIBUKTIKAN, BUKAN DIPERCAYA
# ============================================================================
#
# Ia satu-satunya jalan pulang bila pemasangan ini keliru. Menerimanya tanpa
# membuktikannya sama saja tidak punya cadangan - dan ketiadaannya baru
# ketahuan pada saat ia paling dibutuhkan.
if [ ! -s "$BACKUP_FILE" ]; then
  echo "Backup tidak terbentuk atau kosong: $BACKUP_FILE. Pemasangan dihentikan."
  exit 66
fi
# Daftar isinya dibaca SEKALI, lalu daftar itu yang diperiksa.
#
# JANGAN memakai `tar -tzf ... | grep -q X` di sini. Di bawah `set -o pipefail`
# bentuk itu SELALU gagal justru ketika yang dicari KETEMU: grep -q berhenti
# pada kecocokan pertama, pipanya tertutup, tar menerima SIGPIPE dan keluar
# bukan-nol - dan pipefail membaca kode itu sebagai kegagalan pipanya.
# Semakin cepat yang dicari ketemu, semakin pasti ia dinyatakan tidak ada.
set +e
BACKUP_LIST="$(tar -tzf "$BACKUP_FILE" 2>/dev/null)"
set -e
BACKUP_ENTRIES="$(printf '%s\n' "$BACKUP_LIST" | grep -c . || true)"
if [ "${BACKUP_ENTRIES:-0}" -lt 100 ]; then
  echo "Backup hanya berisi ${BACKUP_ENTRIES:-0} entri - tidak masuk akal. Pemasangan dihentikan."
  exit 66
fi
# grep atas HERE-STRING, bukan atas pipa. Here-string bukan pipa, jadi
# pipefail tidak berlaku di sini dan berhentinya grep lebih awal tidak dapat
# merusak apa pun di hulunya.
for wajib in manajemen_surat aleta_bot scripts docker-compose.yml; do
  if ! grep -q -- "^${wajib}" <<<"$BACKUP_LIST"; then
    echo "Backup tidak memuat $wajib - tidak dapat dipakai memulihkan. Pemasangan dihentikan."
    exit 66
  fi
done

echo "Backup dibuat: $BACKUP_FILE ($BACKUP_ENTRIES entri)"
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

  # -------------------------------------------------------------------------
  # PENANDA COMMIT HARUS SAMPAI KE DALAM IMAGE
  # -------------------------------------------------------------------------
  #
  # Dockerfile portal menerima ARG ALETA_BUILD_REF dan menuliskannya ke
  # /app/BUILD-STAMP.txt. Skrip penaikan lalu membaca cap itu untuk MEMBUKTIKAN
  # bahwa yang berjalan di server benar-benar rujukan yang dikirim.
  #
  # Sebelum ini peubahnya diterima di sini lalu berhenti - tidak pernah
  # diteruskan sebagai --build-arg. Akibatnya cap build selalu berisi tanggal
  # saja, pembuktiannya selalu gagal, dan penaikan berhenti pada langkah
  # terakhir walau kodenya sudah naik dengan benar. Bersama kekeliruan pipefail
  # pada pemeriksaan bungkusan, itulah sebabnya penaikan lewat skrip ini tidak
  # pernah tuntas sekali pun.
  #
  # Larik dipakai supaya nilai bercelah tidak terpecah. Bentuk
  # ${ARR[@]+"${ARR[@]}"} dipakai karena bash 4.2 di server memperlakukan
  # larik kosong sebagai peubah tak terikat di bawah `set -u`.
  BUILD_ARGS=()
  if [ -n "${ALETA_BUILD_REF:-}" ]; then
    BUILD_ARGS+=(--build-arg "ALETA_BUILD_REF=$ALETA_BUILD_REF")
    echo "  penanda build: $ALETA_BUILD_REF"
  else
    echo "  penanda build tidak diberikan - cap build hanya akan memuat tanggal"
  fi

  # shellcheck disable=SC2086
  compose build ${BUILD_ARGS[@]+"${BUILD_ARGS[@]}"} $ALETA_UPDATE_SERVICES
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

# Cuplikan ukuran citra/build cache Docker untuk pemantau sumber daya (butir 3,
# 6 Okt 2026). Tidak pernah menggagalkan pembaruan.
if [ -f "$APP_DIR/scripts/aleta-sumber-daya-docker.sh" ]; then
  bash "$APP_DIR/scripts/aleta-sumber-daya-docker.sh" >/dev/null 2>&1 || echo "Catatan: cuplikan docker system df tidak tertulis."
fi

echo "Update ALETA berhasil."
echo "Versi sebelumnya : $CURRENT_VERSION"
echo "Versi sekarang   : $TARGET_VERSION"
echo "Rollback file    : $BACKUP_FILE"
