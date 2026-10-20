#!/bin/bash
# =============================================================================
# PASANG paket susulan "u2b-cerai-susulan" di SATKER (dijalankan DI SERVER, sebagai root, dari folder paket ini).
# Menambal blangko BAS verstek di folder ALUR 02/03/06 yang dilewati paket u2 (variabel 4138 disisipkan sebelum #8505#).
# TIDAK memasang/mengubah variabel (4100-4150 sudah dipasang paket u2; hanya dibaca).
# Urutan: md5 paket -> prasyarat variabel (baca saja) -> praperiksa berkas (md5 persis + jangkar tepat; tidak menulis) ->
#         tambal (cadangan utuh dulu, md5 hasil dibaca ulang) -> periksa ulang (semua SUDAH).
# Satu berkas saja yang md5-nya beda dari yang diperiksa = GAGAL SEBELUM menulis apa pun.
# Laptop (uji): ABT_LOKAL=1 ABT_BLANGKO=<salinan derry_briantono> bash pasang-satker.sh   (tanpa DB)
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt/derry_briantono}"
CAD="$SINI/cadangan"
PERL="${PERL:-perl}"
N=$(grep -c . rtf-daftar-tambal.tsv)
gagal() { echo "GAGAL: $*"; exit 1; }
md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "berkas paket rusak (md5sum -c MD5SUMS.txt) - salin ulang dengan scp, bukan editor"
[ -d "$B" ] || gagal "folder blangko $B tidak ada"
[ -e "$CAD/pasang.selesai" ] && gagal "paket ini sudah pernah dipasang ($CAD) - jalankan pulih-satker.sh dulu bila ingin mengulang"

if [ "${ABT_LOKAL:-}" != 1 ]; then
  if [ -z "${MYSQL_PWD:-}" ]; then
    MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
    export MYSQL_PWD
  fi
  MY="mysql -h 127.0.0.1 -u root --default-character-set=latin1 aps_badilag"
  p=$($MY -N < abt-u2b-PRASYARAT.sql) || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
  [ "$p" = "35|1|1" ] || gagal "prasyarat '$p' (harus '35|1|1': paket u2 terpasang) - TIDAK ada yang diubah"
  echo "PRASYARAT COCOK ($p)"
fi

mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
echo "== 1. praperiksa berkas (tidak menulis apa pun)"
$PERL tambal-rtf.pl periksa "$B" "$CAD" > "$CAD/periksa-sebelum.txt" || gagal "praperiksa galat (lihat $CAD/periksa-sebelum.txt)"
tail -n 15 "$CAD/periksa-sebelum.txt"
r=$(tail -1 "$CAD/periksa-sebelum.txt")
case "$r" in
  "RINGKAS COCOK=$N SUDAH=0 LEWAT=0") ;;
  "RINGKAS COCOK=0 SUDAH=$N LEWAT=0") echo "SEMUA SUDAH TERPASANG - tidak ada yang dilakukan"; exit 0 ;;
  *) gagal "praperiksa '$r' (harus COCOK=$N SUDAH=0 LEWAT=0 atau COCOK=0 SUDAH=$N LEWAT=0) - TIDAK ada yang diubah; berkas LEWAT: lihat di atas" ;;
esac

echo "== 2. tambal blangko RTF (cadangan utuh dulu)"
if ! $PERL tambal-rtf.pl pasang "$B" "$CAD" > "$CAD/tambal-hasil.txt"; then
  tail -n 6 "$CAD/tambal-hasil.txt"
  echo "tambal gagal - memulihkan"; $PERL tambal-rtf.pl pulih "$B" "$CAD" | tail -n 3
  gagal "tambal dibatalkan dan dipulihkan"
fi
tail -n 6 "$CAD/tambal-hasil.txt"
echo "== 3. periksa ulang (semua harus SUDAH)"
$PERL tambal-rtf.pl periksa "$B" "$CAD" > "$CAD/periksa-sesudah.txt"
tail -n 3 "$CAD/periksa-sesudah.txt"
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "RINGKAS COCOK=0 SUDAH=$N LEWAT=0" ]; then
  echo "periksa ulang tidak cocok - memulihkan"; $PERL tambal-rtf.pl pulih "$B" "$CAD" | tail -n 3
  gagal "dibatalkan dan dipulihkan"
fi
touch "$CAD/pasang.selesai"
echo "SELESAI - paket u2b-cerai-susulan terpasang ($N berkas). Cadangan untuk pulih: $CAD"
