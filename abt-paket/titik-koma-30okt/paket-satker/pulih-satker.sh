#!/bin/bash
# PULIH paket ABT "abt-titik-koma-30okt": isian_rtf_ket_saksi dan isian_rtf_bukti kembali ke definisi sebelum paket persis (sidik di PRASYARAT),
# isian_rtf_butir_rapi dihapus. Baris terakhir harus "PULIH COCOK". Laptop: ABT_LOKAL=1 ABT_DB=<basis salinan> bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
N=abt-titik-koma-30okt
HARAP=$(sed -n 1p harap.txt)
ADB="${ABT_DB:-aps_badilag}"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
sqlf() { if [ "$ADB" = aps_badilag ]; then cat "$1"; else sed "s/aps_badilag\\./$ADB./g" "$1"; fi; }
sqlf "$N-FUNGSI-LAMA.sql" | $MY || { echo "GAGAL: definisi lama tidak bisa dibuat"; exit 1; }
p=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r')
echo "PRASYARAT SESUDAH PULIH: $p"
[ "$p" = "$HARAP" ] && echo "PULIH COCOK" || { echo "PULIH TIDAK COCOK"; exit 1; }
