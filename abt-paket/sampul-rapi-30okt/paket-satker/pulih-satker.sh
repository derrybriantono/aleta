#!/bin/bash
# PULIH paket ABT "abt-sampul-rapi-30okt" (30 Okt 2026) - deterministik: blangko dikembalikan dari cadangan HANYA bila isinya masih persis isi paket,
# variabel baru (11300-11317) dihapus dan 60 variabel lama dikembalikan HANYA bila isinya masih persis isi paket, lalu kelima fungsi paket dibuang.
# Baris terakhir harus "PULIH COCOK" (keadaan = sebelum paket).
# Laptop: ABT_LOKAL=1 ABT_DB=<basis uji> SIPP_DB=<salinan SIPP> ABT_BLANGKO=<_blangko_abt uji> MYSQL_BIN=<folder mysql.exe> PY=python bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-sampul-rapi-30okt
. ./harap.txt
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
SDB="${SIPP_DB:-SIPP}"
ADB="${ABT_DB:-aps_badilag}"
PY="${PY:-python}"
BIN="${MYSQL_BIN:-}"; [ -n "$BIN" ] && BIN="$BIN/"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="${BIN}mysql -h $H -u root --default-character-set=latin1 $ADB"
sqlf() { sed -e "s/aps_badilag\./$ADB./g" -e "s/\bSIPP\./$SDB./g" -e "s/ROUTINE_SCHEMA = 'aps_badilag'/ROUTINE_SCHEMA = '$ADB'/g" "$1"; }
mkdir -p "$CAD"
ok=1
if [ -f "$CAD/berkas-pasang.txt" ] || [ -d "$CAD/timpa-asal" ]; then
  $PY berkas_rtf.py pulih "$B" "$CAD" | tee "$CAD/berkas-pulih.txt"
  [ "$(tail -1 "$CAD/berkas-pulih.txt")" = "BERKAS PULIH" ] || { echo "PERINGATAN: sebagian blangko tidak dikembalikan (lihat di atas)"; ok=0; }
else
  echo "blangko: belum pernah ditimpa paket ini (gagal sebelum berkas) - tidak ada yang dikembalikan"
fi
sqlf "$N-PULIH.sql" | $MY -N || { echo "GAGAL: PULIH SQL berhenti"; exit 1; }
sqlf "$N-FUNGSI-PULIH.sql" | $MY || { echo "GAGAL: PULIH fungsi berhenti"; exit 1; }
p=$(sqlf "$N-PRASYARAT.sql" | $MY -N)
echo "PRASYARAT sesudah pulih: $p (harus $HARAP)"
if [ "$p" = "$HARAP" ] && [ "$ok" = 1 ]; then echo "PULIH COCOK"; else echo "PULIH SEBAGIAN"; exit 1; fi
