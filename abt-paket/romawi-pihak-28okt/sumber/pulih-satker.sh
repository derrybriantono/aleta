#!/bin/bash
# PULIH paket ABT "abt-romawi-pihak-28okt" (28 Okt 2026) - deterministik:
#  * 7 baris yang DIUBAH dikembalikan dari cadangan/abt_variabel-sebelum.sql HANYA bila isinya masih isi BARU paket dan baris cadangan masih isi LAMA yang diharapkan.
#  * Paket ini tidak membuat fungsi, jadi tidak ada fungsi yang dihapus (fungsi paket 27 Okt dan paket sisa 28 Okt TIDAK disentuh).
# Baris terakhir harus "PULIH COCOK". Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_rm1 SIPP_DB=sipp_donggala bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-romawi-pihak-28okt
CAD="$SINI/cadangan"
ADB="${ABT_DB:-aps_badilag}"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
mkdir -p "$CAD"
[ -f "$CAD/abt_variabel-sebelum.sql" ] || { echo "PULIH TIDAK LENGKAP - $CAD/abt_variabel-sebelum.sql tidak ada (ambil isi lama dari cadangan DB harian)"; exit 1; }
hasil=$({
  echo "CREATE TEMPORARY TABLE pu_lama LIKE abt_variabel;"
  grep '^REPLACE' "$CAD/abt_variabel-sebelum.sql" | sed 's/^REPLACE INTO `abt_variabel`/REPLACE INTO pu_lama/'
  cat "$N-PULIH.sql"
} | $MY -N | tr -d '\r') || { echo "GAGAL: PULIH SQL berhenti"; exit 1; }
echo "$hasil"
if [ "$(echo "$hasil" | tail -1)" = "VARIABEL KEMBALI" ]; then echo "PULIH COCOK"; else echo "PULIH TIDAK LENGKAP"; fi
