#!/bin/bash
# PULIH paket ABT "abt-identitas-pihak-1nov" (1 Nov 2026, agen V) - deterministik, TANPA hapus permanen:
#   - berkas RTF yang ditambal paket ini dikembalikan dari cadangan HANYA bila isinya masih persis isi paket (yang sudah disunting orang dibiarkan dan dilaporkan);
#   - variabel 7047/7048 dikembalikan dari cadangan/abt_variabel-sebelum.sql HANYA bila isinya masih isi BARU paket dan baris cadangan masih isi LAMA yang diharapkan;
#   - dua fungsi (isian_rtf_pihak_identitas, isian_rtf_pihak_tambahan) dikembalikan ke definisi LAMA (-FUNGSI-LAMA.sql) bila KEDUANYA masih definisi baru paket ini.
# Pulihkan paket ini SEBELUM paket sebelumnya (perbaikan-1nov). Baris terakhir harus "PULIH COCOK".
# Laptop: ABT_LOKAL=1 ABT_DB=<basis ABT uji> SIPP_DB=<basis SIPP uji> ABT_BLANGKO=<_blangko_abt uji> MYSQL_BIN=<folder mysql.exe> PY=python bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-identitas-pihak-1nov
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
ADB="${ABT_DB:-aps_badilag}"
SDB="${SIPP_DB:-SIPP}"
PY="${PY:-python}"
BIN="${MYSQL_BIN:-}"; [ -n "$BIN" ] && BIN="$BIN/"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="${BIN}mysql -h $H -u root --default-character-set=latin1 $ADB"
sqlf() { if [ "$SDB" = SIPP ]; then cat "$1"; else sed "s/SIPP\\./$SDB./g" "$1"; fi; }
sqlm() { if [ "$SDB" = SIPP ]; then cat "$1"; else sed "s/MD5(routine_definition)/MD5(REPLACE(routine_definition, '$SDB.', 'SIPP.'))/g" "$1"; fi; }
mkdir -p "$CAD"
# 1. berkas
$PY tambal_rtf.py pulih "$B" "$CAD" || echo "PERINGATAN: sebagian berkas tidak dipulihkan (lihat di atas)"
# 2. variabel (tabel sementara pu_lama dari cadangan)
{
  echo "CREATE TEMPORARY TABLE pu_lama LIKE abt_variabel;"
  [ -f "$CAD/abt_variabel-sebelum.sql" ] && grep '^REPLACE' "$CAD/abt_variabel-sebelum.sql" | sed 's/^REPLACE INTO `abt_variabel`/REPLACE INTO pu_lama/'
  cat "$N-PULIH.sql"
} | $MY -N | tr -d '\r' || { echo "GAGAL: PULIH SQL berhenti"; exit 1; }
# 3. fungsi: kembalikan definisi lama bila KEDUANYA masih definisi baru paket ini
baru=$(sqlm "$N-FUNGSI-CEK.sql" | $MY -N | tr -d '\r')
if [ "$baru" = 2 ]; then
  sqlf "$N-FUNGSI-LAMA.sql" | $MY > "$CAD/fungsi-lama.log" 2>&1 && echo "FUNGSI identitas dan tambahan DIKEMBALIKAN ke definisi lama" || { echo "GAGAL: fungsi lama tidak bisa dibuat"; tail -3 "$CAD/fungsi-lama.log"; }
elif [ "$baru" != 0 ]; then
  echo "PERINGATAN: hanya $baru dari 2 fungsi masih definisi baru paket - dibiarkan (diubah orang?)"
fi
p=$(sqlm "$N-PRASYARAT.sql" | $MY -N | tr -d '\r')
if [ "$p" = "$(sed -n 1p harap.txt | tr -d '\r')" ]; then echo "PULIH COCOK ($p)"; else echo "PULIH SEBAGIAN: prasyarat sekarang '$p' (ada yang sudah disunting orang, dibiarkan)"; exit 1; fi
