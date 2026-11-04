#!/bin/bash
# PULIH paket ABT "abt-keputusan-a-mekanis-4nov" (4 Nov 2026) - tanpa hapus permanen: berkas yang ditambal paket ini dikembalikan dari
# cadangan HANYA bila isinya masih persis isi paket (yang sudah disunting orang dibiarkan dan dilaporkan).
# Baris terakhir harus "PULIH COCOK".
# Laptop: ABT_BLANGKO=<_blangko_abt uji> PY=python bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
PY="${PY:-python}"
mkdir -p "$CAD"
$PY tambal_rtf.py pulih "$B" "$CAD" || { echo "GAGAL: pulih berkas"; exit 1; }
c=$($PY tambal_rtf.py cek "$B")
if [ "$(echo "$c" | tail -1 | tr -d '\r')" = "BERKAS SIAP" ] && ! echo "$c" | grep -q "SUDAH="; then echo "PULIH COCOK"; else echo "$c" | tail -20; echo "PULIH SEBAGIAN"; exit 1; fi
