#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-keputusan-a-mekanis-4nov" (keputusan Derry 182/184, 4 Nov 2026). Dijalankan DI SERVER sebagai root, dari folder
# paket. HANYA blangko pengguna derry_briantono. Tambalan atas teks blangko (lihat PASANG.md):
#   A6 "#8555# <pemutus>" -> "#8554#" (4 putusan CG/CT) | A11 #0690# -> #8554#, #4004# -> #8555# di putusan/penetapan non-BAS (106 berkas)
#   A3 catatan kerja "(apabila tau ...)" dibuang | E2 "untuk mendapatkan Buku Nikah" -> "untuk #8171#" | A13 "isteri" -> "istri" (kalimat buatan
#   blangko, kutipan dibiarkan) dan "c/q Majelis #8554#" -> "c/q #8554#".
# Tanpa variabel, menu, fungsi, tabel, atau data yang diubah.
# Urutan: md5 paket -> CEK berkas (md5 tiap berkas PERSIS keadaan server sesudah ijab-yang-menikahkan-3nov + audit-mekanis-4nov +
#         audit-ejaan-4nov; satu saja beda = BERHENTI, tidak ada yang diubah) -> PASANG (cadangan utuh tiap berkas di cadangan/rtf-lama,
#         tulis atomik, baca ulang) -> PERIKSA. Gagal = pulih otomatis.
# Laptop: ABT_BLANGKO=<_blangko_abt uji> PY=python bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-keputusan-a-mekanis-4nov
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
PY="${PY:-python}"
gagal() { echo "GAGAL: $*"; exit 1; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
[ -d "$B/derry_briantono" ] || gagal "folder $B/derry_briantono tidak ada - TIDAK ada yang diubah"

# --- 1. PRASYARAT = md5 berkas (baca saja) ----------------------------------------------------------------------------
c=$($PY tambal_rtf.py cek "$B"); echo "$c" | tail -20
[ "$(echo "$c" | tail -1 | tr -d '\r')" = "BERKAS SIAP" ] || gagal "berkas tujuan tidak sama dengan keadaan server sesudah ijab-yang-menikahkan-3nov + audit-mekanis-4nov + audit-ejaan-4nov - TIDAK ada yang diubah"
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
