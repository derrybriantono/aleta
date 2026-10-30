#!/bin/bash
# PULIH paket ABT "abt-bas-tanya-jawab-29okt" (29 Okt 2026): blangko RTF dikembalikan dari cadangan/rtf-lama HANYA bila md5
# berkas sekarang masih persis hasil tambal paket (berkas yang sudah disunting orang sesudah dipasang dibiarkan dan dilaporkan).
# Tidak ada basis data yang perlu dipulihkan (paket tidak mengubah basis data). Baris terakhir harus "PULIH COCOK".
# Laptop: ABT_BLANGKO=<salinan derry_briantono> bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt/derry_briantono}"
PERL="${PERL:-perl}"
NR=$(grep -c . rtf-daftar-tambal.tsv)
if [ -s "$CAD/rtf-ditambal.txt" ]; then
  $PERL tambal-rtf.pl pulih "$B" "$CAD" | tail -n 4
else
  echo "RTF: tidak ada catatan tambal di $CAD (tidak ada yang dipulihkan)"
fi
$PERL tambal-rtf.pl periksa "$B" "$CAD" > "$CAD/periksa-rtf-pulih.txt"
r=$(tail -1 "$CAD/periksa-rtf-pulih.txt")
echo "PERIKSA SESUDAH PULIH: $r"
if [ "$r" = "RINGKAS COCOK=$NR SUDAH=0 LEWAT=0" ]; then
  echo "PULIH COCOK"
else
  grep -v '^COCOK' "$CAD/periksa-rtf-pulih.txt" | head -n 10
  echo "PULIH TIDAK LENGKAP"
  exit 1
fi
