#!/bin/bash
# Uji paket di laptop atas SALINAN pohon keadaan server SESUDAH ijab + audit-mekanis + audit-ejaan. Pohon asli tidak disentuh.
# pakai (Git Bash): U=<folder salinan> SEBELUM_EJAAN=<pohon sesudah ijab + audit-mekanis saja> bash sumber/uji_lokal.sh <akar _blangko_abt dasar>
#   -> hasil/uji-lokal.txt
set -u
cd "$(dirname "$0")/.." || exit 1
ASAL="$1"
U="${U:-${TMP:-/tmp}/uji-keputusan-a-mekanis-$$}"
P="$(pwd)/paket-satker"
sidik() { (cd "$1" && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32); }
salin() { rm -rf "$U"; mkdir -p "$U"; cp -r "$ASAL/derry_briantono" "$U/"; rm -rf "$P/cadangan"; }
jalan() { ABT_BLANGKO="$U" PY=python bash "$P/$1" 2>&1 | sed 's/^/    /'; }
(cd "$P" && md5sum -c MD5SUMS.txt >/dev/null) || { echo "MD5SUMS paket tidak cocok"; exit 1; }
AWAL=$(sidik "$ASAL")
echo "SIDIK AWAL $AWAL"
echo "== 1. pasang pertama"; salin; jalan pasang-satker.sh
SB=$(cd "$U" && python -B "$P/tambal_rtf.py" periksa "$U" | tail -1); echo "    periksa: $SB"
echo "== 2. pasang ulang (idempoten)"; S1=$(sidik "$U"); jalan pasang-satker.sh; [ "$(sidik "$U")" = "$S1" ] && echo "    SIDIK TETAP"
echo "== 3. pulih"; jalan pulih-satker.sh; [ "$(sidik "$U")" = "$AWAL" ] && echo "    SIDIK = AWAL"
echo "== 4. pasang lagi sesudah pulih"; jalan pasang-satker.sh
echo "== 5. md5 server berbeda (satu berkas disunting) -> BERHENTI tanpa ubahan"; salin
printf ' ' >> "$U/derry_briantono/2 Itsbat Nikah/[01b] [Kabul] IN Itsbat Terpadu.rtf"; S5=$(sidik "$U")
jalan pasang-satker.sh | grep -v '^    GAGAL	' ; [ "$(sidik "$U")" = "$S5" ] && echo "    TIDAK ADA YANG BERUBAH"
echo "== 6. audit-ejaan belum terpasang (pohon sebelum ejaan) -> BERHENTI tanpa ubahan"; rm -rf "$U"; mkdir -p "$U"
if [ -n "${SEBELUM_EJAAN:-}" ] && [ -d "$SEBELUM_EJAAN/derry_briantono" ]; then
  cp -r "$SEBELUM_EJAAN/derry_briantono" "$U/"; rm -rf "$P/cadangan"; S6=$(sidik "$U")
  jalan pasang-satker.sh | grep -v '^    GAGAL	' ; [ "$(sidik "$U")" = "$S6" ] && echo "    TIDAK ADA YANG BERUBAH"
else
  echo "    (dilewati: SEBELUM_EJAAN tidak diberikan)"
fi
echo "== 7. disunting sesudah pasang lalu pulih -> dibiarkan"; salin; jalan pasang-satker.sh >/dev/null
printf ' ' >> "$U/derry_briantono/2 Itsbat Nikah/[01] [Kabul] IN.rtf"; jalan pulih-satker.sh | grep -v '^    GAGAL	'
rm -rf "$U" "$P/cadangan"
