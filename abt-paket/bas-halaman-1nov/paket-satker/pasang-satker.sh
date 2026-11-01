#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-bas-halaman-1nov" (1 Nov 2026, keputusan pengguna 71). Dijalankan DI SERVER sebagai root, dari folder paket.
# HANYA blangko BAS derry_briantono yang kaki halamannya belum bernomor: field PAGE (rata kanan bawah, 12 pt, huruf judul) ditambahkan di
# kaki halaman (daftar-tambal.tsv + tambal.tsv). Isi lain, variabel, menu, dan data TIDAK diubah. Nomor halaman AWAL tiap BAS diatur
# portal saat cetak/unduh/unggah (halaman runut), bukan di blangko.
# URUTAN PASANG: KE-27, PALING AKHIR - sesudah teks-pihak-1nov (md5 dasar = keadaan SESUDAH 26 paket ../URUTAN-PASANG-1nov.md).
# Tahap: md5 paket -> PRASYARAT (cek md5 tiap berkas, baca saja) -> PASANG (berkas lama dicadangkan dulu) -> PERIKSA -> gagal = PULIH otomatis.
# Laptop: ABT_BLANGKO=<_blangko_abt uji> PY=python bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-bas-halaman-1nov
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
PY="${PY:-python}"
gagal() { echo "GAGAL: $*"; exit 1; }
md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
# --- 1. PRASYARAT (baca saja): tiap berkas md5 = keadaan sesudah 26 paket (SIAP) atau sudah terpasang (SUDAH) -----------------
c=$($PY tambal_rtf.py cek "$B"); echo "$c" | tail -3
[ "$(echo "$c" | tail -1)" = "BERKAS SIAP" ] || gagal "PRASYARAT: berkas tujuan tidak sesuai (pasang 26 paket sebelumnya dulu?) - TIDAK ada yang diubah"
echo "PRASYARAT COCOK ($(echo "$c" | tail -2 | head -1))"
# --- 2. PASANG (berkas lama disalin ke cadangan/rtf-lama sebelum ditimpa) ------------------------------------------------------
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
$PY tambal_rtf.py pasang "$B" "$CAD" > "$CAD/berkas-pasang.txt" || { tail -5 "$CAD/berkas-pasang.txt"; $PY tambal_rtf.py pulih "$B" "$CAD"; gagal "PASANG: berkas tidak terpasang - dikembalikan"; }
tail -1 "$CAD/berkas-pasang.txt"
# --- 3. PERIKSA ------------------------------------------------------------------------------------------------------------------
$PY tambal_rtf.py periksa "$B" > "$CAD/berkas-periksa.txt"
tail -1 "$CAD/berkas-periksa.txt"
[ "$(tail -1 "$CAD/berkas-periksa.txt" | tr -d '\r')" = "BERKAS COCOK" ] || { $PY tambal_rtf.py pulih "$B" "$CAD"; gagal "PERIKSA berkas tidak cocok - dikembalikan (PULIH)"; }
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
