#!/bin/bash
# PULIH paket ABT "abt-relaas-penetapan-30okt" (30 Okt 2026) - deterministik: blangko dikembalikan dari cadangan HANYA bila isinya masih persis isi
# paket, variabel baru (blok 11200-11229) dihapus HANYA bila masih persis isi paket. Tidak ada variabel lama yang perlu dikembalikan (paket tidak
# mengubah variabel lama). Baris terakhir harus "PULIH COCOK".
# Laptop: ABT_LOKAL=1 ABT_DB=<basis uji> ABT_BLANGKO=<_blangko_abt uji> MYSQL_BIN=<folder mysql.exe> PY=python bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-relaas-penetapan-30okt
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
sqlf() { sed "s/aps_badilag\./$ADB./g" "$1"; }
mkdir -p "$CAD"
ok=1
if [ -f "$CAD/berkas-pasang.txt" ] || [ -d "$CAD/timpa-asal" ]; then
  $PY berkas_rtf.py pulih "$B" "$CAD" | tee "$CAD/berkas-pulih.txt"
  [ "$(tail -1 "$CAD/berkas-pulih.txt")" = "BERKAS PULIH" ] || { echo "PERINGATAN: sebagian blangko tidak dikembalikan (lihat di atas)"; ok=0; }
else
  echo "blangko: belum pernah ditimpa paket ini (gagal sebelum berkas) - tidak ada yang dikembalikan"
fi
sqlf "$N-PULIH.sql" | $MY -N || { echo "GAGAL: PULIH SQL berhenti"; exit 1; }
p=$(sqlf "$N-PRASYARAT.sql" | $MY -N)
NR=$(grep -vc '^#' nomor-dirujuk.txt)
echo "PRASYARAT sesudah pulih: $p (harus 0|0|$NR|7)"
if [ "$p" = "0|0|$NR|7" ] && [ "$ok" = 1 ]; then echo "PULIH COCOK"; else echo "PULIH SEBAGIAN"; exit 1; fi
