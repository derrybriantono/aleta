#!/bin/bash
# PULIH paket ABT "abt-alamat-ganda-26okt" (26 Okt 2026) - deterministik, urutan terbalik dari pasang:
#  * blangko RTF dikembalikan dari cadangan/rtf-lama HANYA bila md5 berkas sekarang masih persis hasil tambal paket (yang sudah disunting dibiarkan);
#  * variabel BARU (3517-3519) dihapus HANYA bila isinya masih persis isi paket (isian per perkara untuk nomor baru, bila ada, disalin dulu ke cadangan);
#  * baris yang DIUBAH dikembalikan dari cadangan/abt_variabel-sebelum.sql HANYA bila isinya masih isi BARU paket dan baris cadangan masih isi LAMA yang diharapkan;
#  * dua fungsi x9 (isian_rtf_pihak_utama, isian_rtf_pihak_tambahan) dikembalikan ke definisi LAMA (-FUNGSI-X9-LAMA.sql) bila masih definisi BARU paket;
#  * fungsi isian_rtf_alamat* (komentar "AG:") dihapus SESUDAH itu dan HANYA bila tak ada variabel yang masih memanggilnya.
# Baris terakhir harus "PULIH COCOK". Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_ag1 SIPP_DB=sipp_donggala ABT_BLANGKO=<salinan> bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-alamat-ganda-26okt
CAD="$SINI/cadangan"
ADB="${ABT_DB:-aps_badilag}"
SDB="${SIPP_DB:-SIPP}"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt/derry_briantono}"
PERL="${PERL:-perl}"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
myn() { $MY -N "$@" | tr -d '\r'; }
sqlf() { if [ "$SDB" = SIPP ]; then cat "$1"; else sed "s/SIPP\\./$SDB./g" "$1"; fi; }
NOMOR_BARU=$(cat nomor-baru.txt)
mkdir -p "$CAD"
# 1. RTF
if [ -s "$CAD/rtf-ditambal.txt" ]; then
  $PERL tambal-rtf.pl pulih "$B" "$CAD" | tail -n 4
else
  echo "RTF: tidak ada catatan tambal di $CAD (tidak ada yang dipulihkan)"
fi
# 2. variabel
for T in abt_data_teks abt_data_tanggal; do
  mysqldump -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
    --complete-insert --skip-comments --hex-blob --where="no_var IN ($NOMOR_BARU)" "$ADB" "$T" > "$CAD/$T-isian-sebelum-pulih.$(date +%Y%m%d%H%M%S).sql" \
    || { echo "GAGAL: isian nomor baru tidak bisa dicadangkan - tidak ada yang dipulihkan"; exit 1; }
done
{
  echo "CREATE TEMPORARY TABLE ag_lama LIKE abt_variabel;"
  [ -f "$CAD/abt_variabel-sebelum.sql" ] && grep '^REPLACE' "$CAD/abt_variabel-sebelum.sql" | sed 's/^REPLACE INTO `abt_variabel`/REPLACE INTO ag_lama/'
  cat "$N-PULIH.sql"
} | $MY -N | tr -d '\r' || { echo "GAGAL: PULIH SQL berhenti"; exit 1; }
# 3. dua fungsi x9: kembalikan definisi lama bila masih definisi baru paket
x9baru=$(myn -e "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name IN ('isian_rtf_pihak_utama','isian_rtf_pihak_tambahan') AND routine_definition LIKE '%isian_rtf_alamat(%'")
if [ "$x9baru" != 0 ]; then
  sqlf "$N-FUNGSI-X9-LAMA.sql" | $MY > "$CAD/fungsi-x9-lama.log" 2>&1 && echo "FUNGSI x9 DIKEMBALIKAN ke definisi lama ($x9baru)" || { echo "GAGAL: fungsi x9 lama tidak bisa dibuat"; tail -3 "$CAD/fungsi-x9-lama.log"; }
fi
# 4. fungsi AG: hanya bila tidak ada variabel/fungsi yang masih memanggil
pakai=$(myn -e "SELECT (SELECT COUNT(*) FROM abt_variabel WHERE sql_query LIKE '%isian_rtf_alamat%') + (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_definition LIKE '%isian_rtf_alamat(%' AND routine_name NOT LIKE 'isian\\_rtf\\_alamat%')")
if [ "$pakai" = 0 ]; then
  for f in $(myn -e "SELECT routine_name FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_comment LIKE 'AG:%'"); do
    $MY -e "DROP FUNCTION IF EXISTS $f" && echo "FUNGSI DIHAPUS $f"
  done
else
  echo "PERINGATAN: isian_rtf_alamat masih dipanggil $pakai variabel/fungsi - fungsi AG dibiarkan"
fi
sisa=$(myn -e "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_comment LIKE 'AG:%'")
bsisa=$(myn -e "SELECT COUNT(*) FROM abt_variabel WHERE no_var IN ($NOMOR_BARU)")
x9sisa=$(myn -e "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name IN ('isian_rtf_pihak_utama','isian_rtf_pihak_tambahan') AND routine_definition LIKE '%isian_rtf_alamat(%'")
if [ "$sisa" = 0 ] && [ "$bsisa" = 0 ] && [ "$x9sisa" = 0 ]; then echo "PULIH COCOK"; else echo "PULIH TIDAK LENGKAP - fungsi AG tersisa $sisa, variabel baru tersisa $bsisa, fungsi x9 masih berisi alamat-baru $x9sisa"; fi
