#!/bin/bash
# PULIH paket ABT "abt-tanya-jawab-format-1nov" (1 Nov 2026, agen M) - deterministik, TANPA hapus permanen:
#   - berkas RTF yang ditambal paket ini dikembalikan dari cadangan HANYA bila isinya masih persis isi paket;
#   - #5404# dikembalikan ke kueri dasar HANYA bila masih persis isi paket; (yang sudah disunting orang dibiarkan dan dilaporkan). Baris terakhir harus "PULIH COCOK".
# Pulihkan paket ini SEBELUM paket sebelumnya (bas-lanjutan-1nov).
# Laptop: ABT_LOKAL=1 ABT_DB=<basis ABT uji> ABT_BLANGKO=<_blangko_abt uji> MYSQL_BIN=<folder mysql.exe> PY=python bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-tanya-jawab-format-1nov
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
ADB="${ABT_DB:-aps_badilag}"
PY="${PY:-python}"
BIN="${MYSQL_BIN:-}"; [ -n "$BIN" ] && BIN="$BIN/"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="${BIN}mysql -h $H -u root --default-character-set=latin1 $ADB"
mkdir -p "$CAD"
$PY tambal_rtf.py pulih "$B" "$CAD" || echo "PERINGATAN: sebagian berkas tidak dipulihkan (lihat di atas)"
$MY -N < "$N-PULIH.sql" | tr -d '\r' || { echo "GAGAL: PULIH SQL berhenti"; exit 1; }
p=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r')
if [ "$p" = "$(sed -n 1p harap.txt | tr -d '\r')" ]; then echo "PULIH COCOK ($p)"; else echo "PULIH SEBAGIAN: prasyarat sekarang '$p' (ada yang sudah disunting orang, dibiarkan)"; exit 1; fi
