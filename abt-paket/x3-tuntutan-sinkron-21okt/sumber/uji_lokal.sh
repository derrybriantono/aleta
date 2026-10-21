#!/bin/bash
# Uji lokal paket x3 di ABT laptop (MySQL XAMPP): basis aps_badilag_x3 = salinan persis abt_variabel server 21 Okt (HEX baca-saja,
# D:/Aplikasi/aleta/tmp/tuntutan24/lab/var_server_hex.tsv; dibuat alat/siapkan_lab.py).
# Urutan: siapkan -> PASANG -> PERIKSA -> pasang ulang -> PULIH (keadaan harus persis sama dengan server) -> PRASYARAT -> pasang lagi.
export TMP='D:\Aplikasi\aleta\tmp' TEMP='D:\Aplikasi\aleta\tmp'
export PATH="/d/Satker Asal/Website PA Bungku/xampp/mysql/bin:$PATH"
export ABT_LOKAL=1 ABT_DB=aps_badilag_x3 SIPP_DB=sipp_donggala PY=python
AKAR=$(cd "$(dirname "$0")/.." && pwd)
PK="$AKAR/paket-satker"
LOG=${LOG:-/d/Aplikasi/aleta/tmp/tuntutan24/log}
mkdir -p "$LOG"
snap() { mysql -u root --default-character-set=latin1 -N aps_badilag_x3 -e "SET SESSION group_concat_max_len=1000000000; SELECT COUNT(*), MD5(GROUP_CONCAT(CONCAT_WS('|',no_var,HEX(nama),IFNULL(data_type,'~'),IFNULL(data_tabel,'~'),IFNULL(data_kolom,'~'),IFNULL(urutan_data,'~'),IFNULL(referensi,'~'),IFNULL(HEX(sql_query),'~'),IFNULL(HEX(default_data),'~'),IFNULL(multi_sidang,'~'),locked,IFNULL(modifier,'~'),modified) ORDER BY no_var)) FROM abt_variabel"; }
case "${1:-semua}" in
  siapkan) python "$AKAR/alat/siapkan_lab.py"; rm -rf "$PK/cadangan" ;;
  snap) snap ;;
  semua)
    if [ "${NORESET:-}" != 1 ]; then python "$AKAR/alat/siapkan_lab.py" >/dev/null; fi; rm -rf "$PK/cadangan"
    echo "SNAP awal   : $(snap)"
    echo "== 1. PASANG"; bash "$PK/pasang-satker.sh" > "$LOG/1-pasang.txt" 2>&1; grep -E "^(PRASYARAT|CADANGAN|SEMUA|TIDAK|GAGAL|SELESAI|uji perkara)" "$LOG/1-pasang.txt" | cut -c1-210
    echo "SNAP pasang : $(snap)"
    echo "== 2. PERIKSA"; mysql -u root --default-character-set=latin1 -N aps_badilag_x3 < "$PK/abt-x3-tuntutan-sinkron-21okt-PERIKSA.sql" | tail -1
    echo "== 3. pasang ulang"; bash "$PK/pasang-satker.sh" > "$LOG/2-ulang.txt" 2>&1; grep -E "^(PRASYARAT|PASANG ULANG|SEMUA|TIDAK|GAGAL|SELESAI)" "$LOG/2-ulang.txt"
    echo "SNAP ulang  : $(snap)"
    echo "== 4. PULIH"; bash "$PK/pulih-satker.sh" > "$LOG/3-pulih.txt" 2>&1; tail -2 "$LOG/3-pulih.txt"
    echo "SNAP pulih  : $(snap)"
    echo "== 5. PRASYARAT sesudah pulih"; mysql -u root --default-character-set=latin1 -N aps_badilag_x3 < "$PK/abt-x3-tuntutan-sinkron-21okt-PRASYARAT.sql"
    echo "== 6. pasang lagi"; bash "$PK/pasang-satker.sh" > "$LOG/4-lagi.txt" 2>&1; grep -E "^(PRASYARAT|CADANGAN|SEMUA|TIDAK|GAGAL|SELESAI)" "$LOG/4-lagi.txt" | cut -c1-160
    echo "SNAP lagi   : $(snap)"
    ;;
esac
