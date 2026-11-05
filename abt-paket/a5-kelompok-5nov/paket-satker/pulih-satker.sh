#!/bin/bash
# PULIH paket ABT "abt-a5-kelompok-5nov" (5 Nov 2026) - tanpa hapus permanen isi yang sudah disunting orang:
#   - berkas yang ditambal dikembalikan dari cadangan HANYA bila isinya masih persis isi paket (yang sudah disunting dibiarkan, dilaporkan);
#   - variabel baru (12150-12182) dihapus HANYA bila masih persis paket (yang sudah diubah orang dibiarkan).
# PERHATIAN: abt_data_teks.no_var ON DELETE CASCADE: isian yang sudah disimpan petugas untuk variabel baru ikut terhapus saat pulih.
# Urutan: berkas dulu, baru variabel. Baris terakhir harus "PULIH COCOK".
# Laptop: ABT_LOKAL=1 ABT_DB=<basis ABT uji> ABT_BLANGKO=<_blangko_abt uji> PY=python bash pulih-satker.sh  (mysql lewat PATH)
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-a5-kelompok-5nov
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
mkdir -p "$CAD"
$PY tambal_rtf.py pulih "$B" "$CAD" || { echo "GAGAL: pulih berkas"; exit 1; }
$MY -N < "$N-PULIH.sql" | tr -d '\r' || { echo "GAGAL: PULIH SQL berhenti"; exit 1; }
c=$($PY tambal_rtf.py cek "$B")
p=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r')
if [ "$(echo "$c" | tail -1 | tr -d '\r')" = "BERKAS SIAP" ] && ! echo "$c" | grep -q "SUDAH=" && [ "$p" = "$(sed -n 1p harap.txt | tr -d '\r')" ]; then
  echo "PULIH COCOK ($p)"
else
  echo "$c" | tail -20; echo "PULIH SEBAGIAN: prasyarat sekarang '$p' (ada yang sudah disunting orang, dibiarkan)"; exit 1
fi
