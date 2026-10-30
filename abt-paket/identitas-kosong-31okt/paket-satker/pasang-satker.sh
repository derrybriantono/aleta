#!/bin/bash
# PASANG paket ABT "abt-identitas-kosong-31okt" (31 Okt 2026) DI SERVER sebagai root, dari folder paket. HANYA variabel blangko Derry.
# Isi: fungsi baru isian_rtf_identitas_kosong + 11 variabel identitas pihak (3507, 3509, 3970, 3971, 7047, 7048, 7062, 9230, 9231,
#      11205, 11206) dibungkus fungsi itu: bagian identitas yang datanya kosong di SIPP ditulis "..." (label tetap), agama kosong = Islam,
#      tanggal "00 0000" = kosong. Kueri lama tidak disunting (PULIH = isi lama persis). Tidak ada blangko RTF yang diubah.
# URUTAN PASANG: PALING AKHIR - sesudah relaas-penetapan-30okt (11205/11206 berasal dari paket itu; PRASYARAT A memeriksa isinya)
#      dan sesudah variabel-sehat-30okt.
# Urutan: md5 paket -> PRASYARAT 11|0|0 -> cadangan baris variabel -> FUNGSI -> PASANG (satu transaksi) -> PERIKSA. Gagal = pulih.
# Laptop: ABT_LOKAL=1 ABT_DB=<basis salinan> MYSQL_BIN=<folder mysql.exe> bash pasang-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-identitas-kosong-31okt
HARAP=$(sed -n 1p harap.txt | tr -d '\r'); ULANG=$(sed -n 2p harap.txt | tr -d '\r')
NOMOR="$(grep -v '^#' nomor-variabel.txt | tr -d '\r' | paste -sd, -)"
CAD="$SINI/cadangan"
ADB="${ABT_DB:-aps_badilag}"
BIN="${MYSQL_BIN:-}"; [ -n "$BIN" ] && BIN="$BIN/"
gagal() { echo "GAGAL: $*"; exit 1; }
md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="${BIN}mysql -h $H -u root --default-character-set=latin1 $ADB"
sqlf() { sed "s/aps_badilag\./$ADB./g" "$1"; }
pulih_db() { $MY < "$N-PULIH.sql"; sqlf "$N-FUNGSI-PULIH.sql" | $MY; }
set -o pipefail
p=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r') || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
[ "$p" = "$HARAP" ] || [ "$p" = "$ULANG" ] || gagal "prasyarat '$p' (harus '$HARAP', atau '$ULANG' bila pasang ulang) - TIDAK ada yang diubah. Arti angka: lihat $N-PRASYARAT.sql"
echo "PRASYARAT COCOK ($p)"
if [ "$p" = "$HARAP" ]; then
  mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
  "${BIN}mysqldump" -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
    --complete-insert --skip-comments --skip-triggers --hex-blob --where="no_var IN ($NOMOR)" \
    "$ADB" abt_variabel > "$CAD/variabel-sebelum.$(date +%Y%m%d%H%M%S).sql" || gagal "cadangan gagal - TIDAK ada yang diubah"
  echo "CADANGAN: $CAD/variabel-sebelum.*.sql ($NOMOR)"
  sqlf "$N-FUNGSI.sql" | $MY || { pulih_db; gagal "fungsi tidak terpasang - dipulihkan"; }
  $MY < "$N-PASANG.sql" || { pulih_db; gagal "PASANG gagal (transaksi tidak di-COMMIT) - dipulihkan"; }
fi
r=$($MY -N < "$N-PERIKSA.sql" | tr -d '\r')
echo "PERIKSA: $r"
if [ "$r" != "SEMUA COCOK" ]; then
  [ "$p" = "$HARAP" ] && { pulih_db; echo "dipulihkan"; }
  gagal "PERIKSA tidak cocok"
fi
echo "PRASYARAT SESUDAH: $($MY -N < "$N-PRASYARAT.sql" | tr -d '\r') (harus $ULANG)"
echo "SELESAI - paket $N terpasang. Pulih: bash $SINI/pulih-satker.sh"
