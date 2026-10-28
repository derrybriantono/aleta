#!/bin/bash
# PULIH paket ABT "abt-alamat-putusan-28okt" (28 Okt 2026) - deterministik:
#  * 6 variabel dikembalikan dari cadangan/abt_variabel-sebelum.sql HANYA bila isinya masih isi BARU paket dan baris cadangan masih isi LAMA yang diharapkan;
#  * dua fungsi paket 27 Okt (isian_rtf_pihak_identitas, isian_rtf_pihak_utama) dikembalikan ke definisi LAMA (-FUNGSI-LAMA.sql) bila keduanya masih definisi BARU paket ini;
#  * tiga fungsi baru (komentar "AP:") dihapus SESUDAH itu dan HANYA bila tak ada variabel atau fungsi lain yang masih memanggilnya.
# Jalankan PULIH ini SEBELUM pulih paket abt-pihak-urut-sisa-28okt dan abt-pihak-urut-ecourt-27okt. Baris terakhir harus "PULIH COCOK".
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_alamat SIPP_DB=sipp_donggala bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-alamat-putusan-28okt
CAD="$SINI/cadangan"
ADB="${ABT_DB:-aps_badilag}"
SDB="${SIPP_DB:-SIPP}"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
myn() { $MY -N "$@" | tr -d '\r'; }
sqlf() { if [ "$SDB" = SIPP ]; then cat "$1"; else sed "s/SIPP\\./$SDB./g" "$1"; fi; }
sqlm() { if [ "$SDB" = SIPP ]; then cat "$1"; else sed "s/MD5(routine_definition)/MD5(REPLACE(routine_definition, '$SDB.', 'SIPP.'))/g" "$1"; fi; }
mkdir -p "$CAD"
# 1. variabel
{
  echo "CREATE TEMPORARY TABLE pu_lama LIKE abt_variabel;"
  [ -f "$CAD/abt_variabel-sebelum.sql" ] && grep '^REPLACE' "$CAD/abt_variabel-sebelum.sql" | sed 's/^REPLACE INTO `abt_variabel`/REPLACE INTO pu_lama/'
  cat "$N-PULIH.sql"
} | $MY -N | tr -d '\r' || { echo "GAGAL: PULIH SQL berhenti"; exit 1; }
# 2. dua fungsi paket 27 Okt: kembalikan definisi lama bila KEDUANYA masih definisi baru paket ini
baru=$(sqlm "$N-FUNGSI-CEK.sql" | $MY -N | tr -d '\r')
if [ "$baru" = 2 ]; then
  sqlf "$N-FUNGSI-LAMA.sql" | $MY > "$CAD/fungsi-lama.log" 2>&1 && echo "FUNGSI identitas dan utama DIKEMBALIKAN ke definisi lama" || { echo "GAGAL: fungsi lama tidak bisa dibuat"; tail -3 "$CAD/fungsi-lama.log"; }
elif [ "$baru" != 0 ]; then
  echo "PERINGATAN: hanya $baru dari 2 fungsi masih definisi baru paket - dibiarkan (diubah orang?)"
fi
# 3. fungsi AP hanya bila tidak ada variabel/fungsi yang memanggil
pakai=$(myn -e "SELECT (SELECT COUNT(*) FROM abt_variabel WHERE sql_query LIKE '%isian\_rtf\_alamat\_putusan%') + (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_comment NOT LIKE 'AP:%' AND routine_definition LIKE '%isian\_rtf\_alamat\_putusan%')")
if [ "$pakai" = 0 ]; then
  for f in isian_rtf_alamat_putusan isian_rtf_alamat_buang_arah isian_rtf_alamat_arah; do
    $MY -e "DROP FUNCTION IF EXISTS $f" && echo "FUNGSI DIHAPUS $f"
  done
else
  echo "PERINGATAN: fungsi paket masih dipanggil $pakai variabel/fungsi - fungsi AP dibiarkan"
fi
sisa=$(myn -e "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_comment LIKE 'AP:%'")
if [ "$sisa" = 0 ] && [ "$pakai" = 0 ]; then echo "PULIH COCOK"; else echo "PULIH TIDAK LENGKAP - fungsi AP tersisa $sisa, pemanggil yang masih ada $pakai"; fi
