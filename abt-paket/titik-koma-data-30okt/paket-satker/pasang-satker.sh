#!/bin/bash
# PASANG paket ABT "abt-titik-koma-data-30okt" (30 Okt 2026) DI SERVER sebagai root, dari folder paket.
# DISETUJUI pengguna 30 Okt - masuk URUTAN PASANG WAJIB sesudah ket-saksi-baris-30okt dan titik-koma-30okt.
# Isi: MERAPIKAN DATA tersimpan - jawaban tanya jawab saksi yang titik komanya di tengah/ganda dirapikan dengan
#      isian_rtf_butir_rapi (";" di tengah jadi ",", tanda baca ganda/spasi). Huruf dan angka TIDAK berubah (diperiksa).
#      + pemicu ket-saksi-baris diperluas: jawaban BARU (ABT/panel) ikut dirapikan isian_rtf_butir_rapi. Tidak ada variabel,
#      blangko, atau SIPP yang diubah. Tabel BAS dicetak ABT dari data ini.
# URUTAN: sesudah titik-koma-30okt (fungsi isian_rtf_butir_rapi; PRASYARAT A).
# Urutan kerja: md5 paket -> PRASYARAT -> CADANGAN baris (mysqldump) -> rapikan (satu transaksi) -> PERIKSA. Gagal = pulih otomatis.
# Laptop: ABT_LOKAL=1 ABT_DB=<basis salinan> bash pasang-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-titik-koma-data-30okt
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
abcd=${p%|*}; nlama=${p##*|}
case "$abcd" in
  "1|2|0|0") echo "PRASYARAT COCOK ($p): $nlama jawaban akan dirapikan, pemicu diperluas" ;;
  "1|0|2|0") [ "$nlama" = 0 ] || gagal "prasyarat '$p': pemicu sudah versi paket tetapi data belum rapi - periksa manual"
             echo "PASANG ULANG ($p)"; r=$($MY -N < "$N-PERIKSA.sql" | tr -d '\r'); echo "PERIKSA: $r"; [ "$r" = "SEMUA COCOK" ] || gagal "periksa"; echo SELESAI; exit 0 ;;
  *) gagal "prasyarat '$p' (harus 1|2|0|0|N) - TIDAK ada yang diubah. A=0: pasang titik-koma-30okt dulu; B=0: pasang ket-saksi-baris-30okt dulu. Arti angka: $N-PRASYARAT.sql" ;;
esac
mkdir -p "$CAD"
[ -s "$CAD/jawaban-sebelum.sql" ] && gagal "cadangan lama $CAD/jawaban-sebelum.sql ada - jalankan pulih dulu / pindahkan, jangan timpa"
W="REPLACE(REPLACE(jawaban, CHAR(10), ' '), CHAR(13), ' ') REGEXP ';.*[[:alnum:]]|;[[:space:]]*;|^[[:space:]]*;|:[[:space:]]*;' AND jawaban LIKE '%;%' AND CHAR_LENGTH(jawaban) - CHAR_LENGTH(REPLACE(jawaban, ';', '')) > CHAR_LENGTH(isian_rtf_butir_rapi(jawaban, '')) - CHAR_LENGTH(REPLACE(isian_rtf_butir_rapi(jawaban, ''), ';', ''))"
mysqldump -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
  --complete-insert --skip-comments --skip-triggers --hex-blob --where="$W" "$ADB" abt_keterangan_saksi > "$CAD/jawaban-sebelum.sql" \
  || gagal "cadangan gagal - TIDAK ada yang diubah"
nc=$(grep -c '^REPLACE' "$CAD/jawaban-sebelum.sql")
[ "$nc" = "$nlama" ] || gagal "cadangan memuat $nc baris (harus $nlama) - TIDAK ada yang diubah"
echo "CADANGAN: $CAD/jawaban-sebelum.sql ($nc baris)"
pulih() { echo "... memulihkan"; ABT_LOKAL="${ABT_LOKAL:-}" ABT_DB="$ADB" bash "$SINI/pulih-satker.sh" 2>&1 | tail -3; }
$MY < "$N-PEMICU.sql" > "$CAD/pemicu.log" 2>&1 || { tail -3 "$CAD/pemicu.log"; pulih; gagal "pemicu tidak bisa dibuat - dipulihkan"; }
$MY < "$N-PASANG.sql" || { pulih; gagal "rapikan data gagal (transaksi tidak di-COMMIT) - dipulihkan"; }
# PERIKSA DATA: tiap baris = isian_rtf_butir_rapi(cadangan); huruf/angka sama (tanda baca, spasi, <br>, tanda butir "-" dibuang)
B="REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(IFNULL(%s,''), '<br />', ''), '<br/>', ''), '<br>', ''), '<BR />', ''), '<BR>', ''), '&nbsp;', ''), ' ', ''), ';', ''), ',', ''), '.', ''), ':', ''), '-', ''), CHAR(9), ''), CHAR(10), ''), CHAR(13), ''), CHAR(160 USING latin1), '')"
{ echo "CREATE TEMPORARY TABLE t30_lama LIKE abt_keterangan_saksi;"
  sed 's/^REPLACE INTO `abt_keterangan_saksi`/REPLACE INTO t30_lama/' "$CAD/jawaban-sebelum.sql" | grep '^REPLACE'
  echo "SELECT CONCAT_WS('|', COUNT(*), SUM(k.id IS NULL),
    SUM(NOT (BINARY IFNULL(k.jawaban,'') = BINARY IFNULL(isian_rtf_butir_rapi(l.jawaban, ''),''))),
    SUM(BINARY $(printf "$B" l.jawaban) <> BINARY $(printf "$B" k.jawaban)),
    SUM(NOT (BINARY IFNULL(k.pertanyaan,'') = BINARY IFNULL(l.pertanyaan,''))))
    FROM t30_lama l LEFT JOIN abt_keterangan_saksi k ON k.id = l.id;"
} | $MY -N | tr -d '\r' > "$CAD/periksa-data.txt"
pd=$(tail -1 "$CAD/periksa-data.txt")
echo "PERIKSA DATA (baris cadangan | hilang | bukan hasil rapi | beda huruf/angka | pertanyaan berubah): $pd"
[ "$pd" = "$nlama|0|0|0|0" ] || { pulih; gagal "data tidak sesuai - dipulihkan"; }
r=$($MY -N < "$N-PERIKSA.sql" | tr -d '\r')
echo "PERIKSA: $r"
[ "$r" = "SEMUA COCOK" ] || { pulih; gagal "PERIKSA tidak cocok - dipulihkan"; }
echo "PRASYARAT SESUDAH: $($MY -N < "$N-PRASYARAT.sql" | tr -d '\r') (harus 1|0|2|0|0)"
echo "SELESAI"
