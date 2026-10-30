#!/bin/bash
# PULIH paket ABT "abt-bas-itsbat-varian-30okt": berkas dikembalikan dari folder terhapus ke folder asalnya HANYA bila
# md5-nya masih yang dikenal dan di asal belum ada berkas bernama sama. Baris terakhir harus "PULIH COCOK".
set -u
cd "$(dirname "$0")" || exit 1
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt/derry_briantono}"
ok=0; n=0; lewat=0
while IFS=$'\t' read -r asal tujuan md5ok; do
  [ -n "$asal" ] || continue
  n=$((n+1))
  if [ -f "$B/$asal" ] && [ ! -e "$B/$tujuan" ]; then echo "SUDAH SEMULA: $asal"; ok=$((ok+1)); continue; fi
  if [ -f "$B/$tujuan" ] && [ ! -e "$B/$asal" ]; then
    m=$(md5sum "$B/$tujuan" | cut -d' ' -f1)
    case ",$md5ok," in
      *",$m,"*) mv -n "$B/$tujuan" "$B/$asal" && [ -f "$B/$asal" ] && { echo "DIKEMBALIKAN: $asal"; ok=$((ok+1)); continue; } ;;
    esac
  fi
  echo "DILEWATI: $asal (keadaan tidak dikenal)"; lewat=$((lewat+1))
done < pindah.tsv
rmdir "$B/terhapus/2 Itsbat Nikah - BAS" 2>/dev/null || true
echo "RINGKAS PULIH=$ok DILEWATI=$lewat"
[ "$ok" = "$n" ] && echo "PULIH COCOK" || { echo "PULIH TIDAK LENGKAP"; exit 1; }
