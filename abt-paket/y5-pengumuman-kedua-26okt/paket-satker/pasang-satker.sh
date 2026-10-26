#!/bin/bash
# =============================================================================
# PASANG paket ABT "y5-pengumuman-kedua-26okt" di SATKER (dijalankan DI SERVER, sebagai root, dari folder paket ini).
# BELUM dijalankan di mana pun (26 Okt 2026). Urutan: md5 paket -> prasyarat (isi lama persis) -> CADANG -> PASANG -> PERIKSA (gagal = pulih).
# Hanya satu baris abt_variabel (7063) yang diubah; tidak ada blangko (RTF) yang diubah.
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
CAD="$SINI/cadangan"
gagal() { echo "GAGAL: $*"; exit 1; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
export MYSQL_PWD
MY="mysql -h 127.0.0.1 -u root --default-character-set=latin1 aps_badilag"

P=$($MY -N -e "SELECT COUNT(*) FROM abt_variabel WHERE no_var = 7063 AND MD5(sql_query) = '66657b95ba227dbee045fbef8ab01c6e'") || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
if [ "$P" != "1" ]; then
  B=$($MY -N -e "SELECT COUNT(*) FROM abt_variabel WHERE no_var = 7063 AND MD5(sql_query) = '3a7efb779860a3f8d3259c635c70f575'")
  [ "$B" = "1" ] && gagal "variabel 7063 sudah berisi versi paket ini - tidak diulang"
  gagal "isi variabel 7063 bukan yang diukur 26 Okt (md5 66657b95ba227dbee045fbef8ab01c6e) - TIDAK ada yang diubah"
fi
echo "PRASYARAT COCOK (1)"

[ -e "$CAD/abt_variabel-7063-sebelum.sql" ] && gagal "cadangan lama sudah ada di $CAD - periksa dulu, jangan timpa"
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
mysqldump -h 127.0.0.1 -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
  --complete-insert --skip-comments --hex-blob --where="no_var = 7063" aps_badilag abt_variabel > "$CAD/abt_variabel-7063-sebelum.sql" || gagal "mysqldump gagal - TIDAK ada yang diubah"
[ "$(grep -c '^REPLACE' "$CAD/abt_variabel-7063-sebelum.sql")" = "1" ] || gagal "cadangan variabel 7063 tidak berisi tepat 1 baris"
echo "CADANGAN: $CAD/abt_variabel-7063-sebelum.sql (1 baris lama)"

$MY < abt-y5-pengumuman-kedua-26okt-PASANG.sql || gagal "PASANG berhenti (lihat galat di atas)"

$MY -N < abt-y5-pengumuman-kedua-26okt-PERIKSA.sql | tee "$CAD/periksa-sesudah.txt"
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  echo "PERIKSA tidak cocok - memulihkan"
  $MY < abt-y5-pengumuman-kedua-26okt-PULIH.sql
  gagal "pemasangan dibatalkan dan dipulihkan"
fi
echo "SELESAI - paket y5-pengumuman-kedua-26okt terpasang (variabel 7063). Cadangan: $CAD"
