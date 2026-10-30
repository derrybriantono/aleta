#!/bin/bash
# PULIH paket ABT "abt-bukti-nomor-30okt": (1) blangko RTF dikembalikan dari cadangan/rtf-lama HANYA bila md5 berkas masih
# persis hasil paket (yang disunting sesudah pasang dibiarkan dan dilaporkan); (2) 8 variabel baru dihapus HANYA bila isinya
# masih persis paket; (3) dua fungsi dihapus bila tidak ada variabel yang memanggilnya. Baris terakhir harus "PULIH COCOK".
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-bukti-nomor-30okt
CAD="$SINI/cadangan"
HARAP=$(sed -n 1p harap.txt)
ADB="${ABT_DB:-aps_badilag}"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt/derry_briantono}"
PERL="${PERL:-perl}"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
NR=$(grep -c . rtf-daftar-tambal.tsv)
mkdir -p "$CAD"
if [ -s "$CAD/rtf-ditambal.txt" ]; then $PERL tambal-rtf.pl pulih "$B" "$CAD" | tail -n 2; else echo "RTF: tidak ada catatan tambal (tidak ada yang dipulihkan)"; fi
$MY -N < "$N-PULIH.sql" | tr -d '\r'
pakai=$($MY -N -e "SELECT COUNT(*) FROM abt_variabel WHERE sql_query LIKE '%isian\_rtf\_bukti%'" | tr -d '\r')
if [ "$pakai" = 0 ]; then
  $MY -e "DROP FUNCTION IF EXISTS isian_rtf_bukti; DROP FUNCTION IF EXISTS isian_rtf_bukti_nomor;" && echo "FUNGSI DIHAPUS"
else
  echo "PERINGATAN: fungsi masih dipanggil $pakai variabel - dibiarkan"
fi
$PERL tambal-rtf.pl periksa "$B" "$CAD" > "$CAD/periksa-rtf-pulih.txt"
r=$(tail -1 "$CAD/periksa-rtf-pulih.txt")
p=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r')
echo "RTF SESUDAH PULIH: $r | PRASYARAT: $p"
if [ "$r" = "RINGKAS COCOK=$NR SUDAH=0 LEWAT=0" ] && [ "${p%|*}" = "$HARAP" ]; then echo "PULIH COCOK"; else echo "PULIH TIDAK LENGKAP"; exit 1; fi
