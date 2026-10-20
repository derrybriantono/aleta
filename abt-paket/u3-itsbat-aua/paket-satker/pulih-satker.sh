#!/bin/bash
# PULIH paket ABT "abt-u3-itsbat-aua" (deterministik): berkas baru dihapus HANYA bila md5-nya masih isi paket (yang sudah
# disunting dibiarkan dan dilaporkan), lalu variabel 4300-4399 dihapus HANYA bila nama, kueri, dan pilihannya masih isi paket.
# Baris terakhir harus "PULIH COCOK". Laptop: ABT_LOKAL=1 ABT_BLANGKO=<_blangko_abt> [ABT_DB=aps_badilag_uji] bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
ADB="${ABT_DB:-aps_badilag}"
PY="${PY:-python}"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
MY="mysql -h ${MYSQL_HOST:-127.0.0.1} -u root --default-character-set=latin1 $ADB"
$PY berkas_rtf.py pulih "$B" "$CAD" || echo "PERINGATAN: sebagian berkas tidak dipulihkan (lihat di atas)"
$MY -N < abt-u3-itsbat-aua-PULIH.sql || { echo "GAGAL: PULIH SQL berhenti"; exit 1; }
