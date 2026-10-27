#!/bin/bash
# PULIH paket ABT "abt-pihak-urut-sisa-28okt" (28 Okt 2026) - deterministik:
#  * baris yang DIUBAH dikembalikan dari cadangan/abt_variabel-sebelum.sql HANYA bila isinya masih isi BARU paket dan baris cadangan masih isi LAMA yang diharapkan;
#  * fungsi isian_rtf_pihak_peringkat (komentar "PS:") dihapus SESUDAH itu dan HANYA bila tak ada variabel yang masih memanggilnya.
# Jalankan PULIH ini SEBELUM pulih paket abt-pihak-urut-ecourt-27okt (paket ini bergantung padanya). Baris terakhir harus "PULIH COCOK".
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_ps1 SIPP_DB=sipp_donggala bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-pihak-urut-sisa-28okt
CAD="$SINI/cadangan"
ADB="${ABT_DB:-aps_badilag}"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
myn() { $MY -N "$@" | tr -d '\r'; }
mkdir -p "$CAD"
# 1. variabel
{
  echo "CREATE TEMPORARY TABLE pu_lama LIKE abt_variabel;"
  [ -f "$CAD/abt_variabel-sebelum.sql" ] && grep '^REPLACE' "$CAD/abt_variabel-sebelum.sql" | sed 's/^REPLACE INTO `abt_variabel`/REPLACE INTO pu_lama/'
  cat "$N-PULIH.sql"
} | $MY -N | tr -d '\r' || { echo "GAGAL: PULIH SQL berhenti"; exit 1; }
# 2. fungsi baru (komentar "PS:") hanya bila tidak ada variabel yang masih memanggil
pakai=$(myn -e "SELECT COUNT(*) FROM abt_variabel WHERE sql_query LIKE '%isian\_rtf\_pihak\_peringkat%'")
if [ "$pakai" = 0 ]; then
  for f in $(myn -e "SELECT routine_name FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_comment LIKE 'PS:%'"); do
    $MY -e "DROP FUNCTION IF EXISTS $f" && echo "FUNGSI DIHAPUS $f"
  done
else
  echo "PERINGATAN: fungsi paket masih dipanggil $pakai variabel - fungsi PS dibiarkan"
fi
sisa=$(myn -e "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_comment LIKE 'PS:%'")
if [ "$sisa" = 0 ] && [ "$pakai" = 0 ]; then echo "PULIH COCOK"; else echo "PULIH TIDAK LENGKAP - fungsi PS tersisa $sisa, variabel yang masih memanggil fungsi $pakai"; fi
