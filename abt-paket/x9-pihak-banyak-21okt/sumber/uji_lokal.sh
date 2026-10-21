#!/bin/bash
# Uji lokal paket x9 di ABT laptop (MySQL XAMPP): basis aps_badilag_x9 = salinan PERSIS abt_variabel server (alat/siapkan_lab.py dari HEX baca-saja).
# Urutan: siapkan -> PASANG -> PERIKSA -> pasang ulang -> PULIH (keadaan harus persis sama dengan server, fungsi hilang) -> pasang lagi.
export TMP='D:\Aplikasi\aleta\tmp' TEMP='D:\Aplikasi\aleta\tmp'
export PATH="/d/Satker Asal/Website PA Bungku/xampp/mysql/bin:$PATH"
export ABT_LOKAL=1 ABT_DB=aps_badilag_x9 SIPP_DB=sipp_donggala PY=python
AKAR=/d/aleta-dev/wt/w39/abt-paket/x9-pihak-banyak-21okt
PK=$AKAR/paket-satker
LOG=${LOG:-/d/Aplikasi/aleta/tmp/x1/w39/log}
mkdir -p "$LOG"
snap() { mysql -u root --default-character-set=latin1 -N aps_badilag_x9 -e "SET SESSION group_concat_max_len=1000000000; SELECT COUNT(*), MD5(GROUP_CONCAT(CONCAT_WS('|',no_var,HEX(nama),IFNULL(data_type,'~'),IFNULL(data_tabel,'~'),IFNULL(data_kolom,'~'),IFNULL(urutan_data,'~'),IFNULL(referensi,'~'),IFNULL(HEX(sql_query),'~'),IFNULL(HEX(default_data),'~'),IFNULL(multi_sidang,'~'),locked,IFNULL(modifier,'~'),modified) ORDER BY no_var)), (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema='aps_badilag_x9' AND routine_comment LIKE 'X9:%') FROM abt_variabel"; }
siapkan() { python $AKAR/alat/siapkan_lab.py aps_badilag_x9 >/dev/null; rm -rf "$PK/cadangan"; }
case "${1:-semua}" in
  siapkan) siapkan ;;
  snap) snap ;;
  semua)
    [ "${NORESET:-}" = 1 ] || siapkan; rm -rf "$PK/cadangan"
    echo "SNAP awal   : $(snap)"
    echo "== 1. PASANG"; bash "$PK/pasang-satker.sh" > "$LOG/1-pasang.txt" 2>&1; grep -E "^(PRASYARAT|CADANGAN|FUNGSI|SEMUA|TIDAK|GAGAL|SELESAI)" "$LOG/1-pasang.txt" | cut -c1-120; grep -c "^uji perkara" "$LOG/1-pasang.txt"
    echo "SNAP pasang : $(snap)"
    echo "== 2. PERIKSA"; mysql -u root --default-character-set=latin1 -N aps_badilag_x9 < "$PK/abt-x9-pihak-banyak-21okt-PERIKSA.sql" | tail -1
    echo "== 3. pasang ulang"; bash "$PK/pasang-satker.sh" > "$LOG/2-ulang.txt" 2>&1; grep -E "^(PRASYARAT|PASANG ULANG|SEMUA|TIDAK|GAGAL|SELESAI)" "$LOG/2-ulang.txt" | cut -c1-100
    echo "SNAP ulang  : $(snap)"
    echo "== 4. PULIH"; bash "$PK/pulih-satker.sh" > "$LOG/3-pulih.txt" 2>&1; cat "$LOG/3-pulih.txt" | tail -9
    echo "SNAP pulih  : $(snap)"
    echo "== 5. PRASYARAT sesudah pulih"; mysql -u root --default-character-set=latin1 -N aps_badilag_x9 < "$PK/abt-x9-pihak-banyak-21okt-PRASYARAT.sql"
    echo "== 6. pasang lagi"; bash "$PK/pasang-satker.sh" > "$LOG/4-lagi.txt" 2>&1; grep -E "^(PRASYARAT|CADANGAN|SEMUA|TIDAK|GAGAL|SELESAI)" "$LOG/4-lagi.txt" | cut -c1-100
    echo "SNAP lagi   : $(snap)"
    ;;
esac
