#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-ijab-yang-menikahkan-3nov" (3 Nov 2026, keputusan Derry 18.00). Dijalankan DI SERVER sebagai root, dari folder
# paket. HANYA blangko pengguna derry_briantono (5 penetapan Itsbat Nikah Kabul [01] [01a] [01b] [01d] [01e]).
# Isi: fakta/pertimbangan "Wali Nikah ... mengucapkan ijab ... sesaat setelah Wali Nikah ... mengucapkan ijab" diganti
#      "#8087# selaku yang menikahkan mengucapkan ijab ... sesaat setelah ijab diucapkan" (11 kalimat). Tanpa variabel, menu, fungsi,
#      tabel, atau data yang diubah; #8087# (Yang Menikahkan) sudah ada di tabel kelima blangko itu.
# Urutan: md5 paket -> CEK berkas (md5 tiap berkas PERSIS keadaan server 3 Nov 15.20; satu saja beda = BERHENTI, tidak ada yang diubah)
#         -> PASANG (cadangan utuh tiap berkas di cadangan/rtf-lama, tulis atomik, baca ulang) -> PERIKSA. Gagal = pulih otomatis.
# Laptop: ABT_BLANGKO=<_blangko_abt uji> PY=python bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-ijab-yang-menikahkan-3nov
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
PY="${PY:-python}"
gagal() { echo "GAGAL: $*"; exit 1; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
[ -d "$B/derry_briantono/2 Itsbat Nikah" ] || gagal "folder $B/derry_briantono/2 Itsbat Nikah tidak ada - TIDAK ada yang diubah"

# --- 1. PRASYARAT = md5 berkas (baca saja) ----------------------------------------------------------------------------
c=$($PY tambal_rtf.py cek "$B"); echo "$c"
[ "$(echo "$c" | tail -1 | tr -d '\r')" = "BERKAS SIAP" ] || gagal "berkas tujuan tidak sama dengan keadaan server 3 Nov 15.20 - TIDAK ada yang diubah"
echo "PRASYARAT COCOK"

# --- 2. PASANG ----------------------------------------------------------------------------------------------------------
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
$PY tambal_rtf.py pasang "$B" "$CAD" > "$CAD/berkas-pasang.txt"
if [ "$?" != "0" ]; then
  cat "$CAD/berkas-pasang.txt"
  $PY tambal_rtf.py pulih "$B" "$CAD"
  gagal "berkas tidak terpasang - dikembalikan (lihat $CAD/berkas-pasang.txt)"
fi
tail -1 "$CAD/berkas-pasang.txt"

# --- 3. PERIKSA ---------------------------------------------------------------------------------------------------------
$PY tambal_rtf.py periksa "$B" > "$CAD/berkas-periksa.txt"
tail -1 "$CAD/berkas-periksa.txt"
if [ "$(tail -1 "$CAD/berkas-periksa.txt" | tr -d '\r')" != "BERKAS COCOK" ]; then
  $PY tambal_rtf.py pulih "$B" "$CAD"
  gagal "periksa berkas tidak cocok - berkas dikembalikan"
fi
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
