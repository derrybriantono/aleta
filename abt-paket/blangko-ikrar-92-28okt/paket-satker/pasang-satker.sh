#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-blangko-ikrar-92-28okt" (28 Okt 2026, keputusan pengguna P4a). Dijalankan DI SERVER sebagai root, dari folder paket.
# Isi: 2 blangko Derry BARU di folder yang SUDAH ADA derry_briantono/1a Perceraian CT (menu "Putusan Cerai Talak"):
#   [92]  [Ikrar Rukun] Penetapan Rukun Kembali - P Hadir & T Tidak Hadir.rtf
#   [92a] [Ikrar Rukun] Penetapan Rukun Kembali - P & T Hadir.rtf
# Tidak ada variabel, menu, atau berkas lama yang diubah (ABT membaca isi folder saat dibuka).
# Urutan: md5 -> folder ada -> PRASYARAT SQL (baca saja: 27 variabel yang dirujuk ada) -> cek berkas -> pasang -> periksa.
# Gagal sesudah pasang = pulih otomatis (berkas baru dihapus HANYA bila md5-nya masih isi paket).
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_ikrar ABT_BLANGKO=<_blangko_abt uji> bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-blangko-ikrar-92-28okt
HARAP='27'
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
ADB="${ABT_DB:-aps_badilag}"
PY="${PY:-python}"
gagal() { echo "GAGAL: $*"; exit 1; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
while IFS= read -r f; do
  [ -d "$B/$f" ] || gagal "folder blangko $B/$f tidak ada - TIDAK ada yang diubah"
done < <(grep -v '^#' folder-ada.txt)
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MYSQL="${MYSQL_BIN:-mysql}"
MY="$MYSQL -h $H -u root --default-character-set=latin1 $ADB"

# --- 1. PRASYARAT (baca saja) -------------------------------------------------------------------------------------------
p=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r') || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
[ "$p" = "$HARAP" ] || gagal "prasyarat '$p' (harus '$HARAP' = semua variabel yang dirujuk ada; lihat nomor-dirujuk.txt) - TIDAK ada yang diubah"
echo "PRASYARAT COCOK ($p)"
c=$($PY berkas_rtf.py cek "$B"); echo "$c"
[ "$(echo "$c" | tail -1 | tr -d '\r')" = "BERKAS SIAP" ] || gagal "berkas tujuan tidak sesuai - TIDAK ada yang diubah"

# --- 2. BERKAS RTF + PERIKSA ---------------------------------------------------------------------------------------------
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
$PY berkas_rtf.py pasang "$B" "$SINI" "$CAD" | tee "$CAD/berkas-pasang.txt"
if [ "${PIPESTATUS[0]}" != "0" ]; then
  $PY berkas_rtf.py pulih "$B" "$CAD"
  gagal "berkas RTF tidak terpasang - berkas baru dikembalikan (lihat $CAD/berkas-pasang.txt)"
fi
$PY berkas_rtf.py periksa "$B" "$CAD" | tee "$CAD/berkas-periksa.txt"
if [ "$(tail -1 "$CAD/berkas-periksa.txt" | tr -d '\r')" != "BERKAS COCOK" ]; then
  $PY berkas_rtf.py pulih "$B" "$CAD"
  gagal "periksa berkas tidak cocok - berkas baru dikembalikan"
fi
echo "SELESAI - paket $N terpasang. Pulih: bash $SINI/pulih-satker.sh"
