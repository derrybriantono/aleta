#!/bin/bash
# PULIH paket ABT "abt-x5-kodepos-amplop-21okt" (21 Okt 2026) - deterministik, urutan: berkas lebih dulu, lalu SQL:
#  * 6 blangko RTF amplop dikembalikan dari cadangan/sunting-asal HANYA bila isinya masih persis isi hasil sunting paket (yang disunting orang sesudahnya dibiarkan dan dilaporkan);
#  * variabel BARU (9290-9293) dihapus HANYA bila isinya masih persis isi paket (isian per perkara untuk nomor baru - semestinya tidak ada, variabel otomatis - disalin dulu ke cadangan karena FK CASCADE ikut terhapus);
#  * baris yang DIUBAH (8172) dikembalikan dari cadangan/abt_variabel-sebelum.sql HANYA bila isinya masih isi BARU paket dan baris cadangan masih isi LAMA yang diharapkan.
# Baris terakhir harus "PULIH COCOK". Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_x5 ABT_BLANGKO=<_blangko_abt uji> bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-x5-kodepos-amplop-21okt
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
ADB="${ABT_DB:-aps_badilag}"
PY="${PY:-python}"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
NOMOR_BARU=$(cat nomor-baru.txt)
mkdir -p "$CAD"
$PY berkas_rtf.py pulih "$B" "$CAD" || echo "PERINGATAN: sebagian blangko tidak dikembalikan (lihat di atas)"
for T in abt_data_teks abt_data_tanggal; do
  mysqldump -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
    --complete-insert --skip-comments --hex-blob --where="no_var IN ($NOMOR_BARU)" "$ADB" "$T" > "$CAD/$T-isian-sebelum-pulih.$(date +%Y%m%d%H%M%S).sql" \
    || { echo "GAGAL: isian nomor baru tidak bisa dicadangkan - variabel tidak dipulihkan"; exit 1; }
done
{
  echo "CREATE TEMPORARY TABLE x5_lama LIKE abt_variabel;"
  [ -f "$CAD/abt_variabel-sebelum.sql" ] && grep '^REPLACE' "$CAD/abt_variabel-sebelum.sql" | sed 's/^REPLACE INTO `abt_variabel`/REPLACE INTO x5_lama/'
  cat "$N-PULIH.sql"
} | $MY -N || { echo "GAGAL: PULIH SQL berhenti"; exit 1; }
