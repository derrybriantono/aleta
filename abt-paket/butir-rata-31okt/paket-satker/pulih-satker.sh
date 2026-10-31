#!/bin/bash
# PULIH paket ABT "abt-butir-rata-31okt": fungsi isian_rtf_butir dikembalikan ke isi LAMA HANYA bila isinya masih persis isi paket.
# Baris terakhir harus "PULIH COCOK". Laptop: ABT_LOKAL=1 ABT_DB=<salinan> MYSQL_BIN=<folder mysql.exe> bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
N=abt-butir-rata-31okt
ADB="${ABT_DB:-aps_badilag}"
BIN="${MYSQL_BIN:-}"; [ -n "$BIN" ] && BIN="$BIN/"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
MY="${BIN}mysql -h ${MYSQL_HOST:-127.0.0.1} -u root --default-character-set=latin1 $ADB"
p=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r')
if [ "$p" = "$(sed -n 2p harap.txt | tr -d '\r')" ]; then
  $MY < "$N-FUNGSI-LAMA.sql" || { echo "GAGAL: fungsi lama tidak bisa dibuat"; exit 1; }
fi
p=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r')
if [ "$p" = "$(sed -n 1p harap.txt | tr -d '\r')" ]; then echo "PULIH COCOK ($p)"; else echo "PULIH SEBAGIAN: fungsi sekarang '$p' (disunting orang, dibiarkan)"; exit 1; fi
