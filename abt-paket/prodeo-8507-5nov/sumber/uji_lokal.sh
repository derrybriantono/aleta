#!/bin/bash
# Uji paket di laptop atas basis uji aps_badilag_vs. pakai (Git Bash, mysql lewat PATH): bash sumber/uji_lokal.sh  -> hasil/uji-lokal.txt
set -u
cd "$(dirname "$0")/.." || exit 1
P="$(pwd)/paket-satker"
export ABT_LOKAL=1 ABT_DB="${ABT_DB:-aps_badilag_vs}"
M="mysql -h 127.0.0.1 -u root --default-character-set=latin1 -N $ABT_DB"
snap() { $M -e "SET SESSION group_concat_max_len=1000000000; SELECT COUNT(*), MD5(GROUP_CONCAT(CONCAT_WS('|',no_var,nama,data_type,IFNULL(sql_query,''),IFNULL(default_data,''),locked,IFNULL(modifier,''),IFNULL(modified,'')) ORDER BY no_var)) FROM abt_variabel" | tr '\t\r' ' '; }
baris() { $M -e "SELECT MD5(sql_query), modified, modifier FROM abt_variabel WHERE no_var = 8507" | tr '\t\r' ' '; }
jalan() { bash "$P/$1" 2>&1 | sed 's/^/    /'; }
(cd "$P" && md5sum -c MD5SUMS.txt >/dev/null) || { echo "MD5SUMS paket tidak cocok"; exit 1; }
rm -rf "$P/cadangan"
V0=$(snap); B0=$(baris)
echo "SELURUH VARIABEL AWAL $V0 ; 8507 AWAL $B0"
echo "== 1. pasang pertama"; jalan pasang-satker.sh | sed 's#Cadangan: .*#Cadangan: (folder paket)#'
V1=$(snap); B1=$(baris); echo "    8507 SESUDAH $B1"
echo "== 2. pasang ulang (idempoten)"; jalan pasang-satker.sh | sed 's#Cadangan: .*#Cadangan: (folder paket)#'; [ "$(snap)" = "$V1" ] && echo "    TETAP"
echo "== 3. pulih"; jalan pulih-satker.sh; [ "$(snap)" = "$V0" ] && echo "    SELURUH TABEL VARIABEL = AWAL (termasuk modified)"
echo "== 4. pasang lagi sesudah pulih"; jalan pasang-satker.sh | tail -2 | sed 's#Cadangan: .*#Cadangan: (folder paket)#'; [ "$(snap)" = "$V1" ] && echo "    SAMA DENGAN PASANG PERTAMA"; jalan pulih-satker.sh | tail -1
echo "== 5. rumus server berbeda -> BERHENTI tanpa ubahan"
$M -e "UPDATE abt_variabel SET sql_query = CONCAT(sql_query, ' '), modified = modified WHERE no_var = 8507" >/dev/null; S5=$(snap)
jalan pasang-satker.sh; [ "$(snap)" = "$S5" ] && echo "    TIDAK ADA YANG BERUBAH"
$M -e "UPDATE abt_variabel SET sql_query = LEFT(sql_query, CHAR_LENGTH(sql_query) - 1), modified = modified WHERE no_var = 8507" >/dev/null; [ "$(snap)" = "$V0" ] && echo "    DIKEMBALIKAN = AWAL"
echo "== 6. diubah sesudah pasang lalu pulih -> dibiarkan"; jalan pasang-satker.sh >/dev/null
$M -e "UPDATE abt_variabel SET sql_query = CONCAT(sql_query, ' '), modified = modified WHERE no_var = 8507" >/dev/null
jalan pulih-satker.sh
$M -e "UPDATE abt_variabel SET sql_query = LEFT(sql_query, CHAR_LENGTH(sql_query) - 1), modified = modified WHERE no_var = 8507" >/dev/null; jalan pulih-satker.sh | tail -1
rm -rf "$P/cadangan"; [ "$(snap)" = "$V0" ] && echo "AKHIR: SELURUH TABEL VARIABEL = AWAL"
