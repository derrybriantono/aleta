#!/bin/bash
# PASANG paket ABT "abt-agama-belum-diubah-30okt" (30 Okt 2026, keputusan pengguna) DI SERVER sebagai root, dari folder paket.
# Isi: cabang "alasan H tetapi agama pihak di SIPP belum diubah" pada 4 variabel alasan perceraian (8521, 8522, 8528, 8531) yang
#      berbunyi "TIDAK BENAR QUERY NYA / ALASAN H: AGAMA ... BELUM DIUBAH DI SIPP - ubah ..." -> "[AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP]".
#      Cabang lain tidak disentuh. Ekstensi mengenali bunyi baru DAN lama. URUTAN: SESUDAH abt-alasan-belum-dipilih-30okt
#      (PRASYARAT selain 4|0 / 0|4 = berhenti tanpa mengubah apa pun).
# Urutan: md5 paket -> PRASYARAT 4|0 -> cadangan baris variabel (mysqldump) -> PASANG (satu transaksi) -> PERIKSA. Gagal = pulih.
# Laptop: ABT_LOKAL=1 ABT_DB=<basis salinan> bash pasang-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-agama-belum-diubah-30okt
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
set -o pipefail
p=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r') || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
[ "$p" = "$HARAP" ] || [ "$p" = "$ULANG" ] || gagal "prasyarat '$p' (harus '$HARAP', atau '$ULANG' bila pasang ulang) - TIDAK ada yang diubah"
echo "PRASYARAT COCOK ($p)"
if [ "$p" = "$HARAP" ]; then
  mkdir -p "$CAD"
  mysqldump -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
    --complete-insert --skip-comments --skip-triggers --hex-blob --where="no_var IN (8521,8522,8528,8531)" \
    "$ADB" abt_variabel > "$CAD/variabel-sebelum.$(date +%Y%m%d%H%M%S).sql" || gagal "cadangan gagal - TIDAK ada yang diubah"
  echo "CADANGAN: $CAD/variabel-sebelum.*.sql"
  $MY < "$N-PASANG.sql" || gagal "PASANG gagal (transaksi tidak di-COMMIT)"
fi
r=$($MY -N < "$N-PERIKSA.sql" | tr -d '\r')
echo "PERIKSA: $r"
if [ "$r" != "SEMUA COCOK" ]; then
  [ "$p" = "$HARAP" ] && { $MY < "$N-PULIH.sql"; echo "dipulihkan"; }
  gagal "PERIKSA tidak cocok"
fi
echo "PRASYARAT SESUDAH: $($MY -N < "$N-PRASYARAT.sql" | tr -d '\r') (harus $ULANG)"
echo "SELESAI"
