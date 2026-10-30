#!/usr/bin/env bash
# ============================================================================
# ALETA - pemantau kapasitas penyimpanan di HOST (cron, 30 Okt 2026)
# ============================================================================
#
# KENAPA DI HOST: portal dan bot berjalan di container tanpa soket Docker
# (sengaja - soket Docker = akses root ke server). Ruang yang sebenarnya
# (partisi data root Docker, Postgres, cache build) hanya terlihat dari host.
# Skrip ini berjalan sebagai root lewat cron, MENULIS laporan JSON ke folder
# bersama (volume reports yang sudah dipasang ke container portal), dan MEMBACA
# dua berkas kecil yang ditulis portal:
#
#   setelan-host.json   hasil pengaturan Super Admin: ambang kuning/merah,
#                       saklar pembersihan otomatis (MATI bawaan), umur cache
#   minta-periksa.json  pemicu tombol "Periksa sekarang" (dihapus sesudah dipakai)
#
# KELUARAN (di $ALETA_KAPASITAS_DIR, bawaan /var/www/html/aleta-data/reports/kapasitas):
#   laporan.json          ukuran dan persen tiap bagian (dibaca portal)
#   riwayat-bersih.jsonl  satu baris JSON per pembersihan otomatis (dibaca portal -> audit)
#
# PEMBERSIHAN OTOMATIS - satu-satunya perintah yang mengubah sesuatu:
#   docker builder prune --filter until=<umur>h -f
#   dijalankan HANYA bila (a) saklar di pengaturan dinyalakan Super Admin - itu
#   dianggap izin tetap - DAN (b) partisi data root Docker sudah di atas ambang
#   merah, dan tidak lebih sering dari sekali tiap 6 jam. Yang dibuang hanya
#   cache build yang lebih tua dari umur itu; citra yang dipakai kontainer,
#   volume, dan database TIDAK tersentuh. Isi berkas setelan HANYA dibaca
#   sebagai angka dan benar/salah - tidak pernah dijalankan sebagai perintah.
#
# PASANG (dilakukan pengguna sendiri, sebagai root):
#   chmod +x /var/www/html/aleta/scripts/kapasitas/aleta-kapasitas-cron.sh
#   echo '* * * * * root /var/www/html/aleta/scripts/kapasitas/aleta-kapasitas-cron.sh >> /var/log/aleta-kapasitas.log 2>&1' \
#     > /etc/cron.d/aleta-kapasitas
# Tiap menit ia hanya memeriksa pemicu (murah); pengukuran penuh tiap 10 menit
# atau segera bila tombol "Periksa sekarang" ditekan. Satu proses sekaligus
# (flock). `--paksa` mengukur sekarang tanpa menunggu.
set -uo pipefail
export LC_ALL=C

APP_DIR="${ALETA_APP_DIR:-/var/www/html/aleta}"
DATA_DIR="${ALETA_DATA_DIR:-/var/www/html/aleta-data}"
DIR="${ALETA_KAPASITAS_DIR:-$DATA_DIR/reports/kapasitas}"
INTERVAL_MENIT="${ALETA_KAPASITAS_INTERVAL_MENIT:-10}"
JEDA_BERSIH_DETIK="${ALETA_KAPASITAS_JEDA_BERSIH_DETIK:-21600}"
UKURAN_DOCKER_TTL="${ALETA_KAPASITAS_UKURAN_DOCKER_TTL:-86400}"
BACKUP_ROOT_1="${ALETA_BACKUP_ROOT:-$(dirname "$APP_DIR")/aleta-backups}"
BACKUP_ROOT_2="$(dirname "$APP_DIR")/aleta-backup"

LAPORAN="$DIR/laporan.json"
SETELAN="$DIR/setelan-host.json"
MINTA="$DIR/minta-periksa.json"
RIWAYAT="$DIR/riwayat-bersih.jsonl"
TANDA_BERSIH="$DIR/.bersih-terakhir"
CACHE_DOCKER="$DIR/.ukuran-docker.cache"

mkdir -p "$DIR" 2>/dev/null || exit 1
# Container portal menulis setelan-host.json/minta-periksa.json di folder ini.
chmod 0777 "$DIR" 2>/dev/null || true

exec 9>"$DIR/.kunci"
command -v flock >/dev/null 2>&1 && { flock -n 9 || exit 0; }

PAKSA=0
[ "${1:-}" = "--paksa" ] && PAKSA=1

sekarang() { date +%s; }
iso_utc() { date -u +%Y-%m-%dT%H:%M:%SZ; }
umur_berkas() { # detik sejak berkas diubah; 999999999 bila tidak ada
  if [ -e "$1" ]; then echo $(( $(sekarang) - $(stat -c %Y "$1") )); else echo 999999999; fi
}

if [ "$PAKSA" -eq 0 ] && [ ! -e "$MINTA" ] && [ "$(umur_berkas "$LAPORAN")" -lt $(( INTERVAL_MENIT * 60 - 30 )) ]; then
  exit 0
fi

# ----------------------------------------------------------------- setelan
# Hanya angka dan true/false yang diambil; nilai lain -> bawaan yang aman.
angka_setelan() { # kunci bawaan min maks
  local v
  v="$(sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\([0-9]\{1,4\}\).*/\1/p" "$SETELAN" 2>/dev/null | head -n 1)"
  if [ -n "$v" ] && [ "$v" -ge "$3" ] && [ "$v" -le "$4" ]; then echo "$v"; else echo "$2"; fi
}
OTO=false
if [ -f "$SETELAN" ] && grep -Eq '"pembersihanOtomatis"[[:space:]]*:[[:space:]]*true' "$SETELAN"; then OTO=true; fi
AMBANG_KUNING="$(angka_setelan ambangKuning 80 50 95)"
AMBANG_MERAH="$(angka_setelan ambangMerah 90 60 99)"
UMUR_JAM="$(angka_setelan umurCacheJam 72 24 720)"
[ "$AMBANG_MERAH" -gt "$AMBANG_KUNING" ] || { AMBANG_KUNING=80; AMBANG_MERAH=90; }

# ------------------------------------------------------------ letak data
DOCKER_ROOT="$(timeout 20 docker info --format '{{.DockerRootDir}}' 2>/dev/null || true)"
[ -n "$DOCKER_ROOT" ] || DOCKER_ROOT="/var/lib/docker"

jalur_postgres() {
  local f hasil
  for f in "$APP_DIR/docker-compose.override.yml" "$APP_DIR/docker-compose.yml"; do
    [ -f "$f" ] || continue
    hasil="$(sed -n 's/^[[:space:]]*-[[:space:]]*["'"'"']\{0,1\}\([^:"'"'"' ]*\):\/var\/lib\/postgresql\/data.*/\1/p' "$f" | head -n 1)"
    if [ -n "$hasil" ]; then echo "$hasil"; return 0; fi
  done
  echo "/home/aleta-data/postgres"
}
PG_DIR="$(jalur_postgres)"

# --------------------------------------------------------------- ukuran
js() { printf '%s' "$1" | tr -d '"\\' | tr -d '\000-\037'; }
angka_atau_null() { case "$1" in ''|*[!0-9]*) echo null ;; *) echo "$1" ;; esac; }

ukur_dir() { # satu atau lebih jalur; jumlah byte atau "" bila gagal/habis waktu
  local total=0 j b ada=0
  for j in "$@"; do
    [ -d "$j" ] || continue
    ada=1
    b="$(timeout 120 du -sxb "$j" 2>/dev/null | awk '{ print $1 }')"
    case "$b" in ''|*[!0-9]*) return 0 ;; esac
    total=$(( total + b ))
  done
  [ "$ada" -eq 1 ] && echo "$total"
  return 0
}

ukuran_docker_root() { # du berat: sehari sekali
  if [ -f "$CACHE_DOCKER" ] && [ "$(umur_berkas "$CACHE_DOCKER")" -lt "$UKURAN_DOCKER_TTL" ] \
     && [ "$(cut -d'|' -f1 "$CACHE_DOCKER")" = "$DOCKER_ROOT" ]; then
    cut -d'|' -f2 "$CACHE_DOCKER"
    return 0
  fi
  local b
  b="$(timeout 900 nice -n 19 du -sxb "$DOCKER_ROOT" 2>/dev/null | awk '{ print $1 }')"
  case "$b" in ''|*[!0-9]*) return 0 ;; esac
  printf '%s|%s\n' "$DOCKER_ROOT" "$b" > "$CACHE_DOCKER"
  echo "$b"
}

# Satu entri "jalur": df atas jalur lalu ukuran (bila ada).
entri_jalur() { # kunci nama ukuran jalur...
  local kunci="$1" nama="$2" ukuran="$3" j="$4" tes="$4" baris dev total pakai sisa titik
  while [ ! -e "$tes" ] && [ "$tes" != "/" ]; do tes="$(dirname "$tes")"; done
  baris="$(df -P -B1 "$tes" 2>/dev/null | awk 'NR==2 { print $1 "|" $2 "|" $3 "|" $4 "|" $6 }')"
  IFS='|' read -r dev total pakai sisa titik <<< "$baris"
  printf '{"kunci":"%s","nama":"%s","jalur":"%s","titik":"%s","perangkat":"%s","totalByte":%s,"terpakaiByte":%s,"sisaByte":%s,"ukuranByte":%s}' \
    "$(js "$kunci")" "$(js "$nama")" "$(js "$j")" "$(js "${titik:-}")" "$(js "${dev:-}")" \
    "$(angka_atau_null "${total:-}")" "$(angka_atau_null "${pakai:-}")" "$(angka_atau_null "${sisa:-}")" "$(angka_atau_null "$ukuran")"
}

# "30.3GB" / "512kB" / "0B" (desimal, seperti docker) -> byte.
ke_byte() {
  awk -v t="$1" 'BEGIN {
    if (match(t, /^[0-9.]+/) == 0) { print ""; exit }
    n = substr(t, RSTART, RLENGTH) + 0; u = substr(t, RSTART + RLENGTH)
    sub(/[ (].*$/, "", u)
    m = 1
    if (u == "kB" || u == "KB") m = 1000
    else if (u == "MB") m = 1000000
    else if (u == "GB") m = 1000000000
    else if (u == "TB") m = 1000000000000
    else if (u != "B" && u != "") { print ""; exit }
    printf "%d", n * m
  }'
}

blok_docker() {
  command -v docker >/dev/null 2>&1 || { echo null; return 0; }
  local df tipe ukuran bisa citra="" kontainer="" volume="" cache="" cache_bisa=""
  df="$(timeout 90 docker system df --format '{{.Type}}|{{.Size}}|{{.Reclaimable}}' 2>/dev/null)" || { echo null; return 0; }
  [ -n "$df" ] || { echo null; return 0; }
  while IFS='|' read -r tipe ukuran bisa; do
    case "$tipe" in
      Images) citra="$(ke_byte "$ukuran")" ;;
      Containers) kontainer="$(ke_byte "$ukuran")" ;;
      "Local Volumes") volume="$(ke_byte "$ukuran")" ;;
      "Build Cache") cache="$(ke_byte "$ukuran")"; cache_bisa="$(ke_byte "$bisa")" ;;
    esac
  done <<< "$df"
  printf '{"citraByte":%s,"kontainerByte":%s,"volumeByte":%s,"cacheBuildByte":%s,"cacheBuildBisaDibersihkanByte":%s}' \
    "$(angka_atau_null "$citra")" "$(angka_atau_null "$kontainer")" "$(angka_atau_null "$volume")" \
    "$(angka_atau_null "$cache")" "$(angka_atau_null "$cache_bisa")"
}

blok_partisi() {
  df -P -B1 -x tmpfs -x devtmpfs -x overlay -x squashfs 2>/dev/null | awk 'NR>1 && $1 ~ /^\// && !seen[$1]++ {
    gsub(/["\\]/, "", $1); gsub(/["\\]/, "", $6)
    printf "%s{\"perangkat\":\"%s\",\"titik\":\"%s\",\"totalByte\":%d,\"terpakaiByte\":%d,\"sisaByte\":%d}", (n++ ? "," : ""), $1, $6, $2, $3, $4
  }'
}

tulis_laporan() {
  local sem u_pg u_ecourt u_unggah u_cad u_dock terakhir
  u_pg="$(ukur_dir "$PG_DIR")"
  u_ecourt="$(ukur_dir "$DATA_DIR/ecourt-docs")"
  u_unggah="$(ukur_dir "$DATA_DIR/uploads" /var/www/html/aleta-pdf)"
  u_cad="$(ukur_dir "$BACKUP_ROOT_1" "$BACKUP_ROOT_2")"
  u_dock="$(ukuran_docker_root)"
  terakhir="null"
  if [ -f "$TANDA_BERSIH" ]; then terakhir="\"$(date -u -d "@$(stat -c %Y "$TANDA_BERSIH")" +%Y-%m-%dT%H:%M:%SZ)\""; fi
  sem="$(mktemp "$DIR/.laporan.XXXXXX")" || return 1
  {
    printf '{"versi":1,"dibuat":"%s","intervalMenit":%s,"dockerRoot":"%s","postgresDir":"%s","jalur":[' \
      "$(iso_utc)" "$INTERVAL_MENIT" "$(js "$DOCKER_ROOT")" "$(js "$PG_DIR")"
    entri_jalur docker "Data Docker" "$u_dock" "$DOCKER_ROOT"; printf ','
    entri_jalur aleta-data "Data ALETA" "" "$DATA_DIR"; printf ','
    entri_jalur postgres "Database Postgres" "$u_pg" "$PG_DIR"; printf ','
    entri_jalur ecourt "Arsip e-Court" "$u_ecourt" "$DATA_DIR/ecourt-docs"; printf ','
    entri_jalur unggahan "Unggahan dan PDF" "$u_unggah" "$DATA_DIR/uploads"; printf ','
    entri_jalur cadangan "Cadangan" "$u_cad" "$BACKUP_ROOT_1"
    printf '],"partisi":[%s],"docker":%s,"pembersihan":{"terakhir":%s}}\n' "$(blok_partisi)" "$(blok_docker)" "$terakhir"
  } > "$sem"
  chmod 0644 "$sem"
  mv -f "$sem" "$LAPORAN"
}

# Persen terpakai partisi data root Docker (satu desimal dikali 10, bilangan bulat).
persen_mil_docker() {
  df -P -B1 "$DOCKER_ROOT" 2>/dev/null | awk 'NR==2 && $2 > 0 { printf "%d", $3 * 1000 / $2 }'
}
terpakai_docker() { df -P -B1 "$DOCKER_ROOT" 2>/dev/null | awk 'NR==2 { print $3 }'; }

bersih_otomatis() {
  [ "$OTO" = "true" ] || return 0
  command -v docker >/dev/null 2>&1 || return 0
  local mil sebelum sesudah kode keluaran bebas ts
  mil="$(persen_mil_docker)"
  [ -n "$mil" ] || return 0
  [ "$mil" -ge $(( AMBANG_MERAH * 10 )) ] || return 0
  if [ -f "$TANDA_BERSIH" ] && [ "$(umur_berkas "$TANDA_BERSIH")" -lt "$JEDA_BERSIH_DETIK" ]; then
    echo "$(iso_utc) partisi $((mil / 10)),$((mil % 10))% >= ambang merah, tetapi pembersihan terakhir kurang dari $((JEDA_BERSIH_DETIK / 3600)) jam lalu - dilewati"
    return 0
  fi
  sebelum="$(terpakai_docker)"
  echo "$(iso_utc) membersihkan cache build > ${UMUR_JAM} jam (partisi $((mil / 10)),$((mil % 10))% >= $AMBANG_MERAH%)"
  keluaran="$(timeout 3600 docker builder prune --filter "until=${UMUR_JAM}h" -f 2>&1)"; kode=$?
  touch "$TANDA_BERSIH"
  sesudah="$(terpakai_docker)"
  bebas=0
  if [ -n "$sebelum" ] && [ -n "$sesudah" ] && [ "$sebelum" -gt "$sesudah" ]; then bebas=$(( sebelum - sesudah )); fi
  ts="$(iso_utc)"
  printf '{"pada":"%s","sebabPersen":%s.%s,"ambangMerah":%s,"umurJam":%s,"dibebaskanByte":%s,"kode":%s,"perintah":"docker builder prune --filter until=%sh -f"}\n' \
    "$ts" "$((mil / 10))" "$((mil % 10))" "$AMBANG_MERAH" "$UMUR_JAM" "$bebas" "$kode" "$UMUR_JAM" >> "$RIWAYAT"
  chmod 0644 "$RIWAYAT" 2>/dev/null || true
  echo "$keluaran" | tail -n 3
  echo "$ts kode $kode, dibebaskan ${bebas} byte"
  return 0
}

tulis_laporan || { echo "$(iso_utc) laporan gagal ditulis" >&2; exit 1; }
rm -f "$MINTA"
if [ "$OTO" = "true" ]; then
  bersih_otomatis
  [ -f "$TANDA_BERSIH" ] && [ "$(umur_berkas "$TANDA_BERSIH")" -lt 120 ] && tulis_laporan
fi
exit 0
