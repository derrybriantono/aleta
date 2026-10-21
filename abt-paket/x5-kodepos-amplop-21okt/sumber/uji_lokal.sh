#!/bin/bash
# Uji lokal paket x5 di ABT laptop (MySQL XAMPP): basis aps_badilag_x5 = salinan persis abt_variabel server 21 Okt (HEX baca-saja, alat/siapkan_lab.py)
# dan folder blangko uji = salinan persis 7 RTF amplop server. Paket dijalankan dari SALINAN paket-satker di luar repo (cadangan/ tidak mengotori repo).
# Urutan: siapkan -> PASANG -> PERIKSA -> pasang ulang -> PULIH (keadaan harus persis sama dengan server) -> PRASYARAT -> pasang lagi.
export TMP='D:\Aplikasi\aleta\tmp' TEMP='D:\Aplikasi\aleta\tmp'
export PATH="/d/Satker Asal/Website PA Bungku/xampp/mysql/bin:$PATH"
export ABT_LOKAL=1 ABT_DB=aps_badilag_x5 SIPP_DB=sipp_donggala PY=python
AKAR=$(cd "$(dirname "$0")/.." && pwd)
UJI=/d/Aplikasi/aleta/tmp/w28/paket-uji
export ABT_BLANGKO=/d/Aplikasi/aleta/tmp/w28/blangko-uji
PK="$UJI"
LOG=${LOG:-/d/Aplikasi/aleta/tmp/w28/log}
mkdir -p "$LOG"
snap() {
  mysql -u root --default-character-set=latin1 -N aps_badilag_x5 -e "SET SESSION group_concat_max_len=1000000000; SELECT COUNT(*), MD5(GROUP_CONCAT(CONCAT_WS('|',no_var,HEX(nama),IFNULL(data_type,'~'),IFNULL(data_tabel,'~'),IFNULL(data_kolom,'~'),IFNULL(urutan_data,'~'),IFNULL(referensi,'~'),IFNULL(HEX(sql_query),'~'),IFNULL(HEX(default_data),'~'),IFNULL(multi_sidang,'~'),locked,IFNULL(modifier,'~'),modified) ORDER BY no_var)) FROM abt_variabel"
  (cd "$ABT_BLANGKO" && md5sum derry_briantono/*/*.rtf | md5sum | cut -c1-32)
}
siapkan() {
  python "$AKAR/alat/siapkan_lab.py" >/dev/null
  rm -rf "$ABT_BLANGKO" "$UJI"
  mkdir -p "$ABT_BLANGKO/derry_briantono/98 Relaas" "$UJI"
  cp /d/Aplikasi/aleta/tmp/w28/rtf-server/*.rtf "$ABT_BLANGKO/derry_briantono/98 Relaas/"
  cp "$AKAR"/paket-satker/* "$UJI/"
}
case "${1:-semua}" in
  siapkan) siapkan ;;
  snap) snap ;;
  semua)
    siapkan
    echo "SNAP awal   : $(snap | tr '\n' ' ')"
    echo "== 1. PASANG"; bash "$PK/pasang-satker.sh" > "$LOG/1-pasang.txt" 2>&1; grep -E "^(PRASYARAT|CADANGAN|SEMUA|TIDAK|GAGAL|SELESAI|uji perkara|BERKAS|SUNTING|COCOK|var )" "$LOG/1-pasang.txt" | cut -c1-210
    echo "SNAP pasang : $(snap | tr '\n' ' ')"
    echo "== 2. PERIKSA"; mysql -u root --default-character-set=latin1 -N aps_badilag_x5 < "$PK/abt-x5-kodepos-amplop-21okt-PERIKSA.sql" | tail -1
    echo "== 3. pasang ulang"; bash "$PK/pasang-satker.sh" > "$LOG/2-ulang.txt" 2>&1; grep -E "^(PRASYARAT|PASANG ULANG|SEMUA|TIDAK|GAGAL|SELESAI|BERKAS)" "$LOG/2-ulang.txt"
    echo "SNAP ulang  : $(snap | tr '\n' ' ')"
    echo "== 4. PULIH"; bash "$PK/pulih-satker.sh" > "$LOG/3-pulih.txt" 2>&1; tail -3 "$LOG/3-pulih.txt"
    echo "SNAP pulih  : $(snap | tr '\n' ' ')"
    echo "== 5. PRASYARAT sesudah pulih"; mysql -u root --default-character-set=latin1 -N aps_badilag_x5 < "$PK/abt-x5-kodepos-amplop-21okt-PRASYARAT.sql"
    echo "== 6. pasang lagi"; bash "$PK/pasang-satker.sh" > "$LOG/4-lagi.txt" 2>&1; grep -E "^(PRASYARAT|CADANGAN|SEMUA|TIDAK|GAGAL|SELESAI|BERKAS)" "$LOG/4-lagi.txt" | cut -c1-160
    echo "SNAP lagi   : $(snap | tr '\n' ' ')"
    ;;
esac
