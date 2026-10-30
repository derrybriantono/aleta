#!/bin/bash
# Uji bolak-balik paket tanggal-agenda-31okt di MariaDB XAMPP laptop, basis milik sendiri aps_badilag_w147 (tabel abt_variabel disalin
# dari aps_badilag_rantai = dump server 28 Okt + SEMUA paket URUTAN-PASANG-31okt). Urutan: snap -> PASANG -> pasang ulang (idempoten)
# -> PULIH (harus PERSIS awal) -> pasang lagi -> penjaga (variabel disunting orang -> pasang berhenti tanpa mengubah apa pun).
# pakai: bash uji_lokal.sh
export TMP='D:\Aplikasi\aleta\tmp' TEMP='D:\Aplikasi\aleta\tmp'
X="/d/Satker Asal/Website PA Bungku/xampp/mysql/bin"; export PATH="$X:$PATH"
export ABT_LOKAL=1 ABT_DB=${ABT_DB:-aps_badilag_w147} MYSQL_BIN=
UJI=/d/Aplikasi/aleta/tmp/w147-agenda; PK=$UJI/pk; LOG=$UJI/log
AKAR=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$LOG"; rm -rf "$PK"; cp -r "$AKAR/paket-satker" "$PK"; rm -rf "$PK/cadangan"
mysql -h 127.0.0.1 -u root -e "CREATE DATABASE IF NOT EXISTS $ABT_DB; DROP TABLE IF EXISTS $ABT_DB.abt_variabel; CREATE TABLE $ABT_DB.abt_variabel LIKE aps_badilag_rantai.abt_variabel; INSERT INTO $ABT_DB.abt_variabel SELECT * FROM aps_badilag_rantai.abt_variabel"
my() { mysql -h 127.0.0.1 -u root --default-character-set=latin1 -N $ABT_DB "$@"; }
snap() { my -e "SET SESSION group_concat_max_len=1000000000; SELECT COUNT(*), MD5(GROUP_CONCAT(CONCAT_WS('|',no_var,nama,data_type,IFNULL(sql_query,''),IFNULL(default_data,''),locked,IFNULL(modifier,'')) ORDER BY no_var)) FROM abt_variabel" | tr '\t\r' ' '; }
S0=$(snap); echo "SNAP awal   : $S0"
echo "== 1. PASANG"; bash "$PK/pasang-satker.sh" > "$LOG/1-pasang.txt" 2>&1; cat "$LOG/1-pasang.txt"
S1=$(snap); echo "SNAP pasang : $S1"
echo "== 2. pasang ulang"; bash "$PK/pasang-satker.sh" > "$LOG/2-ulang.txt" 2>&1; cat "$LOG/2-ulang.txt"
S2=$(snap); [ "$S1" = "$S2" ] && echo "PASANG ULANG = TIDAK ADA PERUBAHAN" || echo "PASANG ULANG MENGUBAH SESUATU"
echo "== 3. PULIH"; bash "$PK/pulih-satker.sh" > "$LOG/3-pulih.txt" 2>&1; cat "$LOG/3-pulih.txt"
S3=$(snap); [ "$S0" = "$S3" ] && echo "PULIH = KEADAAN AWAL PERSIS (seluruh tabel variabel)" || echo "PULIH BEDA DARI KEADAAN AWAL"
echo "== 4. pasang lagi"; bash "$PK/pasang-satker.sh" > "$LOG/4-lagi.txt" 2>&1; tail -n 2 "$LOG/4-lagi.txt"
S4=$(snap); [ "$S4" = "$S1" ] && echo "PASANG LAGI = SAMA DENGAN PASANG PERTAMA" || echo "PASANG LAGI BEDA"
bash "$PK/pulih-satker.sh" > "$LOG/5-pulih2.txt" 2>&1; tail -n 1 "$LOG/5-pulih2.txt"
echo "== 5. PENJAGA: 7111 disunting orang -> pasang HARUS berhenti tanpa mengubah apa pun"
my -e "UPDATE abt_variabel SET sql_query = CONCAT(sql_query, ' ') WHERE no_var = 7111"
S5=$(snap); bash "$PK/pasang-satker.sh" > "$LOG/6-penjaga.txt" 2>&1; tail -n 1 "$LOG/6-penjaga.txt" | cut -c1-200
S6=$(snap); [ "$S5" = "$S6" ] && echo "PENJAGA: TIDAK ADA YANG BERUBAH" || echo "PENJAGA: ADA YANG BERUBAH"
my -e "UPDATE abt_variabel SET sql_query = LEFT(sql_query, CHAR_LENGTH(sql_query) - 1) WHERE no_var = 7111"
S7=$(snap); [ "$S7" = "$S0" ] && echo "SESUDAH PENJAGA = KEADAAN AWAL" || echo "SESUDAH PENJAGA BEDA DARI AWAL"
echo "== 6. pasang akhir"; bash "$PK/pasang-satker.sh" > "$LOG/7-akhir.txt" 2>&1; tail -n 1 "$LOG/7-akhir.txt"
