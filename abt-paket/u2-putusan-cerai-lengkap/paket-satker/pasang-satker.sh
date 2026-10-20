#!/bin/bash
# =============================================================================
# PASANG paket ABT "u2-putusan-cerai-lengkap" di SATKER (dijalankan DI SERVER, sebagai root, dari folder paket ini).
# Urutan: periksa berkas -> prasyarat SQL -> PASANG variabel -> PERIKSA -> tambal blangko RTF (per jangkar, dengan cadangan) -> periksa.
# Bila PERIKSA SQL gagal: PULIH otomatis. Blangko yang jangkarnya tidak cocok DILEWATI (tidak ditimpa) dan dilaporkan.
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
B=/var/www/html/aps_badilag/_blangko_abt/derry_briantono
CAD="$SINI/cadangan"
gagal() { echo "GAGAL: $*"; exit 1; }
md5() { md5sum "$1" | cut -d' ' -f1; }
md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "berkas paket rusak (md5sum -c MD5SUMS.txt) - salin ulang dengan scp, bukan editor"
MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
export MYSQL_PWD
MY="mysql -h 127.0.0.1 -u root --default-character-set=latin1 aps_badilag"
[ -e "$CAD/pasang.selesai" ] && gagal "paket ini sudah pernah dipasang ($CAD) - jalankan pulih-satker.sh dulu bila ingin mengulang"
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"

echo "== 0. praperiksa tambalan RTF (tidak menulis apa pun)"
perl tambal-rtf.pl periksa "$B" "$CAD" | tail -n 5

echo "== 1. PASANG variabel 4100-4150 (prasyarat di dalam SQL; gagal = tidak ada yang ditulis)"
$MY < abt-u2-PASANG.sql || gagal "abt-u2-PASANG.sql berhenti (lihat galat di atas) - transaksi tidak di-COMMIT"

echo "== 2. PERIKSA panjang + MD5 tiap variabel"
$MY < abt-u2-PERIKSA.sql | tee "$CAD/periksa-sesudah.txt"
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  echo "PERIKSA tidak cocok - memulihkan"
  $MY < abt-u2-PULIH.sql
  gagal "pemasangan variabel dibatalkan dan dipulihkan; blangko RTF belum disentuh"
fi

echo "== 3. tambal blangko RTF"
perl tambal-rtf.pl pasang "$B" "$CAD" | tee "$CAD/tambal-hasil.txt" | tail -n 8
echo "== 4. periksa ulang (semua yang ditambal harus SUDAH)"
perl tambal-rtf.pl periksa "$B" "$CAD" | tail -n 3
touch "$CAD/pasang.selesai"
echo "SELESAI - paket u2-putusan-cerai-lengkap terpasang. Cadangan untuk pulih: $CAD"
