#!/bin/bash
# PULIH paket ABT "abt-kaidah-fikih-2nov" (2 Nov 2026, agen K) - deterministik, TANPA hapus permanen: berkas RTF yang ditambal paket ini
# dikembalikan dari cadangan HANYA bila isinya masih persis isi paket (yang sudah disunting orang dibiarkan dan dilaporkan).
# Baris terakhir harus "PULIH COCOK". Pulihkan paket ini SEBELUM paket sebelumnya (identitas-pihak-1nov).
# Laptop: ABT_BLANGKO=<_blangko_abt uji> PY=python bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
PY="${PY:-python}"
mkdir -p "$CAD"
r=$($PY tambal_rtf.py pulih "$B" "$CAD"); echo "$r"
if [ "$(echo "$r" | tail -1 | tr -d '\r')" = "BERKAS PULIH" ]; then echo "PULIH COCOK"; else echo "PULIH SEBAGIAN: ada berkas yang sudah disunting orang (dibiarkan, lihat di atas)"; exit 1; fi
