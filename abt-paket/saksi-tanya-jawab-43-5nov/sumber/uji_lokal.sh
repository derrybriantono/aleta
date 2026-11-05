#!/bin/bash
# Uji paket di laptop atas SALINAN berkas paket (hanya berkas paket, bukan pohon utuh). Basis uji aps_badilag_vs hanya dibaca oleh PRASYARAT.
# pakai (Git Bash, mysql lewat PATH): U=<folder salinan> SEBELUM_A5K=<akar sebelum a5-kelompok-5nov> bash sumber/uji_lokal.sh <akar sesudah a5-kelompok-5nov>  -> hasil/uji-lokal.txt
set -u
cd "$(dirname "$0")/.." || exit 1
ASAL="$1"
U="${U:-${TMP:-/tmp}/uji-saksi-$$}"
P="$(pwd)/paket-satker"
export ABT_LOKAL=1 ABT_DB="${ABT_DB:-aps_badilag_vs}" PY=python
M="mysql -h 127.0.0.1 -u root --default-character-set=latin1 -N $ABT_DB"
sidik() { (cd "$1" && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32); }
salin() {
  rm -rf "$U"
  grep -v '^#' "$P/daftar-tambal.tsv" | cut -f2 | tr -d '\r' | while IFS= read -r r; do mkdir -p "$U/$(dirname "$r")"; cp "$1/$r" "$U/$r"; done
  rm -rf "$P/cadangan"
}
jalan() { ABT_BLANGKO="$U" bash "$P/$1" 2>&1 | sed 's/^/    /' | grep -v 'md5 .* bukan dasar' | sed 's#Cadangan: .*#Cadangan: (folder paket)#'; }
(cd "$P" && md5sum -c MD5SUMS.txt >/dev/null) || { echo "MD5SUMS paket tidak cocok"; exit 1; }
SATU="derry_briantono/6 Perwalian/Perwalian Anak oleh ortu kandung Kabul.rtf"
salin "$ASAL"; AWAL=$(sidik "$U"); echo "SIDIK AWAL $AWAL"
echo "== 1. pasang pertama"; jalan pasang-satker.sh
echo "== 2. pasang ulang (idempoten)"; S1=$(sidik "$U"); jalan pasang-satker.sh; [ "$(sidik "$U")" = "$S1" ] && echo "    SIDIK TETAP"
echo "== 3. pulih"; jalan pulih-satker.sh; [ "$(sidik "$U")" = "$AWAL" ] && echo "    SIDIK = AWAL"
echo "== 4. pasang lagi sesudah pulih"; jalan pasang-satker.sh | tail -2; [ "$(sidik "$U")" = "$S1" ] && echo "    SAMA DENGAN PASANG PERTAMA"
echo "== 5. satu berkas disunting -> BERHENTI tanpa ubahan"; salin "$ASAL"; printf ' ' >> "$U/$SATU"; S5=$(sidik "$U"); jalan pasang-satker.sh; [ "$(sidik "$U")" = "$S5" ] && echo "    TIDAK ADA YANG BERUBAH"
echo "== 6. a5-kelompok belum terpasang (berkas lama) -> BERHENTI tanpa ubahan"
if [ -n "${SEBELUM_A5K:-}" ]; then salin "$SEBELUM_A5K"; S6=$(sidik "$U"); jalan pasang-satker.sh | tail -3; [ "$(sidik "$U")" = "$S6" ] && echo "    TIDAK ADA YANG BERUBAH"; else echo "    (dilewati)"; fi
echo "== 7. disunting sesudah pasang lalu pulih -> dibiarkan"; salin "$ASAL"; jalan pasang-satker.sh >/dev/null; printf ' ' >> "$U/$SATU"; jalan pulih-satker.sh | tail -5
rm -rf "$U" "$P/cadangan"; echo "AKHIR"
