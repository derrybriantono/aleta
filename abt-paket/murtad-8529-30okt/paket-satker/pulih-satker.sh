#!/bin/bash
# PULIH paket ABT "abt-murtad-8529-30okt": 8529 dikembalikan persis seperti sebelum paket (md5 di PRASYARAT).
# Bila paket abt-alasan-belum-dipilih-30okt juga hendak dipulihkan: pulihkan paket INI lebih dulu.
# Baris terakhir harus "PULIH COCOK". Laptop: ABT_LOKAL=1 ABT_DB=<basis salinan> bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
N=abt-murtad-8529-30okt
HARAP=$(sed -n 1p harap.txt)
ADB="${ABT_DB:-aps_badilag}"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
$MY < "$N-PULIH.sql" || { echo "GAGAL: pulih"; exit 1; }
p=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r')
echo "PRASYARAT SESUDAH PULIH: $p"
[ "$p" = "$HARAP" ] && echo "PULIH COCOK" || { echo "PULIH TIDAK COCOK"; exit 1; }
