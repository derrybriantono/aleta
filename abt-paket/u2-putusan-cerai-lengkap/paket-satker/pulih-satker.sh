#!/bin/bash
# PULIH paket u2-putusan-cerai-lengkap di SATKER: kembalikan blangko RTF dari cadangan lalu hapus variabel 4100-4150.
set -u
cd "$(dirname "$0")" || exit 1
CAD="$(pwd)/cadangan"
B=/var/www/html/aps_badilag/_blangko_abt/derry_briantono
MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)"; export MYSQL_PWD
MY="mysql -h 127.0.0.1 -u root --default-character-set=latin1 aps_badilag"
perl tambal-rtf.pl pulih "$B" "$CAD" | tail -n 3
$MY < abt-u2-PULIH.sql || { echo "GAGAL menghapus variabel baru"; exit 1; }
rm -f "$CAD/pasang.selesai"
echo "SELESAI - dipulihkan"
