#!/bin/bash
# PULIH paket ABT "abt-titik-koma-teks-30okt" (30 Okt 2026, G6 6.2): berkas yang ditimpa dikembalikan dari cadangan/timpa-asal HANYA bila isinya
# masih persis isi paket (yang sudah disunting orang dibiarkan dan dilaporkan); isi paket disalin ke cadangan/pulih-arsip. Tanpa hapus permanen.
set -u
cd "$(dirname "$0")" || exit 1
CAD="$(pwd)/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
PY="${PY:-python}"
mkdir -p "$CAD"
$PY tambal_rtf.py pulih "$B" "$CAD" && echo "PULIH COCOK" || { echo "PULIH SEBAGIAN (lihat di atas)"; exit 1; }
