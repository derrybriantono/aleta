#!/bin/bash
# PULIH paket ABT "abt-x7-bersih-penutup-21okt" (21 Okt 2026) - deterministik:
#  1) baris yang dihapus dikembalikan dari cadangan/baris-dihapus.sql dengan INSERT IGNORE (baris yang sudah ada kembali atau kuncinya diisi
#     ulang oleh orang TIDAK ditimpa; jumlahnya dilaporkan);
#  2) isian_rtf_keterangan dikembalikan dari fungsi-lama.sql HANYA bila isinya (md5 definisi) masih persis hasil paket (atau fungsinya hilang).
# Baris terakhir harus "PULIH COCOK". Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_x7 SIPP_DB=sipp_x7 bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-x7-bersih-penutup-21okt
CAD="$SINI/cadangan"
ADB="${ABT_DB:-aps_badilag}"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
myn() { $MY -N "$@" | tr -d '\r'; }
sqlf() { if [ "$ADB" = aps_badilag ]; then cat "$1"; else sed "s/aps_badilag\./$ADB./g" "$1"; fi; }
set -o pipefail
[ -f "$CAD/hitung-sebelum.txt" ] || { echo "TIDAK ADA cadangan ($CAD/hitung-sebelum.txt) - tidak ada yang dipulihkan"; exit 1; }
BIARKAN=0
# 1. baris
if [ -s "$CAD/baris-dihapus.sql" ]; then
  NCAD=$(grep -c '^INSERT' "$CAD/baris-dihapus.sql")
  IDS=$(paste -sd, "$CAD/id-hapus.txt")
  ADA0=$(myn -e "SELECT COUNT(*) FROM abt_keterangan_saksi WHERE id IN ($IDS)")
  $MY < "$CAD/baris-dihapus.sql" || { echo "GAGAL: baris tidak bisa dikembalikan"; exit 1; }
  ADA1=$(myn -e "SELECT COUNT(*) FROM abt_keterangan_saksi WHERE id IN ($IDS)")
  echo "BARIS: tercadang=$NCAD sudah-ada-sebelumnya=$ADA0 dikembalikan=$((ADA1 - ADA0)) ada-sekarang=$ADA1"
  [ "$ADA1" = "$NCAD" ] || BIARKAN=1
else
  echo "BARIS: tidak ada yang tercadang"
fi
# 2. fungsi
LAMA=$(awk 'NR==1{print $1}' "$CAD/md5-ket-sebelum.txt" 2>/dev/null)
BARU=$(awk 'NR==1{print $1}' "$CAD/md5-ket-sesudah.txt" 2>/dev/null)
NOW=$(myn -e "SELECT MD5(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_')) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='isian_rtf_keterangan'")
if [ -z "$LAMA" ]; then
  echo "FUNGSI: tidak ada cadangan md5 - tidak disentuh"
elif [ "$NOW" = "$LAMA" ]; then
  echo "isian_rtf_keterangan SUDAH versi lama"
elif [ -z "$NOW" ] || { [ -n "$BARU" ] && [ "$NOW" = "$BARU" ]; }; then
  sqlf "$SINI/fungsi-lama.sql" | $MY > "$CAD/fungsi-pulih.log" 2>&1 || { echo "GAGAL: fungsi lama tidak bisa dibuat ulang (lihat $CAD/fungsi-pulih.log)"; exit 1; }
  echo "isian_rtf_keterangan DIKEMBALIKAN ke versi lama"
else
  echo "BIARKAN isian_rtf_keterangan (sudah diubah sesudah dipasang)"; BIARKAN=1
fi
NOW2=$(myn -e "SELECT MD5(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_')) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='isian_rtf_keterangan'")
echo "FUNGSI isian_rtf_keterangan=$([ -n "$LAMA" ] && [ "$NOW2" = "$LAMA" ] && echo lama || echo lain)"
if [ "$BIARKAN" = 0 ] && { [ -z "$LAMA" ] || [ "$NOW2" = "$LAMA" ]; }; then echo "PULIH COCOK"; else echo "PULIH SEBAGIAN (lihat BIARKAN/PERINGATAN di atas)"; fi
