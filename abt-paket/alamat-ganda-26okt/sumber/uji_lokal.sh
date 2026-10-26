#!/bin/bash
# Uji lokal paket alamat-ganda-26okt di ABT laptop (MariaDB XAMPP): basis aps_badilag_ag3 = salinan PERSIS abt_variabel server (alat/siapkan_lab.py dari HEX baca-saja) +
# fungsi x9 terpasang (keadaan server) + salinan folder derry_briantono dari server.
# Urutan: siapkan -> PASANG -> PERIKSA -> pasang ulang -> PULIH (keadaan harus PERSIS sama dengan server: variabel, RTF, fungsi x9) -> pasang lagi.
# pakai: bash uji_lokal.sh   (hasil ke D:/Aplikasi/aleta/tmp/w82/log)
export TMP='D:\Aplikasi\aleta\tmp' TEMP='D:\Aplikasi\aleta\tmp'
export PATH="/d/Satker Asal/Website PA Bungku/xampp/mysql/bin:$PATH"
export ABT_LOKAL=1 ABT_DB=aps_badilag_ag3 SIPP_DB=sipp_donggala PY=python
AKAR=$(cd "$(dirname "$0")/.." && pwd)
PK=$AKAR/paket-satker
LAB=D:/Aplikasi/aleta/tmp/w82/blangko-lab3
export ABT_BLANGKO=$LAB/derry_briantono
LOG=${LOG:-/d/Aplikasi/aleta/tmp/w82/log}
mkdir -p "$LOG"
snap() {
  local v f r
  v=$(mysql -u root --default-character-set=latin1 -N aps_badilag_ag3 -e "SET SESSION group_concat_max_len=1000000000; SELECT COUNT(*), MD5(GROUP_CONCAT(CONCAT_WS('|',no_var,HEX(nama),IFNULL(data_type,'~'),IFNULL(data_tabel,'~'),IFNULL(data_kolom,'~'),IFNULL(urutan_data,'~'),IFNULL(referensi,'~'),IFNULL(HEX(sql_query),'~'),IFNULL(HEX(default_data),'~'),IFNULL(multi_sidang,'~'),locked,IFNULL(modifier,'~'),modified) ORDER BY no_var)) FROM abt_variabel" | tr '\t\r' ' ')
  f=$(mysql -u root -N aps_badilag_ag3 -e "SELECT COUNT(*), IFNULL(MD5(GROUP_CONCAT(CONCAT(routine_name,MD5(routine_definition)) ORDER BY routine_name)),'-') FROM information_schema.routines WHERE routine_schema='aps_badilag_ag3'" | tr '\t\r' ' ')
  r=$(cd "$LAB/derry_briantono" && find . -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32)
  echo "variabel[$v] fungsi[$f] rtf[$r]"
}
siapkan() {
  python "$AKAR/alat/siapkan_lab.py" aps_badilag_ag3 > /dev/null
  sed "s/SIPP\\./sipp_donggala./g" "$AKAR/../x9-pihak-banyak-21okt/paket-satker/abt-x9-pihak-banyak-21okt-FUNGSI.sql" | mysql -u root --default-character-set=latin1 aps_badilag_ag3
  rm -rf "$LAB" "$PK/cadangan"; mkdir -p "$LAB"; cp -r D:/Aplikasi/aleta/tmp/w82/rtf/derry_briantono "$LAB/"
}
case "${1:-semua}" in
  siapkan) siapkan ;;
  snap) snap ;;
  semua)
    siapkan
    S0=$(snap); echo "SNAP awal   : $S0"
    echo "== 1. PASANG"; bash "$PK/pasang-satker.sh" > "$LOG/1-pasang.txt" 2>&1; grep -E "^(PRASYARAT|PRAPERIKSA|CADANGAN|FUNGSI|SEMUA|UJI alamat|GAGAL|SELESAI|RINGKAS)" "$LOG/1-pasang.txt" | cut -c1-200
    echo "SNAP pasang : $(snap)"
    echo "== 2. pasang ulang (idempoten)"; bash "$PK/pasang-satker.sh" > "$LOG/2-ulang.txt" 2>&1; grep -E "^(PRASYARAT|PRAPERIKSA|PASANG ULANG|SEMUA|GAGAL|SELESAI)" "$LOG/2-ulang.txt" | cut -c1-200
    echo "SNAP ulang  : $(snap)"
    echo "== 3. PULIH"; bash "$PK/pulih-satker.sh" > "$LOG/3-pulih.txt" 2>&1; tail -n 14 "$LOG/3-pulih.txt"
    S3=$(snap); echo "SNAP pulih  : $S3"
    [ "$S0" = "$S3" ] && echo "PULIH = KEADAAN AWAL PERSIS (variabel, fungsi, RTF)" || echo "PULIH BEDA DARI KEADAAN AWAL"
    echo "== 4. PRASYARAT sesudah pulih"; sed "s/MD5(routine_definition)/MD5(REPLACE(routine_definition, 'sipp_donggala.', 'SIPP.'))/g" "$PK/abt-alamat-ganda-26okt-PRASYARAT.sql" | mysql -u root --default-character-set=latin1 -N aps_badilag_ag3
    echo "== 5. pasang lagi"; bash "$PK/pasang-satker.sh" > "$LOG/4-lagi.txt" 2>&1; grep -E "^(PRASYARAT|PRAPERIKSA|CADANGAN|FUNGSI|SEMUA|GAGAL|SELESAI)" "$LOG/4-lagi.txt" | cut -c1-200
    echo "SNAP lagi   : $(snap)"
    ;;
esac
