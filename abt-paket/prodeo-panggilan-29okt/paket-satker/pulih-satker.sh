#!/bin/bash
# PULIH paket ABT "abt-prodeo-panggilan-29okt" (29 Okt 2026) - deterministik: blangko dikembalikan dari cadangan HANYA bila isinya masih persis isi paket,
# variabel baru dihapus HANYA bila masih persis isi paket, 8508/8547/8600 dikembalikan HANYA bila masih persis isi baru, fungsi isian_rtf_terbilang dihapus.
# Baris terakhir harus "PULIH COCOK". Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_pp29 ABT_BLANGKO=<_blangko_abt uji> MYSQL_BIN=<folder mysql.exe> PY=python bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-prodeo-panggilan-29okt
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
  echo "blangko: belum pernah ditimpa paket ini (TANPA_RTF atau gagal sebelum berkas) - tidak ada yang dikembalikan"
fi
sqlf "$N-PULIH.sql" | $MY -N || { echo "GAGAL: PULIH SQL berhenti"; exit 1; }
sqlf "$N-FUNGSI-PULIH.sql" | $MY || { echo "GAGAL: fungsi tidak terhapus"; exit 1; }
p=$(sqlf "$N-PRASYARAT.sql" | $MY -N)
echo "PRASYARAT sesudah pulih: $p (harus 0|0|3|0|1)"
if [ "$p" = "0|0|3|0|1" ] && [ "$ok" = 1 ]; then echo "PULIH COCOK"; else echo "PULIH SEBAGIAN"; exit 1; fi
