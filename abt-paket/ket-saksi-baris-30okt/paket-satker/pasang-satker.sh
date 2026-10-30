#!/bin/bash
# PASANG paket ABT "abt-ket-saksi-baris-30okt" (30 Okt 2026) DI SERVER sebagai root, dari folder paket.
# Isi: fungsi isian_rtf_satu_baris + 2 pemicu pada abt_keterangan_saksi + MERAPIKAN DATA tersimpan: pertanyaan/jawaban
#      tanya-jawab saksi yang memuat ganti baris -> ganti baris jadi satu spasi (huruf lain TIDAK berubah; diperiksa).
#      Tidak ada variabel, blangko, atau SIPP yang diubah.
# Urutan: md5 paket -> PRASYARAT -> CADANGAN baris yang akan dirapikan (mysqldump) -> FUNGSI+pemicu -> rapikan data
#         (satu transaksi) -> PERIKSA (huruf selain spasi/ganti baris sama persis, ganti baris 0). Gagal = pulih otomatis.
# Laptop: ABT_LOKAL=1 ABT_DB=<basis salinan> bash pasang-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-ket-saksi-baris-30okt
CAD="$SINI/cadangan"
ADB="${ABT_DB:-aps_badilag}"
gagal() { echo "GAGAL: $*"; exit 1; }
md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt)"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
set -o pipefail
p=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r') || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
abc=${p%|*}; nlama=${p##*|}
case "$abc" in
  "0|0|0") echo "PRASYARAT COCOK ($p): $nlama baris bertanda ganti baris" ;;
  "1|2|0") echo "PASANG ULANG ($p)"; r=$($MY -N < "$N-PERIKSA.sql" | tr -d '\r'); echo "PERIKSA: $r"; [ "$r" = "SEMUA COCOK" ] || gagal "periksa"; echo SELESAI; exit 0 ;;
  *) gagal "prasyarat '$p' (harus 0|0|0|N) - TIDAK ada yang diubah. Arti angka: lihat $N-PRASYARAT.sql" ;;
esac
mkdir -p "$CAD"
[ -s "$CAD/baris-sebelum.sql" ] && gagal "cadangan lama $CAD/baris-sebelum.sql ada - jalankan pulih dulu / pindahkan, jangan timpa"
W="LOCATE(CHAR(10), CONCAT(IFNULL(pertanyaan,''), IFNULL(jawaban,''))) > 0 OR LOCATE(CHAR(13), CONCAT(IFNULL(pertanyaan,''), IFNULL(jawaban,''))) > 0"
mysqldump -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
  --complete-insert --skip-comments --skip-triggers --hex-blob --where="$W" "$ADB" abt_keterangan_saksi > "$CAD/baris-sebelum.sql" \
  || gagal "cadangan gagal - TIDAK ada yang diubah"
nc=$(grep -c '^REPLACE' "$CAD/baris-sebelum.sql")
[ "$nc" = "$nlama" ] || gagal "cadangan memuat $nc baris (harus $nlama) - TIDAK ada yang diubah"
echo "CADANGAN: $CAD/baris-sebelum.sql ($nc baris)"
pulih() { echo "... memulihkan"; ABT_DB="$ADB" bash "$SINI/pulih-satker.sh" 2>&1 | tail -3; }
$MY < "$N-FUNGSI.sql" > "$CAD/fungsi.log" 2>&1 || { tail -3 "$CAD/fungsi.log"; pulih; gagal "fungsi/pemicu tidak bisa dibuat - dipulihkan"; }
$MY < "$N-PASANG.sql" || { pulih; gagal "rapikan data gagal (transaksi tidak di-COMMIT) - dipulihkan"; }
# PERIKSA: data tersimpan vs cadangan (huruf selain spasi/tab/ganti baris harus sama persis)
{ echo "CREATE TEMPORARY TABLE b30_lama LIKE abt_keterangan_saksi;"
  sed 's/^REPLACE INTO `abt_keterangan_saksi`/REPLACE INTO b30_lama/' "$CAD/baris-sebelum.sql" | grep '^REPLACE'
  echo "SELECT CONCAT_WS('|', COUNT(*), SUM(k.id IS NULL),
    SUM(REPLACE(REPLACE(REPLACE(REPLACE(IFNULL(l.jawaban,''), ' ', ''), CHAR(9), ''), CHAR(10), ''), CHAR(13), '')
      <> REPLACE(REPLACE(IFNULL(k.jawaban,''), ' ', ''), CHAR(9), '')),
    SUM(REPLACE(REPLACE(REPLACE(REPLACE(IFNULL(l.pertanyaan,''), ' ', ''), CHAR(9), ''), CHAR(10), ''), CHAR(13), '')
      <> REPLACE(REPLACE(IFNULL(k.pertanyaan,''), ' ', ''), CHAR(9), '')))
    FROM b30_lama l LEFT JOIN abt_keterangan_saksi k ON k.id = l.id;"
} | $MY -N | tr -d '\r' > "$CAD/periksa-data.txt"
pd=$(tail -1 "$CAD/periksa-data.txt")
echo "PERIKSA DATA (baris cadangan | hilang | jawaban beda huruf | pertanyaan beda huruf): $pd"
[ "$pd" = "$nlama|0|0|0" ] || { pulih; gagal "data tidak sesuai - dipulihkan"; }
r=$($MY -N < "$N-PERIKSA.sql" | tr -d '\r')
echo "PERIKSA: $r"
[ "$r" = "SEMUA COCOK" ] || { pulih; gagal "PERIKSA tidak cocok - dipulihkan"; }
echo "PRASYARAT SESUDAH: $($MY -N < "$N-PRASYARAT.sql" | tr -d '\r') (harus 1|2|0|0)"
echo "SELESAI"
