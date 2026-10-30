#!/bin/bash
# PULIH paket ABT "abt-identitas-kosong-31okt": 11 variabel identitas dikembalikan persis (hanya baris yang masih persis hasil paket;
# suntingan sesudahnya dibiarkan), lalu fungsi isian_rtf_identitas_kosong dihapus. Baris terakhir harus "PULIH COCOK".
# Laptop: ABT_LOKAL=1 ABT_DB=<basis salinan> bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
N=abt-identitas-kosong-31okt
HARAP=$(sed -n 1p harap.txt | tr -d '\r')
ADB="${ABT_DB:-aps_badilag}"
BIN="${MYSQL_BIN:-}"; [ -n "$BIN" ] && BIN="$BIN/"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="${BIN}mysql -h $H -u root --default-character-set=latin1 $ADB"
$MY < "$N-PULIH.sql" || { echo "GAGAL: pulih variabel"; exit 1; }
n=$($MY -N -e "SELECT COUNT(*) FROM abt_variabel WHERE sql_query LIKE '%isian_rtf_identitas_kosong%'" | tr -d '\r')
if [ "$n" = "0" ]; then
  sed "s/aps_badilag\./$ADB./g" "$N-FUNGSI-PULIH.sql" | $MY || { echo "GAGAL: pulih fungsi"; exit 1; }
else
  echo "fungsi DIBIARKAN: masih dipakai $n variabel (disunting sesudah paket)"
fi
p=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r')
echo "PRASYARAT SESUDAH PULIH: $p"
[ "$p" = "$HARAP" ] && echo "PULIH COCOK" || { echo "PULIH TIDAK COCOK"; exit 1; }
