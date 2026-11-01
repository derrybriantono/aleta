#!/bin/bash
# PULIH paket ABT "abt-bas-halaman-1nov" (1 Nov 2026) - TANPA hapus permanen: berkas yang ditambal paket ini dikembalikan dari cadangan/rtf-lama
# HANYA bila isinya masih persis isi paket (yang sudah disunting orang dibiarkan, dilaporkan). Baris terakhir harus "PULIH COCOK".
# Pulihkan paket ini SEBELUM paket sebelumnya (teks-pihak-1nov).
# Laptop: ABT_BLANGKO=<_blangko_abt uji> PY=python bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
PY="${PY:-python}"
mkdir -p "$CAD"
h=$($PY tambal_rtf.py pulih "$B" "$CAD"); echo "$h" | tail -2
c=$($PY tambal_rtf.py cek "$B")
# sesudah pulih semua berkas harus kembali ke md5 dasar (SIAP), tidak ada yang masih SUDAH
if [ "$(echo "$h" | tail -1)" = "BERKAS PULIH" ] && [ "$(echo "$c" | tail -1)" = "BERKAS SIAP" ] && ! echo "$c" | grep -q "SUDAH="; then
  echo "PULIH COCOK ($(echo "$c" | tail -2 | head -1))"
else
  echo "PULIH SEBAGIAN: $(echo "$c" | tail -2 | head -1) (ada yang sudah disunting orang, dibiarkan)"; exit 1
fi
