#!/usr/bin/env bash
# ============================================================================
# ALETA - PENJAGA SERVER di HOST (1 Nov 2026, N4)
# ============================================================================
#
# Dipanggil oleh aleta-kapasitas-cron.sh (satu jadwal cron yang sama, tidak ada jadwal kedua). HANYA MENGUKUR
# dan MENGABARI. Tidak ada perintah yang membersihkan, menghapus, mengubah setelan, atau menghentikan/menyalakan
# apa pun. Satu-satunya yang ditulis: laporan JSON dan berkas penanda kecil di folder pertukaran.
#
# DUA KECEPATAN (supaya ringan):
#   cepat  tiap >= 2 menit : SATU permintaan curl (batas 5 detik) ke halaman masuk portal. Bila portal tidak
#          menjawab 2 kali berturut-turut (sekitar 4 menit), skrip ini sendiri menyuruh ALETA Bot mengabari Super
#          Admin lewat WhatsApp - karena bila portal mati, portal tidak bisa mengabari. Sekali per 6 jam, dan
#          satu kabar "pulih". Portal yang hidup menangani semua kabar lain.
#   penuh  tiap 10 menit   : df/df -i (milidetik), docker ps (batas 10 detik), sertifikat (openssl, hanya berkas
#          yang disebut), satu curl ABT bila ALETA_ABT_URL diisi. TIDAK ADA du/find/pemindaian berkas.
#
# KELUARAN (di $ALETA_KAPASITAS_DIR): penjaga-host.json (dibaca portal). MASUKAN: penjaga-penerima.json (ditulis
# portal: nomor Super Admin, mode 0600 - nomor tidak pernah dicetak ke log).
#
# TOKEN BOT dibaca dari ALETA_BOT_INTERNAL_API_TOKEN (lingkungan) atau baris itu di $APP_DIR/.env.production, dan
# diberikan ke curl lewat stdin (tidak tampil di daftar proses).
#
# Variabel (semua opsional): ALETA_APP_DIR, ALETA_DATA_DIR, ALETA_KAPASITAS_DIR, ALETA_PORTAL_URL
# (bawaan http://127.0.0.1:8008/aleta/login), ALETA_BOT_BASE_URL (bawaan http://127.0.0.1:3003), ALETA_ABT_URL
# (kosong = ABT tidak diperiksa), ALETA_CERT_FILES (daftar berkas sertifikat dipisah spasi; bawaan
# /etc/letsencrypt/live/*/fullchain.pem), ALETA_TMP_DIR (bawaan /home/aleta-tmp bila ada, kalau tidak /tmp),
# ALETA_KONTAINER_POLA (bawaan ^aleta-), ALETA_PENJAGA_PROBE_DETIK (120), ALETA_PENJAGA_INTERVAL_MENIT (10).
set -uo pipefail
export LC_ALL=C

APP_DIR="${ALETA_APP_DIR:-/var/www/html/aleta}"
DATA_DIR="${ALETA_DATA_DIR:-/var/www/html/aleta-data}"
DIR="${ALETA_KAPASITAS_DIR:-$DATA_DIR/reports/kapasitas}"
PORTAL_URL="${ALETA_PORTAL_URL:-http://127.0.0.1:8008/aleta/login}"
BOT_URL="${ALETA_BOT_BASE_URL:-http://127.0.0.1:3003}"
ABT_URL="${ALETA_ABT_URL:-}"
POLA_KONTAINER="${ALETA_KONTAINER_POLA:-^aleta-}"
JEDA_PROBE="${ALETA_PENJAGA_PROBE_DETIK:-120}"
INTERVAL_MENIT="${ALETA_PENJAGA_INTERVAL_MENIT:-10}"
JEDA_KABAR=21600

LAPORAN="$DIR/penjaga-host.json"
PENERIMA="$DIR/penjaga-penerima.json"
S_PROBE="$DIR/.penjaga-probe"
S_GAGAL="$DIR/.penjaga-portal-gagal"
S_MULAI="$DIR/.penjaga-portal-mulai"
S_KABAR="$DIR/.penjaga-portal-kabar"
S_PENUH="$DIR/.penjaga-penuh"
S_KODE="$DIR/.penjaga-portal-kode"

mkdir -p "$DIR" 2>/dev/null || exit 0
exec 8>"$DIR/.kunci-penjaga"
command -v flock >/dev/null 2>&1 && { flock -n 8 || exit 0; }

sekarang() { date +%s; }
iso_utc() { date -u +%Y-%m-%dT%H:%M:%SZ; }
umur_berkas() { if [ -e "$1" ]; then echo $(( $(sekarang) - $(stat -c %Y "$1") )); else echo 999999999; fi; }
baca_angka() { local v; v="$(cat "$1" 2>/dev/null | head -n 1)"; case "$v" in ''|*[!0-9]*) echo 0 ;; *) echo "$v" ;; esac; }
jam_wita() { date -u -d "@$(( $1 + 28800 ))" +%H.%M 2>/dev/null || echo "-"; }
js() { printf '%s' "$1" | tr -d '"\\' | tr -d '\000-\037'; }
angka_atau_null() { case "$1" in ''|*[!0-9]*) echo null ;; *) echo "$1" ;; esac; }
log() { echo "$(iso_utc) penjaga: $*"; }

# ------------------------------------------------------------- kabar via bot
token_bot() {
  local t="${ALETA_BOT_INTERNAL_API_TOKEN:-}"
  if [ -z "$t" ] && [ -f "$APP_DIR/.env.production" ]; then
    t="$(grep -E '^(ALETA_BOT_INTERNAL_API_TOKEN|ALETA_BOT_INTERNAL_TOKEN)=' "$APP_DIR/.env.production" 2>/dev/null | head -n 1 | cut -d= -f2- | tr -d '"'"'"'\r')"
  fi
  printf '%s' "$t"
}

# kirim_bot "pesan (tanpa tanda kutip; \n = baris baru)" kunci -> 0 bila minimal satu penerima berhasil diantrekan
kirim_bot() {
  local pesan="$1" kunci="$2" token nomor kode ok=0 badan
  [ -f "$PENERIMA" ] || { log "kabar WhatsApp dilewati: belum ada daftar penerima dari portal"; return 1; }
  grep -Eq '"merahAktif"[[:space:]]*:[[:space:]]*false' "$PENERIMA" && { log "kabar merah dimatikan di pengaturan - dilewati"; return 1; }
  token="$(token_bot)"
  badan="$(mktemp "$DIR/.penjaga-badan.XXXXXX")" || return 1
  chmod 600 "$badan"
  for nomor in $(grep -o '"nomor":"[0-9]\{8,16\}"' "$PENERIMA" | sed 's/[^0-9]//g' | head -n 10); do
    printf '{"sourceApp":"aleta_bot_gateway","sourceFeature":"penjaga_server_host","entityType":"penjaga","entityId":"%s","recipientNumber":"%s","recipientName":"Super Admin","message":"%s","category":"employee","priority":2,"processImmediately":true}' \
      "$kunci" "$nomor" "$pesan" > "$badan"
    kode="$(printf 'header = "x-aleta-internal-token: %s"\n' "$token" | curl -s -m 10 -o /dev/null -w '%{http_code}' -K - -H 'content-type: application/json' --data-binary "@$badan" "$BOT_URL/internal/aleta-bot/messages/enqueue" 2>/dev/null)"
    case "$kode" in 2??) ok=1 ;; esac
  done
  rm -f "$badan"
  if [ "$ok" -eq 1 ]; then log "kabar WhatsApp diantrekan"; return 0; fi
  log "kabar WhatsApp belum terkirim (bot tidak menjawab atau menolak)"
  return 1
}

# ----------------------------------------------------------- pemeriksaan cepat
periksa_portal() {
  local kode now gagal mulai kabar
  now="$(sekarang)"
  kode="$(curl -s -m 5 -o /dev/null -w '%{http_code}' "$PORTAL_URL" 2>/dev/null)"
  case "$kode" in ''|*[!0-9]*) kode=0 ;; esac
  kode=$(( 10#$kode ))
  printf '%s\n' "$kode" > "$S_KODE"
  echo "$now" > "$S_PROBE"
  gagal="$(baca_angka "$S_GAGAL")"
  if [ "$kode" -ge 100 ] && [ "$kode" -lt 500 ]; then
    # Menjawab (200-499 = hidup; 404 berarti alamatnya salah, bukan portal mati).
    if [ "$gagal" -ge 2 ] && [ -e "$S_KABAR" ]; then
      mulai="$(baca_angka "$S_MULAI")"
      kirim_bot "Penjaga server - sudah pulih\\n\\nKabar baik: portal ALETA sudah bisa dibuka lagi (mati sekitar $(( (now - mulai) / 60 )) menit, mulai $(jam_wita "$mulai") WITA)." "penjaga-portal-pulih-$now" || true
      rm -f "$S_KABAR"
    fi
    echo 0 > "$S_GAGAL"
    rm -f "$S_MULAI"
    return 0
  fi
  [ "$gagal" -eq 0 ] && echo "$now" > "$S_MULAI"
  gagal=$(( gagal + 1 ))
  echo "$gagal" > "$S_GAGAL"
  if [ "$gagal" -ge 2 ]; then
    kabar=999999999
    [ -e "$S_KABAR" ] && kabar="$(umur_berkas "$S_KABAR")"
    if [ "$kabar" -ge "$JEDA_KABAR" ]; then
      mulai="$(baca_angka "$S_MULAI")"
      if kirim_bot "Penjaga server - PERLU DITANGANI\\n\\nPortal ALETA tidak menjawab sejak $(jam_wita "$mulai") WITA. Pengguna tidak bisa membuka ALETA. Mohon dicek servernya (mungkin layanan berhenti atau server mati). Kabar pulih akan menyusul bila sudah normal." "penjaga-portal-mati-$now"; then
        touch "$S_KABAR"
      fi
    fi
  fi
  return 0
}

# --------------------------------------------------------- pemeriksaan penuh
daftar_inode() {
  df -Pi -x tmpfs -x devtmpfs -x overlay -x squashfs 2>/dev/null | awk 'NR>1 && $1 ~ /^\// && $6 ~ /^\// && $5 ~ /%$/ && !seen[$6]++ {
    p=$5; sub(/%/, "", p); gsub(/["\\]/, "", $6)
    printf "%s{\"titik\":\"%s\",\"persen\":%d}", (n++ ? "," : ""), $6, p
  }'
}

blok_temp() {
  local t="${ALETA_TMP_DIR:-}" baris titik pakai total sisa persen
  [ -n "$t" ] || { [ -d /home/aleta-tmp ] && t=/home/aleta-tmp || t=/tmp; }
  [ -d "$t" ] || { echo null; return 0; }
  baris="$(df -P -B1 "$t" 2>/dev/null | awk 'NR==2 { print $2 "|" $3 "|" $4 "|" $6 }')"
  IFS='|' read -r total pakai sisa titik <<< "$baris"
  case "$total" in ''|*[!0-9]*) echo null; return 0 ;; esac
  [ "$total" -gt 0 ] || { echo null; return 0; }
  persen=$(( pakai * 100 / total ))
  printf '{"jalur":"%s","titik":"%s","persen":%d,"sisaByte":%s}' "$(js "$t")" "$(js "$titik")" "$persen" "$(angka_atau_null "$sisa")"
}

blok_sertifikat() {
  local f hasil="" n=0 akhir ts hari nama
  command -v openssl >/dev/null 2>&1 || { echo ""; return 0; }
  # shellcheck disable=SC2086
  for f in ${ALETA_CERT_FILES:-/etc/letsencrypt/live/*/fullchain.pem}; do
    [ -f "$f" ] || continue
    akhir="$(timeout 5 openssl x509 -enddate -noout -in "$f" 2>/dev/null | sed 's/^notAfter=//')"
    [ -n "$akhir" ] || continue
    ts="$(date -d "$akhir" +%s 2>/dev/null)" || continue
    hari=$(( (ts - $(sekarang)) / 86400 ))
    [ "$ts" -lt "$(sekarang)" ] && hari=$(( (ts - $(sekarang) - 86399) / 86400 ))
    nama="$(basename "$(dirname "$f")")"
    [ "$nama" = "." ] && nama="$(basename "$f")"
    [ "$n" -gt 0 ] && hasil="${hasil},"
    hasil="${hasil}{\"nama\":\"$(js "$nama")\",\"hariTersisa\":$hari}"
    n=$(( n + 1 ))
    [ "$n" -ge 20 ] && break
  done
  printf '%s' "$hasil"
}

blok_kontainer() {
  command -v docker >/dev/null 2>&1 || { echo ""; return 0; }
  local baris nama keadaan status sehat hasil="" n=0
  baris="$(timeout 10 docker ps -a --format '{{.Names}}|{{.State}}|{{.Status}}' 2>/dev/null)" || { echo ""; return 0; }
  while IFS='|' read -r nama keadaan status; do
    [ -n "$nama" ] || continue
    echo "$nama" | grep -Eq "$POLA_KONTAINER" || continue
    sehat=""
    case "$status" in *"(unhealthy)"*) sehat="unhealthy" ;; *"(healthy)"*) sehat="healthy" ;; esac
    [ "$n" -gt 0 ] && hasil="${hasil},"
    hasil="${hasil}{\"nama\":\"$(js "$nama")\",\"keadaan\":\"$(js "$keadaan")\",\"sehat\":\"$sehat\"}"
    n=$(( n + 1 ))
  done <<< "$baris"
  printf '%s' "$hasil"
}

blok_abt() {
  [ -n "$ABT_URL" ] || { echo null; return 0; }
  local kode
  kode="$(curl -s -m 5 -o /dev/null -w '%{http_code}' "$ABT_URL" 2>/dev/null)"
  case "$kode" in ''|*[!0-9]*) kode=0 ;; esac
  printf '{"kode":%d}' "$(( 10#$kode ))"
}

tulis_laporan() {
  local sem kode
  sem="$(mktemp "$DIR/.penjaga-host.XXXXXX")" || return 1
  kode="$(cat "$S_KODE" 2>/dev/null | head -n 1)"
  case "$kode" in ''|*[!0-9]*) kode="" ;; esac
  {
    printf '{"versi":1,"dibuat":"%s","intervalMenit":%s,"inode":[%s],"temp":%s,"sertifikat":[%s],"kontainer":[%s],"abtWeb":%s,"portal":%s}\n' \
      "$(iso_utc)" "$INTERVAL_MENIT" "$(daftar_inode)" "$(blok_temp)" "$(blok_sertifikat)" "$(blok_kontainer)" "$(blok_abt)" \
      "$([ -n "$kode" ] && printf '{"kode":%s}' "$kode" || echo null)"
  } > "$sem"
  chmod 0644 "$sem"
  mv -f "$sem" "$LAPORAN"
}

# ------------------------------------------------------------------- jalan
if [ "$(umur_berkas "$S_PROBE")" -ge "$JEDA_PROBE" ]; then
  periksa_portal
fi
if [ "${1:-}" = "--paksa" ] || [ "$(umur_berkas "$S_PENUH")" -ge $(( INTERVAL_MENIT * 60 - 30 )) ] || [ ! -e "$LAPORAN" ]; then
  tulis_laporan && touch "$S_PENUH"
fi
exit 0
