#!/bin/bash
# =============================================================================
# PASANG paket ABT "y1-kesimpulan-tanya-jawab-26okt" di SATKER (dijalankan DI SERVER, sebagai root, dari folder paket ini).
# BELUM dijalankan di mana pun (rancangan 26 Okt 2026). Urutan: prasyarat -> CADANG -> PASANG -> PERIKSA (gagal = hapus variabel baru).
# Hanya 4 baris abt_variabel yang ditambah; tidak ada blangko (RTF) yang diubah.
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
CAD="$SINI/cadangan"
gagal() { echo "GAGAL: $*"; exit 1; }

MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
export MYSQL_PWD
MY="mysql -h 127.0.0.1 -u root --default-character-set=latin1 aps_badilag"

[ -e "$CAD/abt_variabel-seluruhnya-sebelum.sql" ] && gagal "cadangan lama sudah ada di $CAD - paket ini sudah pernah dijalankan? Periksa dulu, jangan timpa cadangan"
N=$($MY -N -e "SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN 4950 AND 4959")
[ "$N" = "0" ] || gagal "jatah 4950-4959 sudah terpakai ($N baris) - TIDAK ada yang diubah"

mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
mysqldump -h 127.0.0.1 -u root --default-character-set=latin1 --no-create-info --replace --skip-extended-insert \
  --complete-insert --skip-comments aps_badilag abt_variabel > "$CAD/abt_variabel-seluruhnya-sebelum.sql" || gagal "mysqldump gagal - TIDAK ada yang diubah"
[ -s "$CAD/abt_variabel-seluruhnya-sebelum.sql" ] || gagal "cadangan abt_variabel kosong"
echo "CADANGAN: $CAD"

$MY < abt-y1-kesimpulan-tanya-jawab-26okt-PASANG.sql || gagal "PASANG berhenti (lihat galat di atas) - transaksi tidak di-COMMIT, tidak ada yang ditulis"

$MY < abt-y1-kesimpulan-tanya-jawab-26okt-PERIKSA.sql | tee "$CAD/periksa-sesudah.txt"
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  echo "PERIKSA tidak cocok - menghapus variabel baru"
  $MY < abt-y1-kesimpulan-tanya-jawab-26okt-PULIH-HAPUS-BARU.sql
  gagal "pemasangan dibatalkan dan dipulihkan"
fi
echo "SELESAI - paket y1-kesimpulan-tanya-jawab-26okt terpasang (4 variabel). Cadangan: $CAD"
