#!/bin/bash
# Uji bolak-balik paket pihak-urut-sisa-28okt di ABT laptop (MariaDB XAMPP). Basis uji (ABT_DB, bawaan aps_badilag_ps2) harus salinan keadaan server SESUDAH paket 27 Okt
# (dibuat dari mysqldump --routines basis aps_badilag_pu3: 2.677 baris abt_variabel, 49 fungsi).
# Urutan: siapkan -> PASANG -> PERIKSA -> pasang ulang (idempoten) -> PULIH (keadaan harus PERSIS sama dengan awal: variabel dan fungsi) -> PRASYARAT sesudah pulih -> pasang lagi.
# pakai: bash uji_lokal.sh [siapkan|snap|semua]   (hasil ke D:/Aplikasi/aleta/tmp/w105/log)
export TMP='D:\Aplikasi\aleta\tmp' TEMP='D:\Aplikasi\aleta\tmp'
export PATH="/d/Satker Asal/Website PA Bungku/xampp/mysql/bin:$PATH"
export ABT_LOKAL=1 ABT_DB=${ABT_DB:-aps_badilag_ps2} SIPP_DB=sipp_donggala
AKAR=$(cd "$(dirname "$0")/.." && pwd)
PK=$AKAR/paket-satker
DUMP=${DUMP:-D:/Aplikasi/aleta/tmp/w105/pu3-dump.sql}
LOG=${LOG:-/d/Aplikasi/aleta/tmp/w105/log}
mkdir -p "$LOG"
snap() {
  local v f
  v=$(mysql -u root --default-character-set=latin1 -N $ABT_DB -e "SET SESSION group_concat_max_len=1000000000; SELECT COUNT(*), MD5(GROUP_CONCAT(CONCAT_WS('|',no_var,HEX(nama),IFNULL(data_type,'~'),IFNULL(data_tabel,'~'),IFNULL(data_kolom,'~'),IFNULL(urutan_data,'~'),IFNULL(referensi,'~'),IFNULL(HEX(sql_query),'~'),IFNULL(HEX(default_data),'~'),IFNULL(multi_sidang,'~'),locked,IFNULL(modifier,'~'),modified) ORDER BY no_var)) FROM abt_variabel" | tr '\t\r' ' ')
  f=$(mysql -u root -N -e "SELECT COUNT(*), IFNULL(MD5(GROUP_CONCAT(CONCAT(routine_name,MD5(REPLACE(routine_definition,'$ABT_DB.','X.'))) ORDER BY routine_name)),'-') FROM information_schema.routines WHERE routine_schema='$ABT_DB'" | tr '\t\r' ' ')
  echo "variabel[$v] fungsi[$f]"
}
siapkan() {
  mysql -u root -e "DROP DATABASE IF EXISTS $ABT_DB; CREATE DATABASE $ABT_DB DEFAULT CHARSET latin1"
  mysql -u root --default-character-set=latin1 $ABT_DB < "$DUMP"
  rm -rf "$PK/cadangan"
}
case "${1:-semua}" in
  siapkan) siapkan ;;
  snap) snap ;;
  semua)
    siapkan
    S0=$(snap); echo "SNAP awal   : $S0"
    echo "== 1. PASANG"; bash "$PK/pasang-satker.sh" > "$LOG/1-pasang.txt" 2>&1; grep -E "^(PRASYARAT|CADANGAN|FUNGSI|SEMUA|UJI|GAGAL|SELESAI|uji)" "$LOG/1-pasang.txt" | cut -c1-160
    S1=$(snap); echo "SNAP pasang : $S1"
    echo "== 2. pasang ulang (idempoten)"; bash "$PK/pasang-satker.sh" > "$LOG/2-ulang.txt" 2>&1; grep -E "^(PRASYARAT|PASANG ULANG|SEMUA|GAGAL|SELESAI)" "$LOG/2-ulang.txt" | cut -c1-160
    S2=$(snap); echo "SNAP ulang  : $S2"
    [ "$S1" = "$S2" ] && echo "PASANG ULANG = TIDAK ADA PERUBAHAN" || echo "PASANG ULANG MENGUBAH SESUATU"
    echo "== 3. PULIH"; bash "$PK/pulih-satker.sh" > "$LOG/3-pulih.txt" 2>&1; tail -n 6 "$LOG/3-pulih.txt"
    S3=$(snap); echo "SNAP pulih  : $S3"
    [ "$S0" = "$S3" ] && echo "PULIH = KEADAAN AWAL PERSIS (variabel dan fungsi)" || echo "PULIH BEDA DARI KEADAAN AWAL"
    echo "== 4. PRASYARAT sesudah pulih (harus sama dengan harap pertama: $(sed -n 1p "$PK/harap.txt"))"
    sed "s/MD5(routine_definition)/MD5(REPLACE(routine_definition, 'sipp_donggala.', 'SIPP.'))/g" "$PK/abt-pihak-urut-sisa-28okt-PRASYARAT.sql" | mysql -u root --default-character-set=latin1 -N $ABT_DB
    echo "== 5. pasang lagi"; bash "$PK/pasang-satker.sh" > "$LOG/4-lagi.txt" 2>&1; grep -E "^(PRASYARAT|CADANGAN|FUNGSI|SEMUA|GAGAL|SELESAI)" "$LOG/4-lagi.txt" | cut -c1-160
    S4=$(snap); echo "SNAP lagi   : $S4"
    [ "$S4" = "$S1" ] && echo "PASANG LAGI = SAMA DENGAN PASANG PERTAMA" || echo "PASANG LAGI BEDA DARI PASANG PERTAMA"
    ;;
esac
