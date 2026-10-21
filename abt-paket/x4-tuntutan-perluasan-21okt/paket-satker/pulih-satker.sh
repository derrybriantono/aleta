#!/bin/bash
# PULIH paket ABT "abt-x4-tuntutan-perluasan-21okt" (21 Okt 2026) - deterministik:
#  * blangko RTF dikembalikan dari cadangan/rtf-lama HANYA bila md5 berkas sekarang masih persis hasil paket (yang sudah disunting dibiarkan);
#  * variabel BARU dihapus HANYA bila isinya masih persis paket (isian per perkara nomor baru - semestinya tidak ada, semuanya kueri - disalin dulu
#    ke cadangan karena FK CASCADE ikut terhapus);
#  * baris yang DIUBAH dikembalikan dari cadangan/abt_variabel-sebelum.sql HANYA bila isinya masih isi BARU paket dan baris cadangan masih isi LAMA.
# Baris terakhir harus "PULIH COCOK". Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_x4u ABT_BLANGKO=<salinan> bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-x4-tuntutan-perluasan-21okt
CAD="$SINI/cadangan"
ADB="${ABT_DB:-aps_badilag}"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt/derry_briantono}"
PERL="${PERL:-perl}"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
NOMOR_BARU=$(cat nomor-baru.txt)
mkdir -p "$CAD"
if [ -s "$CAD/rtf-ditambal.txt" ]; then
  $PERL tambal-rtf.pl pulih "$B" "$CAD" > "$CAD/rtf-pulih-hasil.txt"
  echo "RTF $(tail -1 "$CAD/rtf-pulih-hasil.txt")"
else
  echo "RTF: tidak ada yang ditambal (dilewati)"
fi
for T in abt_data_teks abt_data_tanggal; do
  mysqldump -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
    --complete-insert --skip-comments --hex-blob --where="no_var IN ($NOMOR_BARU)" "$ADB" "$T" > "$CAD/$T-isian-sebelum-pulih.$(date +%Y%m%d%H%M%S).sql" \
    || { echo "GAGAL: isian nomor baru tidak bisa dicadangkan - variabel tidak dipulihkan"; exit 1; }
done
{
  echo "CREATE TEMPORARY TABLE x4_lama LIKE abt_variabel;"
  [ -f "$CAD/abt_variabel-sebelum.sql" ] && grep '^REPLACE' "$CAD/abt_variabel-sebelum.sql" | sed 's/^REPLACE INTO `abt_variabel`/REPLACE INTO x4_lama/'
  cat "$N-PULIH.sql"
} | $MY -N || { echo "GAGAL: PULIH SQL berhenti"; exit 1; }
