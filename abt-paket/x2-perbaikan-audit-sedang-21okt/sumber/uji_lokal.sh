#!/bin/bash
# Uji lokal paket x2 di ABT laptop (MySQL XAMPP): basis aps_badilag_x2 = keadaan server pagi 21 Okt + paket x1 (abt_variabel 2.421 baris;
# dump di D:/Aplikasi/aleta/tmp/x2/lab/x1_dump.sql, dibuat dari aps_badilag_x1 hasil uji x1).
# Urutan: siapkan -> PRASYARAT -> PASANG -> PERIKSA -> pasang ulang -> PULIH (keadaan harus persis sama dengan sebelum pasang) -> pasang lagi.
export TMP='D:\Aplikasi\aleta\tmp' TEMP='D:\Aplikasi\aleta\tmp'
export PATH="/d/Satker Asal/Website PA Bungku/xampp/mysql/bin:$PATH"
export ABT_LOKAL=1 ABT_DB=aps_badilag_x2 SIPP_DB=sipp_donggala PY=python
PK=/d/aleta-dev/wt/integrasi21/abt-paket/x2-perbaikan-audit-sedang-21okt/paket-satker
LOG=${LOG:-/d/Aplikasi/aleta/tmp/x2/log}
DUMP=/d/Aplikasi/aleta/tmp/x2/lab/x1_dump.sql
mkdir -p "$LOG"
snap() { mysql -u root --default-character-set=latin1 -N aps_badilag_x2 -e "SET SESSION group_concat_max_len=1000000000; SELECT COUNT(*), MD5(GROUP_CONCAT(CONCAT_WS('|',no_var,HEX(nama),IFNULL(data_type,'~'),IFNULL(data_tabel,'~'),IFNULL(data_kolom,'~'),IFNULL(urutan_data,'~'),IFNULL(referensi,'~'),IFNULL(HEX(sql_query),'~'),IFNULL(HEX(default_data),'~'),IFNULL(multi_sidang,'~'),locked,IFNULL(modifier,'~'),modified) ORDER BY no_var)) FROM abt_variabel"; }
siapkan() {
  mysql -u root -e "DROP DATABASE IF EXISTS aps_badilag_x2; CREATE DATABASE aps_badilag_x2 DEFAULT CHARSET latin1;" || exit 1
  mysql -u root --default-character-set=latin1 aps_badilag_x2 < "$DUMP" || exit 1
  rm -rf "$PK/cadangan"
}
case "${1:-semua}" in
  siapkan) siapkan ;;
  snap) snap ;;
  semua)
    if [ "${NORESET:-}" != 1 ]; then siapkan; fi; rm -rf "$PK/cadangan"
    echo "SNAP awal   : $(snap)"
    echo "== 1. PASANG"; bash "$PK/pasang-satker.sh" > "$LOG/1-pasang.txt" 2>&1; grep -E "^(PRASYARAT|CADANGAN|SEMUA|TIDAK|GAGAL|SELESAI|uji perkara)" "$LOG/1-pasang.txt" | cut -c1-230
    echo "SNAP pasang : $(snap)"
    echo "== 2. PERIKSA"; mysql -u root --default-character-set=latin1 -N aps_badilag_x2 < "$PK/abt-x2-perbaikan-audit-sedang-21okt-PERIKSA.sql" | tail -1
    echo "== 3. pasang ulang"; bash "$PK/pasang-satker.sh" > "$LOG/2-ulang.txt" 2>&1; grep -E "^(PRASYARAT|PASANG ULANG|SEMUA|TIDAK|GAGAL|SELESAI)" "$LOG/2-ulang.txt"
    echo "SNAP ulang  : $(snap)"
    echo "== 4. PULIH"; bash "$PK/pulih-satker.sh" > "$LOG/3-pulih.txt" 2>&1; tail -2 "$LOG/3-pulih.txt"
    echo "SNAP pulih  : $(snap)"
    echo "== 5. PRASYARAT sesudah pulih"; mysql -u root --default-character-set=latin1 -N aps_badilag_x2 < "$PK/abt-x2-perbaikan-audit-sedang-21okt-PRASYARAT.sql"
    echo "== 6. pasang lagi"; bash "$PK/pasang-satker.sh" > "$LOG/4-lagi.txt" 2>&1; grep -E "^(PRASYARAT|CADANGAN|SEMUA|TIDAK|GAGAL|SELESAI)" "$LOG/4-lagi.txt" | cut -c1-160
    echo "SNAP lagi   : $(snap)"
    ;;
esac
