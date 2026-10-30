#!/bin/bash
# PULIH paket ABT OPSIONAL "abt-titik-koma-data-30okt": baris dari cadangan/jawaban-sebelum.sql dikembalikan HANYA bila isinya
# sekarang masih persis hasil rapikan paket (jawaban yang disunting ulang petugas sesudah pasang dibiarkan dan dihitung).
# Baris terakhir "PULIH COCOK". Laptop: ABT_LOKAL=1 ABT_DB=<basis salinan> bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-titik-koma-data-30okt
CAD="$SINI/cadangan"
ADB="${ABT_DB:-aps_badilag}"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
# (1) pemicu kembali ke badan ket-saksi-baris DULU (agar data yang dikembalikan tidak dirapikan lagi)
$MY < "$N-PEMICU-LAMA.sql" || { echo "GAGAL: pemicu lama tidak bisa dibuat"; exit 1; }
p=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r')
case "$p" in 1\|2\|0\|0\|*) echo "PEMICU DIKEMBALIKAN ($p)" ;; *) echo "GAGAL: pemicu tidak kembali ($p)"; exit 1 ;; esac
[ -s "$CAD/jawaban-sebelum.sql" ] || { echo "DATA: tidak ada cadangan di $CAD (tidak ada yang dikembalikan)"; echo "PULIH COCOK"; exit 0; }
ada=$($MY -N -e "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='isian_rtf_butir_rapi'" | tr -d '\r')
[ "$ada" = 1 ] || { echo "GAGAL: fungsi isian_rtf_butir_rapi tidak ada - data tidak dapat dicocokkan (pasang titik-koma-30okt lagi, lalu ulangi)"; exit 1; }
nc=$(grep -c '^REPLACE' "$CAD/jawaban-sebelum.sql")
o=$({ echo "CREATE TEMPORARY TABLE t30_lama LIKE abt_keterangan_saksi;"
  sed 's/^REPLACE INTO `abt_keterangan_saksi`/REPLACE INTO t30_lama/' "$CAD/jawaban-sebelum.sql" | grep '^REPLACE'
  echo "START TRANSACTION;"
  echo "SELECT CONCAT('BARIS CADANGAN ', COUNT(*), ' | MASIH HASIL PAKET ', SUM(BINARY IFNULL(k.jawaban,'') = BINARY IFNULL(isian_rtf_butir_rapi(l.jawaban, ''),''))) FROM t30_lama l JOIN abt_keterangan_saksi k ON k.id = l.id;"
  echo "UPDATE abt_keterangan_saksi k JOIN t30_lama l ON l.id = k.id SET k.jawaban = l.jawaban WHERE BINARY IFNULL(k.jawaban,'') = BINARY IFNULL(isian_rtf_butir_rapi(l.jawaban, ''),'');"
  echo "SELECT CONCAT('DIKEMBALIKAN ', ROW_COUNT());"
  echo "SELECT CONCAT('SAMA DENGAN CADANGAN ', SUM(BINARY IFNULL(k.jawaban,'') = BINARY IFNULL(l.jawaban,''))) FROM t30_lama l JOIN abt_keterangan_saksi k ON k.id = l.id;"
  echo "COMMIT;"
} | $MY -N | tr -d '\r') || { echo "GAGAL: pengembalian data"; exit 1; }
echo "$o"
mv "$CAD/jawaban-sebelum.sql" "$CAD/jawaban-sebelum.dipulihkan.$(date +%Y%m%d%H%M%S).sql"
s=$(echo "$o" | sed -n 's/^SAMA DENGAN CADANGAN //p')
[ "$s" = "$nc" ] && echo "PULIH COCOK" || { echo "PULIH SEBAGIAN: $s dari $nc baris kembali (sisanya disunting sesudah pasang)"; exit 1; }
