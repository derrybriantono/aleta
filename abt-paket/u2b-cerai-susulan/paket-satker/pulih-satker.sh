#!/bin/bash
# PULIH paket susulan u2b-cerai-susulan di SATKER: kembalikan blangko RTF dari cadangan, HANYA berkas yang md5-nya masih persis hasil paket
# (yang sudah disunting sesudahnya dibiarkan dan dilaporkan). Tidak menyentuh variabel (paket ini tidak memasang variabel).
# Laptop (uji): ABT_BLANGKO=<salinan derry_briantono> bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
CAD="$(pwd)/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt/derry_briantono}"
PERL="${PERL:-perl}"
[ -d "$B" ] || { echo "GAGAL: folder blangko $B tidak ada"; exit 1; }
[ -s "$CAD/rtf-ditambal.txt" ] || { echo "GAGAL: tidak ada $CAD/rtf-ditambal.txt (paket belum dipasang atau sudah dipulihkan)"; exit 1; }
$PERL tambal-rtf.pl pulih "$B" "$CAD" | tee "$CAD/pulih-hasil.txt" | tail -n 15
rm -f "$CAD/pasang.selesai"
echo "SELESAI - dipulihkan"
