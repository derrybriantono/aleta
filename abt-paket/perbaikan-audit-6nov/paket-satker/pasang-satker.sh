#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-perbaikan-audit-6nov" (keputusan Derry, 6 Nov 2026). Dijalankan DI SERVER sebagai root, dari folder paket.
# HANYA blangko pengguna derry_briantono: 104 berkas disunting per potongan + 1 berkas BARU (BAS ALUR 10 [4]). Tanpa variabel baru, fungsi, menu, tabel, atau data.
# URUTAN PASANG: SESUDAH a5-merah-5nov, a5-kelompok-5nov, saksi-tanya-jawab-43-5nov (md5 berkas = keadaan sesudah paket-paket itu) dan prodeo-8507-5nov (rumus 8507).
# Urutan: md5 paket -> PRASYARAT SQL (baca saja) -> CEK berkas -> PASANG (cadangan utuh, tulis atomik, baca ulang) -> PERIKSA. Gagal = pulih otomatis.
# Laptop: ABT_LOKAL=1 ABT_DB=<basis ABT uji> ABT_BLANGKO=<_blangko_abt uji> PY=python bash pasang-satker.sh  (mysql lewat PATH)
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-perbaikan-audit-6nov
HARAP="$(sed -n 1p harap.txt | tr -d '\r')"
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
ADB="${ABT_DB:-aps_badilag}"
PY="${PY:-python}"
gagal() { echo "GAGAL: $*"; exit 1; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
[ -d "$B/derry_briantono" ] || gagal "folder $B/derry_briantono tidak ada - TIDAK ada yang diubah"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"

p=$($MY -N < "$N-PRASYARAT.sql") || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
p=$(echo "$p" | tr -d '\r')
[ "$p" = "$HARAP" ] || gagal "prasyarat '$p' (harus '$HARAP'): variabel yang dirujuk atau rumus 9100/8509 tidak sama dengan dasar paket, atau a5-kelompok-5nov / saksi-tanya-jawab-43-5nov belum terpasang - TIDAK ada yang diubah. Arti angka: lihat $N-PRASYARAT.sql"
echo "PRASYARAT COCOK ($p)"
c=$($PY tambal_rtf.py cek "$B"); echo "$c" | tail -20
[ "$(echo "$c" | tail -1 | tr -d '\r')" = "BERKAS SIAP" ] || gagal "berkas tujuan tidak sama dengan keadaan server sesudah saksi-tanya-jawab-43-5nov - TIDAK ada yang diubah"

mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
$PY tambal_rtf.py pasang "$B" "$CAD" > "$CAD/berkas-pasang.txt"
if [ "$?" != "0" ]; then
  tail -5 "$CAD/berkas-pasang.txt"; $PY tambal_rtf.py pulih "$B" "$CAD" >/dev/null 2>&1
  gagal "berkas RTF tidak terpasang - dikembalikan (lihat $CAD/berkas-pasang.txt)"
fi
tail -1 "$CAD/berkas-pasang.txt"
$PY tambal_rtf.py periksa "$B" > "$CAD/berkas-periksa.txt"
tail -1 "$CAD/berkas-periksa.txt"
if [ "$(tail -1 "$CAD/berkas-periksa.txt" | tr -d '\r')" != "BERKAS COCOK" ]; then
  $PY tambal_rtf.py pulih "$B" "$CAD" >/dev/null 2>&1
  gagal "periksa berkas tidak cocok - dikembalikan"
fi
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
