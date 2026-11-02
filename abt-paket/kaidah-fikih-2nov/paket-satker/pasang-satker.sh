#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-kaidah-fikih-2nov" (2 Nov 2026, agen K; keputusan pengguna 104, 110 dan 120). Dijalankan DI SERVER sebagai root, dari folder paket.
# HANYA pengguna derry_briantono. HANYA berkas RTF (tanpa variabel, menu, fungsi, atau tabel):
#   A. kaidah fikih / dalil syar'i yang lazim ditambahkan ke blangko putusan/penetapan akhir yang belum memuatnya (paragraf baru, daftar-tambal.tsv + tambal.tsv);
#   B. Izin Poligami [01b] (Termohon Keberatan): syarat berlaku adil = Pasal 58 ayat (1) huruf b KHI jo. Pasal 5 ayat (1) huruf c UU 1/1974 (keputusan 120).
# Pasal 119 ayat (2) KHI tidak disentuh.
# URUTAN PASANG: KE-32, PALING AKHIR - sesudah identitas-pihak-1nov (md5 dasar = keadaan SESUDAH 31 paket ../URUTAN-PASANG-1nov.md).
# Urutan: md5 paket -> CEK berkas (baca saja) -> PASANG berkas (cadangan dulu, atomik) -> PERIKSA berkas. Gagal = berkas dikembalikan.
# Laptop: ABT_BLANGKO=<_blangko_abt uji> PY=python bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-kaidah-fikih-2nov
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
PY="${PY:-python}"
gagal() { echo "GAGAL: $*"; exit 1; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
[ -d "$B/derry_briantono" ] || gagal "folder $B/derry_briantono tidak ada - TIDAK ada yang diubah"

# --- 1. PRASYARAT berkas (baca saja) ------------------------------------------------------------------------------------
c=$($PY tambal_rtf.py cek "$B"); echo "$c" | tail -3
[ "$(echo "$c" | tail -1)" = "BERKAS SIAP" ] || gagal "berkas tujuan tidak sesuai md5 dasar (paket sebelumnya belum terpasang / disunting orang) - TIDAK ada yang diubah"
echo "$c" | grep -q '^SUDAH=[0-9]*$' && { echo "SUDAH TERPASANG - tidak ada yang diubah"; }

# --- 2. PASANG berkas (cadangan utuh tiap berkas sebelum ditimpa) --------------------------------------------------------
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
$PY tambal_rtf.py pasang "$B" "$CAD" > "$CAD/berkas-pasang.txt"
if [ "$?" != "0" ]; then
  tail -5 "$CAD/berkas-pasang.txt"
  $PY tambal_rtf.py pulih "$B" "$CAD"
  gagal "berkas RTF tidak terpasang - berkas dikembalikan (lihat $CAD/berkas-pasang.txt)"
fi
tail -1 "$CAD/berkas-pasang.txt"

# --- 3. PERIKSA ----------------------------------------------------------------------------------------------------------
$PY tambal_rtf.py periksa "$B" > "$CAD/berkas-periksa.txt"
tail -1 "$CAD/berkas-periksa.txt"
if [ "$(tail -1 "$CAD/berkas-periksa.txt" | tr -d '\r')" != "BERKAS COCOK" ]; then
  $PY tambal_rtf.py pulih "$B" "$CAD"
  gagal "periksa berkas tidak cocok - berkas dikembalikan"
fi
echo "SELESAI - paket $N terpasang ($(grep -vc '^#' daftar-tambal.tsv) blangko). Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
