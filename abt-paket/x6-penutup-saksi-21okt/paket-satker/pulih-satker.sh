#!/bin/bash
# PULIH paket ABT "abt-x6-penutup-saksi-21okt" (21 Okt 2026) - deterministik:
#  1) isian_rtf_ket_saksi dikembalikan dari fungsi-lama.sql HANYA bila isinya (md5 definisi) masih persis hasil paket (atau fungsinya hilang
#     karena pasang terputus di tengah);
#     yang sudah diubah orang sesudah dipasang DIBIARKAN dan dilaporkan;
#  2) dua fungsi baru dibuang HANYA bila tidak ada lagi fungsi/variabel yang memanggilnya.
# Baris terakhir harus "PULIH COCOK". Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_x6 bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-x6-penutup-saksi-21okt
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
LAMA=$(awk 'NR==1{print $1}' "$CAD/md5-sebelum.txt" 2>/dev/null)
BARU=$(awk 'NR==1{print $1}' "$CAD/md5-sesudah.txt" 2>/dev/null)
[ -n "$LAMA" ] || { echo "TIDAK ADA cadangan ($CAD/md5-sebelum.txt) - tidak ada yang dipulihkan"; exit 1; }
NOW=$(myn -e "SELECT MD5(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_')) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='isian_rtf_ket_saksi'")
BIARKAN=0
if [ "$NOW" = "$LAMA" ]; then
  echo "isian_rtf_ket_saksi SUDAH versi lama"
elif [ -z "$NOW" ] || { [ -n "$BARU" ] && [ "$NOW" = "$BARU" ]; }; then
  sqlf "$SINI/fungsi-lama.sql" | $MY > "$CAD/fungsi-pulih.log" 2>&1 || { echo "GAGAL: fungsi lama tidak bisa dibuat ulang (lihat $CAD/fungsi-pulih.log)"; exit 1; }
  echo "isian_rtf_ket_saksi DIKEMBALIKAN ke versi lama"
else
  echo "BIARKAN isian_rtf_ket_saksi (sudah diubah sesudah dipasang)"; BIARKAN=1
fi
PAKAI=$(myn -e "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name <> 'isian_rtf_saring_penutup' AND (LOCATE('isian_rtf_saring_penutup', routine_definition) > 0) ")
PAKAI2=$(myn -e "SELECT COUNT(*) FROM abt_variabel WHERE LOCATE('isian_rtf_saring_penutup', IFNULL(sql_query,'')) > 0 OR LOCATE('isian_rtf_penutup', IFNULL(sql_query,'')) > 0")
if [ "$PAKAI" = 0 ] && [ "$PAKAI2" = 0 ]; then
  $MY -e "DROP FUNCTION IF EXISTS isian_rtf_saring_penutup; DROP FUNCTION IF EXISTS isian_rtf_penutup;" && echo "FUNGSI BARU DIBUANG" || echo "PERINGATAN: fungsi baru tidak terbuang"
else
  echo "PERINGATAN: fungsi baru DIBIARKAN - masih dipanggil ($PAKAI fungsi, $PAKAI2 variabel)"; BIARKAN=1
fi
FB=$(myn -e "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name IN ('isian_rtf_penutup','isian_rtf_saring_penutup')")
NOW2=$(myn -e "SELECT MD5(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_')) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='isian_rtf_ket_saksi'")
echo "FUNGSI baru=$FB ket_saksi=$([ "$NOW2" = "$LAMA" ] && echo lama || echo lain)"
if [ "$BIARKAN" = 0 ] && [ "$FB" = 0 ] && [ "$NOW2" = "$LAMA" ]; then echo "PULIH COCOK"; else echo "PULIH SEBAGIAN (lihat BIARKAN/PERINGATAN di atas)"; fi
