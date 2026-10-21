#!/bin/bash
# PULIH paket ABT "abt-x9-pihak-banyak-21okt" (21 Okt 2026) - deterministik:
#  * variabel BARU (3507-3516) dihapus HANYA bila isinya masih persis isi paket (isian per perkara untuk nomor baru, bila ada, disalin dulu ke cadangan karena FK CASCADE ikut terhapus);
#  * baris yang DIUBAH (7047, 7048, 7054, 7097, 7098, 8710) dikembalikan dari cadangan/abt_variabel-sebelum.sql HANYA bila isinya masih isi BARU paket
#    dan baris cadangan masih isi LAMA yang diharapkan (yang sudah disunting orang dibiarkan dan dilaporkan);
#  * enam fungsi isian_rtf_* paket ini (komentar "X9:") dihapus SESUDAH variabel kembali dan HANYA bila tak ada variabel lain yang memanggilnya.
# Baris terakhir harus "PULIH COCOK". Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_x9 bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-x9-pihak-banyak-21okt
CAD="$SINI/cadangan"
ADB="${ABT_DB:-aps_badilag}"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
myn() { $MY -N "$@" | tr -d '\r'; }
NOMOR_BARU=$(cat nomor-baru.txt)
mkdir -p "$CAD"
for T in abt_data_teks abt_data_tanggal; do
  mysqldump -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
    --complete-insert --skip-comments --hex-blob --where="no_var IN ($NOMOR_BARU)" "$ADB" "$T" > "$CAD/$T-isian-sebelum-pulih.$(date +%Y%m%d%H%M%S).sql" \
    || { echo "GAGAL: isian nomor baru tidak bisa dicadangkan - tidak ada yang dipulihkan"; exit 1; }
done
{
  echo "CREATE TEMPORARY TABLE x9_lama LIKE abt_variabel;"
  [ -f "$CAD/abt_variabel-sebelum.sql" ] && grep '^REPLACE' "$CAD/abt_variabel-sebelum.sql" | sed 's/^REPLACE INTO `abt_variabel`/REPLACE INTO x9_lama/'
  cat "$N-PULIH.sql"
} | $MY -N | tr -d '\r' || { echo "GAGAL: PULIH SQL berhenti"; exit 1; }
# fungsi: hanya yang bertanda X9 dan tak lagi dipanggil variabel mana pun; pembantu (romawi, tanggal) paling akhir dan hanya bila semua pihak_* sudah hilang
hapus_fungsi() {
  local f="$1" ada
  ada=$(myn -e "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='$f' AND routine_comment LIKE 'X9:%'")
  [ "$ada" = 1 ] || return 0
  $MY -e "DROP FUNCTION IF EXISTS $f" && echo "FUNGSI DIHAPUS $f"
}
for f in isian_rtf_pihak_tambahan isian_rtf_pihak_urutan isian_rtf_pihak_nama isian_rtf_pihak_utama; do
  pakai=$(myn -e "SELECT COUNT(*) FROM abt_variabel WHERE sql_query LIKE '%.$f(%'")
  if [ "$pakai" != 0 ]; then echo "PERINGATAN: fungsi $f masih dipanggil $pakai variabel - dibiarkan"; continue; fi
  hapus_fungsi "$f"
done
if [ "$(myn -e "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name LIKE 'isian%pihak%' AND routine_comment LIKE 'X9:%'")" = 0 ]; then
  hapus_fungsi isian_rtf_tanggal
  hapus_fungsi isian_rtf_romawi
fi
sisa=$(myn -e "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_comment LIKE 'X9:%'")
bsisa=$(myn -e "SELECT COUNT(*) FROM abt_variabel WHERE no_var IN ($NOMOR_BARU)")
if [ "$sisa" = 0 ] && [ "$bsisa" = 0 ]; then echo "PULIH COCOK"; else echo "PULIH TIDAK LENGKAP - fungsi tersisa $sisa, variabel baru tersisa $bsisa"; fi
