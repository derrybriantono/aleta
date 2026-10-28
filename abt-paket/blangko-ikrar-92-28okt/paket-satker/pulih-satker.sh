#!/bin/bash
# PULIH paket ABT "abt-blangko-ikrar-92-28okt" (28 Okt 2026): dua blangko baru dihapus HANYA bila md5-nya masih isi paket
# (yang sudah disunting sesudah dipasang dibiarkan dan dilaporkan). Tidak ada baris basis data yang disentuh.
# Baris terakhir harus "PULIH COCOK". Laptop: ABT_BLANGKO=<_blangko_abt uji> bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
PY="${PY:-python}"
mkdir -p "$CAD"
h=$($PY berkas_rtf.py pulih "$B" "$CAD"); echo "$h"
[ "$(echo "$h" | tail -1 | tr -d '\r')" = "BERKAS PULIH" ] && echo "PULIH COCOK" || { echo "PULIH SEBAGIAN - lihat di atas"; exit 1; }
