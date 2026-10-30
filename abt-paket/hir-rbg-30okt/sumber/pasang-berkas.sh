#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-titik-koma-teks-30okt" (30 Okt 2026, G6 6.2). Dijalankan DI SERVER sebagai root, dari folder paket.
# HANYA blangko derry_briantono: titik koma di TENGAH paragraf teks blangko yang salah tanda baca diganti koma (daftar-tambal.tsv + tambal.tsv).
# Tidak ada variabel/menu/data yang diubah. Berkas diganti HANYA bila md5 persis keadaan SESUDAH paket hir-rbg-30okt.
# URUTAN PASANG: SESUDAH ../hir-rbg-30okt (paling akhir).
# Laptop: ABT_BLANGKO=<_blangko_abt uji> PY=python bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-titik-koma-teks-30okt
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
PY="${PY:-python}"
gagal() { echo "GAGAL: $*"; exit 1; }
md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
c=$($PY tambal_rtf.py cek "$B"); echo "$c" | tail -3
[ "$(echo "$c" | tail -1)" = "BERKAS SIAP" ] || gagal "berkas tujuan tidak sesuai (pasang hir-rbg-30okt dulu?) - TIDAK ada yang diubah"
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
$PY tambal_rtf.py pasang "$B" "$CAD" > "$CAD/berkas-pasang.txt" || { tail -5 "$CAD/berkas-pasang.txt"; $PY tambal_rtf.py pulih "$B" "$CAD"; gagal "berkas tidak terpasang - dikembalikan"; }
tail -1 "$CAD/berkas-pasang.txt"
$PY tambal_rtf.py periksa "$B" > "$CAD/berkas-periksa.txt"
tail -1 "$CAD/berkas-periksa.txt"
[ "$(tail -1 "$CAD/berkas-periksa.txt" | tr -d '\r')" = "BERKAS COCOK" ] || { $PY tambal_rtf.py pulih "$B" "$CAD"; gagal "periksa berkas tidak cocok - dikembalikan"; }
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
