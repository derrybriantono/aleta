#!/bin/bash
# PASANG paket ABT "abt-ket-saksi-kata-30okt" (30 Okt 2026) DI SERVER sebagai root, dari folder paket.
# Isi: fungsi baru isian_rtf_ganti_kata + isian_rtf_ket_saksi diganti (nama/tanda tangan sama; hanya 'saya'/'ya, '
#      diganti sebagai kata utuh, "Iya, " di awal jawaban dibuang). Tidak ada variabel, blangko, atau isian yang diubah.
# Urutan: md5 paket -> PRASYARAT -> cadangan definisi -> FUNGSI -> PERIKSA. Gagal sesudah FUNGSI = pulih otomatis.
# Laptop: ABT_LOKAL=1 ABT_DB=<basis salinan> bash pasang-satker.sh (nama basis di fungsi: sed aps_badilag. -> basis salinan)
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-ket-saksi-kata-30okt
HARAP=$(sed -n 1p harap.txt); ULANG=$(sed -n 2p harap.txt)
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
sqlf() { if [ "$ADB" = aps_badilag ]; then cat "$1"; else sed "s/aps_badilag\\./$ADB./g" "$1"; fi; }
set -o pipefail
p=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r') || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
[ "$p" = "$HARAP" ] || [ "$p" = "$ULANG" ] || gagal "prasyarat '$p' (harus '$HARAP', atau '$ULANG' bila pasang ulang) - TIDAK ada yang diubah"
echo "PRASYARAT COCOK ($p)"
mkdir -p "$CAD"
if [ "$p" = "$HARAP" ]; then
  $MY -N -e "SHOW CREATE FUNCTION isian_rtf_ket_saksi\G" > "$CAD/ket-saksi-sebelum.$(date +%Y%m%d%H%M%S).txt" || gagal "cadangan definisi gagal - TIDAK ada yang diubah"
  echo "CADANGAN: $CAD/ket-saksi-sebelum.*.txt"
  if ! sqlf "$N-FUNGSI.sql" | $MY > "$CAD/fungsi.log" 2>&1; then
    tail -3 "$CAD/fungsi.log"; sqlf "$N-FUNGSI-LAMA.sql" | $MY; gagal "fungsi tidak bisa dibuat - dipulihkan ke definisi lama"
  fi
fi
r=$($MY -N < "$N-PERIKSA.sql" | tr -d '\r')
echo "PERIKSA: $r"
if [ "$r" != "SEMUA COCOK" ]; then
  [ "$p" = "$HARAP" ] && { sqlf "$N-FUNGSI-LAMA.sql" | $MY; echo "dipulihkan"; }
  gagal "PERIKSA tidak cocok"
fi
echo "PRASYARAT SESUDAH: $($MY -N < "$N-PRASYARAT.sql" | tr -d '\r') (harus $ULANG)"
echo "SELESAI"
