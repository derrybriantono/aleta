#!/bin/bash
# PULIH paket ABT "abt-tinjau-31okt" (30 Okt 2026, G6) - deterministik, TANPA hapus permanen berkas:
#   - berkas yang DITIMPA dikembalikan dari cadangan/timpa-asal HANYA bila isinya masih persis isi paket (isi paket disalin ke pulih-arsip);
#   - kueri variabel lama dikembalikan HANYA bila masih persis isi paket; variabel baru dihapus HANYA bila masih persis paket
#     (yang sudah disunting orang dibiarkan dan dilaporkan). Baris terakhir harus "PULIH COCOK".
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_g6 ABT_BLANGKO=<_blangko_abt uji> MYSQL_BIN=<folder mysql.exe> PY=python bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-tinjau-31okt
NOMOR="$(grep -v '^#' nomor-variabel.txt | paste -sd, -)"
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
