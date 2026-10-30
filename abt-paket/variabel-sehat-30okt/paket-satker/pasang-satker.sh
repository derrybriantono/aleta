#!/bin/bash
# PASANG paket ABT "abt-variabel-sehat-30okt" (30-31 Okt 2026) DI SERVER sebagai root, dari folder paket. HANYA variabel blangko Derry.
# Isi: 3 variabel yang terbukti bermasalah pada pindai 169 perkara (tidak ada variabel baru, tidak ada blangko RTF yang diubah):
#      4303 (itsbat Pasal 7 ayat (3) KHI: isian Tgl Nikah "pada ..."/berakhir tanda baca tercetak "terjadi pada pada ..."/"1975; .")
#      9292, 9293 (alamat amplop relaas + kode pos: "Domisili Eletronik:" tidak dikenali -> kode pos tersisip sebelum email).
# URUTAN PASANG: PALING AKHIR - sesudah semua paket 29-30 Okt (md5 PRASYARAT = keadaan sesudah semuanya; tidak ada paket 29-30 Okt
#      lain yang mengubah 4303/9292/9293, jadi urutan terhadap paket itu sebenarnya bebas).
# Urutan: md5 paket -> PRASYARAT 3|0 -> cadangan baris variabel (mysqldump) -> PASANG (satu transaksi) -> PERIKSA. Gagal = pulih.
# Laptop: ABT_LOKAL=1 ABT_DB=<basis salinan> MYSQL_BIN=<folder mysql.exe> bash pasang-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-variabel-sehat-30okt
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
  $MY < "$N-PASANG.sql" || gagal "PASANG gagal (transaksi tidak di-COMMIT) - TIDAK ada yang diubah"
fi
r=$($MY -N < "$N-PERIKSA.sql" | tr -d '\r')
echo "PERIKSA: $r"
if [ "$r" != "SEMUA COCOK" ]; then
  [ "$p" = "$HARAP" ] && { $MY < "$N-PULIH.sql"; echo "dipulihkan"; }
  gagal "PERIKSA tidak cocok"
fi
echo "PRASYARAT SESUDAH: $($MY -N < "$N-PRASYARAT.sql" | tr -d '\r') (harus $ULANG)"
echo "SELESAI - paket $N terpasang. Pulih: bash $SINI/pulih-satker.sh"
