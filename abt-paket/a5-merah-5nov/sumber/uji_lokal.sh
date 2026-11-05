#!/bin/bash
# Uji paket di laptop atas SALINAN berkas paket (hanya 65 berkas, bukan pohon utuh) dan basis uji aps_badilag_vs. Pohon dasar tidak disentuh.
# pakai (Git Bash, mysql lewat PATH): U=<folder salinan> SEBELUM_MEKANIS=<pohon sebelum keputusan-a-mekanis-4nov> bash sumber/uji_lokal.sh <akar dasar berisi derry_briantono>
#   -> hasil/uji-lokal.txt
set -u
cd "$(dirname "$0")/.." || exit 1
ASAL="$1"
U="${U:-${TMP:-/tmp}/uji-a5-$$}"
P="$(pwd)/paket-satker"
export ABT_LOKAL=1 ABT_DB="${ABT_DB:-aps_badilag_vs}" PY=python
M="mysql -h 127.0.0.1 -u root --default-character-set=latin1 -N $ABT_DB"
sidik() { (cd "$1" && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32); }
snap() { $M -e "SET SESSION group_concat_max_len=1000000000; SELECT COUNT(*), MD5(GROUP_CONCAT(CONCAT_WS('|',no_var,nama,data_type,IFNULL(sql_query,''),IFNULL(default_data,''),locked,IFNULL(modifier,'')) ORDER BY no_var)) FROM abt_variabel" | tr '\t\r' ' '; }
salin() {
  rm -rf "$U"
  grep -v '^#' "$P/daftar-tambal.tsv" | cut -f2 | tr -d '\r' | while IFS= read -r r; do mkdir -p "$U/$(dirname "$r")"; cp "$1/$r" "$U/$r"; done
  rm -rf "$P/cadangan"
}
jalan() { ABT_BLANGKO="$U" bash "$P/$1" 2>&1 | sed 's/^/    /' | grep -v 'md5 .* bukan dasar'; }
(cd "$P" && md5sum -c MD5SUMS.txt >/dev/null) || { echo "MD5SUMS paket tidak cocok"; exit 1; }
salin "$ASAL"
AWAL=$(sidik "$U"); V0=$(snap)
echo "SIDIK AWAL $AWAL ; VARIABEL AWAL $V0"
echo "== 1. pasang pertama"; jalan pasang-satker.sh
(cd "$P" && python -B tambal_rtf.py periksa "$U" | tail -1 | sed 's/^/    periksa: /')
echo "== 2. pasang ulang (idempoten)"; S1=$(sidik "$U"); V1=$(snap); jalan pasang-satker.sh; [ "$(sidik "$U")" = "$S1" ] && [ "$(snap)" = "$V1" ] && echo "    SIDIK & VARIABEL TETAP"
echo "== 3. pulih"; jalan pulih-satker.sh; [ "$(sidik "$U")" = "$AWAL" ] && echo "    SIDIK BERKAS = AWAL"; [ "$(snap)" = "$V0" ] && echo "    VARIABEL = AWAL"
echo "== 4. pasang lagi sesudah pulih"; jalan pasang-satker.sh; [ "$(sidik "$U")" = "$S1" ] && [ "$(snap)" = "$V1" ] && echo "    SAMA DENGAN PASANG PERTAMA"
rm -f "$P/cadangan/berkas-ditambal.txt.dipulihkan"  # Windows: rename menolak menimpa penanda pulih pertama; di server (Linux) tidak perlu
jalan pulih-satker.sh | tail -1
echo "== 5. satu berkas disunting -> BERHENTI tanpa ubahan"; salin "$ASAL"
printf ' ' >> "$U/derry_briantono/6 Perwalian/[98] [Cabut] Perwalian.rtf"; S5=$(sidik "$U"); jalan pasang-satker.sh; [ "$(sidik "$U")" = "$S5" ] && [ "$(snap)" = "$V0" ] && echo "    TIDAK ADA YANG BERUBAH"
echo "== 6. paket sebelumnya belum terpasang (berkas lama) -> BERHENTI tanpa ubahan"
if [ -n "${SEBELUM_MEKANIS:-}" ] && [ -d "$SEBELUM_MEKANIS/derry_briantono" ]; then
  salin "$SEBELUM_MEKANIS"; S6=$(sidik "$U"); jalan pasang-satker.sh | tail -3; [ "$(sidik "$U")" = "$S6" ] && [ "$(snap)" = "$V0" ] && echo "    TIDAK ADA YANG BERUBAH"
else
  echo "    (dilewati: SEBELUM_MEKANIS tidak diberikan)"
fi
echo "== 7. nomor 9285 dipakai variabel lain -> BERHENTI tanpa ubahan"; salin "$ASAL"; S7=$(sidik "$U")
$M -e "INSERT INTO abt_variabel (no_var, nama, data_type, sql_query, locked, modifier) VALUES (9285, 'BENTROK UJI', 'data_teks', NULL, 0, 'uji')" >/dev/null
jalan pasang-satker.sh; [ "$(sidik "$U")" = "$S7" ] && echo "    BERKAS TIDAK BERUBAH"
$M -e "DELETE FROM abt_variabel WHERE no_var = 9285" >/dev/null; [ "$(snap)" = "$V0" ] && echo "    VARIABEL = AWAL"
echo "== 8. disunting sesudah pasang lalu pulih -> dibiarkan"; salin "$ASAL"; jalan pasang-satker.sh >/dev/null
printf ' ' >> "$U/derry_briantono/6 Perwalian/[98] [Cabut] Perwalian.rtf"; jalan pulih-satker.sh | tail -5
rm -rf "$U" "$P/cadangan"; [ "$(snap)" = "$V0" ] && echo "AKHIR: VARIABEL = AWAL"
