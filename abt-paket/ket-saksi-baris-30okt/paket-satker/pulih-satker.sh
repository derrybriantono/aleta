#!/bin/bash
# PULIH paket ABT "abt-ket-saksi-baris-30okt": (1) pemicu dihapus DULU (agar data lama tidak dirapikan lagi), (2) baris dari
# cadangan/baris-sebelum.sql dikembalikan HANYA bila isinya sekarang masih persis hasil rapikan paket (baris yang sudah
# disunting/disimpan ulang petugas sesudah pasang dibiarkan dan dihitung), (3) fungsi dihapus. Baris terakhir "PULIH COCOK".
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-ket-saksi-baris-30okt
CAD="$SINI/cadangan"
ADB="${ABT_DB:-aps_badilag}"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
$MY -e "DROP TRIGGER IF EXISTS abt_keterangan_saksi_satu_baris_bi; DROP TRIGGER IF EXISTS abt_keterangan_saksi_satu_baris_bu;" || { echo "GAGAL: pemicu"; exit 1; }
echo "PEMICU DIHAPUS"
if [ -s "$CAD/baris-sebelum.sql" ]; then
  ada=$($MY -N -e "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='isian_rtf_satu_baris'" | tr -d '\r')
  [ "$ada" = 1 ] || { echo "GAGAL: fungsi isian_rtf_satu_baris tidak ada - data tidak dapat dicocokkan"; exit 1; }
  { echo "CREATE TEMPORARY TABLE b30_lama LIKE abt_keterangan_saksi;"
    sed 's/^REPLACE INTO `abt_keterangan_saksi`/REPLACE INTO b30_lama/' "$CAD/baris-sebelum.sql" | grep '^REPLACE'
    echo "START TRANSACTION;"
    echo "SELECT CONCAT('BARIS CADANGAN ', COUNT(*), ' | MASIH HASIL PAKET ', SUM(BINARY IFNULL(k.jawaban,'') = BINARY IFNULL(isian_rtf_satu_baris(l.jawaban),'') AND BINARY IFNULL(k.pertanyaan,'') = BINARY IFNULL(isian_rtf_satu_baris(l.pertanyaan),''))) FROM b30_lama l JOIN abt_keterangan_saksi k ON k.id = l.id;"
    echo "UPDATE abt_keterangan_saksi k JOIN b30_lama l ON l.id = k.id SET k.jawaban = l.jawaban, k.pertanyaan = l.pertanyaan WHERE BINARY IFNULL(k.jawaban,'') = BINARY IFNULL(isian_rtf_satu_baris(l.jawaban),'') AND BINARY IFNULL(k.pertanyaan,'') = BINARY IFNULL(isian_rtf_satu_baris(l.pertanyaan),'');"
    echo "SELECT CONCAT('DIKEMBALIKAN ', ROW_COUNT());"
    echo "COMMIT;"
  } | $MY -N | tr -d '\r' || { echo "GAGAL: pengembalian data"; exit 1; }
  mv "$CAD/baris-sebelum.sql" "$CAD/baris-sebelum.dipulihkan.$(date +%Y%m%d%H%M%S).sql"
else
  echo "DATA: tidak ada cadangan di $CAD (tidak ada yang dikembalikan)"
fi
$MY -e "DROP FUNCTION IF EXISTS isian_rtf_satu_baris" && echo "FUNGSI DIHAPUS"
p=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r')
echo "PRASYARAT SESUDAH PULIH: $p"
case "$p" in 0\|0\|0\|*) echo "PULIH COCOK" ;; *) echo "PULIH TIDAK COCOK"; exit 1 ;; esac
