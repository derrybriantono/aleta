#!/bin/bash
# Uji lokal paket x4 di ABT laptop (MySQL XAMPP): basis aps_badilag_x4u = salinan persis abt_variabel server 21 Okt sesudah x1-x3
# (HEX baca-saja, D:/Aplikasi/aleta/tmp/w26/var_server_hex.tsv; alat/siapkan_lab.py) + salinan pohon blangko derry_briantono server
# di jalur pendek (D:/b4/derry_briantono; jalur RTF panjang).
# Urutan: siapkan -> PASANG -> PERIKSA -> pasang ulang -> PULIH (variabel dan RTF harus persis sama dengan server) -> PRASYARAT -> pasang lagi.
export TMP='D:\Aplikasi\aleta\tmp' TEMP='D:\Aplikasi\aleta\tmp'
export PATH="/d/Satker Asal/Website PA Bungku/xampp/mysql/bin:$PATH"
export ABT_LOKAL=1 ABT_DB=aps_badilag_x4u SIPP_DB=sipp_donggala
AKAR=$(cd "$(dirname "$0")/.." && pwd)
PK="$AKAR/paket-satker"
POHON=${POHON:-/d/b4}
export ABT_BLANGKO="$POHON/derry_briantono"
LOG=${LOG:-/d/Aplikasi/aleta/tmp/w26/log}
mkdir -p "$LOG"
N=abt-x4-tuntutan-perluasan-21okt
snap() { mysql -h127.0.0.1 -u root --default-character-set=latin1 -N aps_badilag_x4u -e "SET SESSION group_concat_max_len=1000000000; SELECT COUNT(*), MD5(GROUP_CONCAT(CONCAT_WS('|',no_var,HEX(nama),IFNULL(data_type,'~'),IFNULL(data_tabel,'~'),IFNULL(data_kolom,'~'),IFNULL(urutan_data,'~'),IFNULL(referensi,'~'),IFNULL(HEX(sql_query),'~'),IFNULL(HEX(default_data),'~'),IFNULL(multi_sidang,'~'),locked,IFNULL(modifier,'~'),modified) ORDER BY no_var)) FROM abt_variabel"; }
snaprtf() { (cd "$ABT_BLANGKO" && find . -type f -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32); }
siapkan() {
  python "$AKAR/alat/siapkan_lab.py" aps_badilag_x4u >/dev/null
  rm -rf "$PK/cadangan" "$POHON"; mkdir -p "$POHON"
  tar xzf /d/Aplikasi/aleta/tmp/w26/derry-server.tgz -C "$POHON"
}
siapkan
echo "SNAP awal   : $(snap) RTF $(snaprtf)"
echo "== 1. PASANG"; bash "$PK/pasang-satker.sh" > "$LOG/1-pasang.txt" 2>&1; grep -E "^(PRASYARAT|RTF|CADANGAN|SEMUA|TIDAK|GAGAL|SELESAI|uji perkara|RINGKAS)" "$LOG/1-pasang.txt" | cut -c1-200
echo "SNAP pasang : $(snap) RTF $(snaprtf)"
echo "== 2. PERIKSA"; mysql -h127.0.0.1 -u root --default-character-set=latin1 -N aps_badilag_x4u < "$PK/$N-PERIKSA.sql" | tail -1
echo "== 3. pasang ulang"; bash "$PK/pasang-satker.sh" > "$LOG/2-ulang.txt" 2>&1; grep -E "^(PRASYARAT|RTF|PASANG ULANG|SEMUA|TIDAK|GAGAL|SELESAI)" "$LOG/2-ulang.txt"
echo "SNAP ulang  : $(snap) RTF $(snaprtf)"
echo "== 4. PULIH"; bash "$PK/pulih-satker.sh" > "$LOG/3-pulih.txt" 2>&1; tail -3 "$LOG/3-pulih.txt"
echo "SNAP pulih  : $(snap) RTF $(snaprtf)"
echo "== 5. PRASYARAT sesudah pulih"; mysql -h127.0.0.1 -u root --default-character-set=latin1 -N aps_badilag_x4u < "$PK/$N-PRASYARAT.sql"
echo "== 6. pasang lagi"; bash "$PK/pasang-satker.sh" > "$LOG/4-lagi.txt" 2>&1; grep -E "^(PRASYARAT|RTF|CADANGAN|SEMUA|TIDAK|GAGAL|SELESAI)" "$LOG/4-lagi.txt" | cut -c1-160
echo "SNAP lagi   : $(snap) RTF $(snaprtf)"
