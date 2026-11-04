#!/bin/bash
# Uji paket keputusan-a-rekonvensi-4nov di laptop atas SALINAN pohon keadaan server SESUDAH keputusan-a-kerangka-4nov. Basis ABT uji
# aps_badilag_w206 (salinan server 3 Nov); variabel 9266-9269 dipasang dari paket kerangka untuk uji lalu dihapus lagi.
# pakai (Git Bash): U=<folder salinan> SEBELUM_MEKANIS=<pohon dasar tanpa paket mekanis> bash sumber/uji_lokal.sh <akar _blangko_abt sesudah kerangka>
#   -> hasil/uji-lokal.txt
set -u
cd "$(dirname "$0")/.." || exit 1
ASAL="$1"
export TMP='D:\Aplikasi\aleta\tmp' TEMP='D:\Aplikasi\aleta\tmp'
X="/d/Satker Asal/Website PA Bungku/xampp/mysql/bin"; export PATH="$X:$PATH"
export ABT_LOKAL=1 ABT_DB="${ABT_DB:-aps_badilag_w206}" MYSQL_BIN= PY=python
U="${U:-/d/Aplikasi/aleta/tmp/uji-keputusan-a-rekonvensi-$$}"
P="$(pwd)/paket-satker"
KER="$(pwd)/../keputusan-a-kerangka-4nov/paket-satker/abt-keputusan-a-kerangka-4nov-PASANG.sql"
my() { mysql -h 127.0.0.1 -u root --default-character-set=latin1 -N "$ABT_DB" "$@"; }
sidik() { (cd "$1" && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32); }
salin() { rm -rf "$U"; mkdir -p "$U"; cp -r "$1/derry_briantono" "$U/"; rm -rf "$P/cadangan"; }
jalan() { ABT_BLANGKO="$U" bash "$P/$1" 2>&1 | sed 's/^/    /'; }
(cd "$P" && md5sum -c MD5SUMS.txt >/dev/null) || { echo "MD5SUMS paket tidak cocok"; exit 1; }
my -e "DELETE FROM abt_variabel WHERE no_var BETWEEN 9266 AND 9269" >/dev/null
my < "$KER"
AWAL=$(sidik "$ASAL")
echo "SIDIK AWAL $AWAL"
echo "== 1. pasang pertama"; salin "$ASAL"; jalan pasang-satker.sh
S1=$(sidik "$U"); (cd "$U" && python -B "$P/tambal_rtf.py" periksa "$U" | tail -1 | sed 's/^/    periksa: /')
echo "== 2. pasang ulang (idempoten)"; jalan pasang-satker.sh; [ "$(sidik "$U")" = "$S1" ] && echo "    SIDIK TETAP"
echo "== 3. pulih"; jalan pulih-satker.sh; [ "$(sidik "$U")" = "$AWAL" ] && echo "    SIDIK = AWAL"
echo "== 4. pasang lagi sesudah pulih"; jalan pasang-satker.sh | tail -2; [ "$(sidik "$U")" = "$S1" ] && echo "    SAMA DENGAN PASANG PERTAMA"
echo "== 5. md5 berkas berbeda (berkas disunting) -> BERHENTI tanpa ubahan"; salin "$ASAL"
printf ' ' >> "$U/derry_briantono/1a Perceraian CT/[02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).rtf"; S5=$(sidik "$U")
jalan pasang-satker.sh | grep -v '^    GAGAL	'; [ "$(sidik "$U")" = "$S5" ] && echo "    TIDAK ADA YANG BERUBAH"
echo "== 6. keputusan-a-mekanis belum terpasang (berkas keadaan dasar) -> BERHENTI tanpa ubahan"
if [ -n "${SEBELUM_MEKANIS:-}" ] && [ -d "$SEBELUM_MEKANIS/derry_briantono" ]; then
  salin "$SEBELUM_MEKANIS"; S6=$(sidik "$U")
  jalan pasang-satker.sh | grep -v '^    GAGAL	'; [ "$(sidik "$U")" = "$S6" ] && echo "    TIDAK ADA YANG BERUBAH"
else
  echo "    (dilewati: SEBELUM_MEKANIS tidak diberikan)"
fi
echo "== 7. keputusan-a-kerangka belum terpasang (variabel 9268/9269 tidak ada) -> BERHENTI tanpa ubahan"; salin "$ASAL"
my -e "DELETE FROM abt_variabel WHERE no_var BETWEEN 9266 AND 9269" >/dev/null
S7=$(sidik "$U"); jalan pasang-satker.sh; [ "$(sidik "$U")" = "$S7" ] && echo "    TIDAK ADA YANG BERUBAH"
echo "== 8. disunting sesudah pasang lalu pulih -> dibiarkan"; my < "$KER"; salin "$ASAL"; jalan pasang-satker.sh >/dev/null
printf ' ' >> "$U/derry_briantono/1a Perceraian CT/[02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).rtf"; jalan pulih-satker.sh | grep -v '^    GAGAL	'
my -e "DELETE FROM abt_variabel WHERE no_var BETWEEN 9266 AND 9269" >/dev/null
rm -rf "$U" "$P/cadangan"
