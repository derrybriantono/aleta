#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-audit-mekanis-4nov" (audit A3 4 Nov 2026, disetujui Derry). Dijalankan DI SERVER sebagai root, dari folder
# paket. HANYA blangko pengguna derry_briantono. Tambalan MEKANIS atas teks blangko (lihat PASANG.md):
#   K01 "#8554# Hakim" -> "#8554#" | K09 "Penetapan Hakim #4004#" -> "Penetapan #4004#" | K13 "isbat" -> "itsbat"
#   K06 salah ketik jelas | S01 identitas saksi ke-2 -> variabel saksi ke-2. (Ejaan baku K07 = paket audit-ejaan-4nov, SESUDAH ini.)
# Tanpa variabel, menu, fungsi, tabel, atau data yang diubah.
# Urutan: md5 paket -> CEK berkas (md5 tiap berkas PERSIS keadaan server sesudah saksi-rapi-3nov + in-lupa-prosesi-3nov +
#         ijab-yang-menikahkan-3nov; satu saja beda = BERHENTI, tidak ada yang diubah) -> PASANG (cadangan utuh tiap berkas di
#         cadangan/rtf-lama, tulis atomik, baca ulang) -> PERIKSA. Gagal = pulih otomatis.
# Laptop: ABT_BLANGKO=<_blangko_abt uji> PY=python bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-audit-mekanis-4nov
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
PY="${PY:-python}"
gagal() { echo "GAGAL: $*"; exit 1; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
[ -d "$B/derry_briantono" ] || gagal "folder $B/derry_briantono tidak ada - TIDAK ada yang diubah"

# --- 1. PRASYARAT = md5 berkas (baca saja) ----------------------------------------------------------------------------
c=$($PY tambal_rtf.py cek "$B"); echo "$c" | tail -20
[ "$(echo "$c" | tail -1 | tr -d '\r')" = "BERKAS SIAP" ] || gagal "berkas tujuan tidak sama dengan keadaan server sesudah paket ijab-yang-menikahkan-3nov - TIDAK ada yang diubah"
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
