#!/bin/bash
# PULIH paket ABT "abt-prodeo-8507-5nov" (5 Nov 2026): rumus 8507 dikembalikan persis rumus lama HANYA bila masih persis rumus paket (rumus yang sudah diubah orang
# dibiarkan dan dilaporkan). Kolom modified tidak berubah saat pasang maupun pulih. Baris terakhir harus "PULIH COCOK".
# Laptop: ABT_LOKAL=1 ABT_DB=<basis ABT uji> bash pulih-satker.sh  (mysql lewat PATH)
set -u
cd "$(dirname "$0")" || exit 1
N=abt-prodeo-8507-5nov
ADB="${ABT_DB:-aps_badilag}"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
$MY -N < "$N-PULIH.sql" | tr -d '\r' || { echo "GAGAL: PULIH SQL berhenti"; exit 1; }
p=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r')
if [ "$p" = "$(sed -n 1p harap.txt | tr -d '\r')" ]; then echo "PULIH COCOK ($p)"; else echo "PULIH SEBAGIAN: prasyarat sekarang '$p' (rumus sudah diubah orang, dibiarkan)"; exit 1; fi
