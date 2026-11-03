#!/bin/bash
# Uji paket di laptop atas SALINAN pohon keadaan server SESUDAH paket audit-mekanis-4nov (cadangan 2 Nov + saksi-rapi-3nov +
# in-lupa-prosesi-3nov + ijab-yang-menikahkan-3nov + audit-mekanis-4nov). Pohon asli tidak disentuh; salinan di $U.
# pakai (Git Bash): U=<folder salinan> SEBELUM_MEKANIS=<pohon sebelum audit-mekanis> bash sumber/uji_lokal.sh <pohon sesudah audit-mekanis>
#   -> hasil/uji-lokal.txt
set -u
cd "$(dirname "$0")/.." || exit 1
ASAL="$1"
U="${U:-${TMP:-/tmp}/uji-audit-ejaan-$$}"
P="$(pwd)/paket-satker"
sidik() { (cd "$1" && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32); }
salin() { rm -rf "$U"; mkdir -p "$U"; cp -r "$2/derry_briantono" "$U/"; rm -rf "$P/cadangan"; }
jalan() { ABT_BLANGKO="$U" PY=python bash "$P/$1" 2>&1 | sed 's/^/    /'; }
(cd "$P" && md5sum -c MD5SUMS.txt >/dev/null) || { echo "MD5SUMS paket tidak cocok"; exit 1; }
F="$U/derry_briantono/2 Itsbat Nikah/[03] [Tolak] IN - Rukun Tidak Terpenuhi (Wali Tidak Sah).rtf"
AWAL=$(sidik "$ASAL")
echo "SIDIK AWAL $AWAL"
echo "== 1. pasang pertama"; salin x "$ASAL"; jalan pasang-satker.sh
echo "== 2. pasang ulang (idempoten)"; S1=$(sidik "$U"); jalan pasang-satker.sh; [ "$(sidik "$U")" = "$S1" ] && echo "    SIDIK TETAP"
echo "== 3. pulih"; jalan pulih-satker.sh; [ "$(sidik "$U")" = "$AWAL" ] && echo "    SIDIK = AWAL"
echo "== 4. pasang lagi sesudah pulih"; jalan pasang-satker.sh
echo "== 5. md5 server berbeda (satu berkas disunting) -> BERHENTI tanpa ubahan"; salin x "$ASAL"
printf ' ' >> "$F"; S5=$(sidik "$U")
jalan pasang-satker.sh | grep -v '^    GAGAL	'; [ "$(sidik "$U")" = "$S5" ] && echo "    TIDAK ADA YANG BERUBAH"
echo "== 6. paket audit-mekanis-4nov belum terpasang -> BERHENTI tanpa ubahan"
if [ -n "${SEBELUM_MEKANIS:-}" ] && [ -d "$SEBELUM_MEKANIS/derry_briantono" ]; then
  salin x "$SEBELUM_MEKANIS"; S6=$(sidik "$U")
  jalan pasang-satker.sh | grep -v '^    GAGAL	'; [ "$(sidik "$U")" = "$S6" ] && echo "    TIDAK ADA YANG BERUBAH"
else
  echo "    (dilewati: SEBELUM_MEKANIS tidak diberikan)"
fi
echo "== 7. disunting sesudah pasang lalu pulih -> dibiarkan"; salin x "$ASAL"; jalan pasang-satker.sh >/dev/null
printf ' ' >> "$F"; jalan pulih-satker.sh | grep -v '^    GAGAL	'
rm -rf "$U" "$P/cadangan"
