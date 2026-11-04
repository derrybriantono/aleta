#!/bin/bash
# Uji bolak-balik paket keputusan-a-kerangka-4nov di MariaDB XAMPP laptop (basis ABT milik sendiri aps_badilag_w206 = salinan server 3 Nov
# aps_badilag_w189d, SIPP lokal sipp_donggala) atas SALINAN pohon blangko SESUDAH keputusan-a-mekanis-4nov. Pohon asli tidak disentuh.
# pakai (Git Bash): U=<folder salinan> SEBELUM_MEKANIS=<pohon dasar tanpa paket mekanis> bash sumber/uji_lokal.sh <akar _blangko_abt sesudah mekanis>
#   -> hasil/uji-lokal.txt
set -u
cd "$(dirname "$0")/.." || exit 1
ASAL="$1"
export TMP='D:\Aplikasi\aleta\tmp' TEMP='D:\Aplikasi\aleta\tmp'
X="/d/Satker Asal/Website PA Bungku/xampp/mysql/bin"; export PATH="$X:$PATH"
export ABT_LOKAL=1 ABT_DB="${ABT_DB:-aps_badilag_w206}" SIPP_DB="${SIPP_DB:-sipp_donggala}" MYSQL_BIN= PY=python
U="${U:-${TMP}/uji-keputusan-a-kerangka-$$}"
P="$(pwd)/paket-satker"
my() { mysql -h 127.0.0.1 -u root --default-character-set=latin1 -N "$ABT_DB" "$@"; }
sidik() { (cd "$1" && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32); }
snap() { my -e "SET SESSION group_concat_max_len=1000000000; SELECT COUNT(*), MD5(GROUP_CONCAT(CONCAT_WS('|',no_var,nama,data_type,IFNULL(sql_query,''),IFNULL(default_data,''),locked,IFNULL(modifier,'')) ORDER BY no_var)) FROM abt_variabel" | tr '\t\r' ' '; }
salin() { rm -rf "$U"; mkdir -p "$U"; cp -r "$1/derry_briantono" "$U/"; rm -rf "$P/cadangan"; }
jalan() { ABT_BLANGKO="$U" bash "$P/$1" 2>&1 | sed 's/^/    /'; }
(cd "$P" && md5sum -c MD5SUMS.txt >/dev/null) || { echo "MD5SUMS paket tidak cocok"; exit 1; }
my -e "DELETE FROM abt_variabel WHERE no_var BETWEEN 9266 AND 9269" >/dev/null
AWAL=$(sidik "$ASAL"); V0=$(snap)
echo "SIDIK AWAL $AWAL | VARIABEL AWAL $V0"
echo "== 1. pasang pertama"; salin "$ASAL"; jalan pasang-satker.sh
V1=$(snap); S1=$(sidik "$U"); echo "    variabel sesudah: $V1"
echo "== 2. pasang ulang (idempoten)"; jalan pasang-satker.sh; [ "$(sidik "$U")" = "$S1" ] && [ "$(snap)" = "$V1" ] && echo "    SIDIK DAN VARIABEL TETAP"
echo "== 3. pulih"; jalan pulih-satker.sh; [ "$(sidik "$U")" = "$AWAL" ] && echo "    SIDIK = AWAL"; [ "$(snap)" = "$V0" ] && echo "    VARIABEL = AWAL"
echo "== 4. pasang lagi sesudah pulih"; jalan pasang-satker.sh; [ "$(sidik "$U")" = "$S1" ] && [ "$(snap)" = "$V1" ] && echo "    SAMA DENGAN PASANG PERTAMA"
jalan pulih-satker.sh >/dev/null
echo "== 5. md5 berkas berbeda (satu berkas CT disunting) -> BERHENTI tanpa ubahan"; salin "$ASAL"
printf ' ' >> "$U/derry_briantono/1a Perceraian CT/[01a] [Kabul Verstek] CT - F (Ex Offiicio mutah iddah dan nafkah anak).rtf"; S5=$(sidik "$U"); V5=$(snap)
jalan pasang-satker.sh | grep -v '^    GAGAL	'; [ "$(sidik "$U")" = "$S5" ] && [ "$(snap)" = "$V5" ] && echo "    TIDAK ADA YANG BERUBAH"
echo "== 6. keputusan-a-mekanis belum terpasang (pohon dasar) -> BERHENTI tanpa ubahan"; rm -rf "$U"; mkdir -p "$U"
if [ -n "${SEBELUM_MEKANIS:-}" ] && [ -d "$SEBELUM_MEKANIS/derry_briantono" ]; then
  salin "$SEBELUM_MEKANIS"; S6=$(sidik "$U"); V6=$(snap)
  jalan pasang-satker.sh | grep -v '^    GAGAL	'; [ "$(sidik "$U")" = "$S6" ] && [ "$(snap)" = "$V6" ] && echo "    TIDAK ADA YANG BERUBAH"
else
  echo "    (dilewati: SEBELUM_MEKANIS tidak diberikan)"
fi
echo "== 7. nomor variabel 9268 sudah dipakai paket/orang lain -> BERHENTI tanpa ubahan"; salin "$ASAL"
my -e "INSERT INTO abt_variabel (no_var, nama, data_type, sql_query, locked, modifier) VALUES (9268, 'BENTROK UJI', 'data_sql', 'SELECT 1 AS data', 0, 'uji')" >/dev/null
S7=$(sidik "$U"); V7=$(snap)
jalan pasang-satker.sh; [ "$(sidik "$U")" = "$S7" ] && [ "$(snap)" = "$V7" ] && echo "    TIDAK ADA YANG BERUBAH"
my -e "DELETE FROM abt_variabel WHERE no_var = 9268" >/dev/null
echo "== 8. blangko baru sudah ada dengan isi lain -> BERHENTI tanpa ubahan"; salin "$ASAL"
mkdir -p "$U/derry_briantono/1 Perceraian CG"; echo "isi lain" > "$U/derry_briantono/1 Perceraian CG/[02] [Kabul] CG - F - (3 Saksi T).rtf"
S8=$(sidik "$U"); V8=$(snap)
jalan pasang-satker.sh | grep -v '^    GAGAL	'; [ "$(sidik "$U")" = "$S8" ] && [ "$(snap)" = "$V8" ] && echo "    TIDAK ADA YANG BERUBAH"
echo "== 9. disunting sesudah pasang lalu pulih -> dibiarkan"; salin "$ASAL"; jalan pasang-satker.sh >/dev/null
printf ' ' >> "$U/derry_briantono/1 Perceraian CG/[02] [Kabul] CG - F - (4 Saksi T).rtf"
my -e "UPDATE abt_variabel SET sql_query = CONCAT(sql_query, ' ') WHERE no_var = 9267" >/dev/null
jalan pulih-satker.sh | grep -v '^    GAGAL	'
# bersihkan untuk uji berikutnya
my -e "DELETE FROM abt_variabel WHERE no_var BETWEEN 9266 AND 9269" >/dev/null
rm -rf "$U" "$P/cadangan"
