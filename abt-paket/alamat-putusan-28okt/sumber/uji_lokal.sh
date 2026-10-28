#!/bin/bash
# Uji bolak-balik paket alamat-putusan-28okt di ABT laptop (MariaDB XAMPP). Basis uji (ABT_DB, bawaan aps_badilag_alamat) = salinan keadaan server SESUDAH paket 27 Okt DAN paket sisa 28 Okt
# (dibuat dari mysqldump --routines: basis aps_badilag_pu3 + pasang-satker.sh paket pihak-urut-sisa-28okt = 2.677 baris abt_variabel, 50 fungsi), simpan di DUMP.
# Basis ini TERPISAH dari aps_badilag (dipakai agen lain). Hanya MEMBACA sipp_donggala.
# Urutan: siapkan -> PASANG -> PERIKSA -> pasang ulang (idempoten) -> PULIH (keadaan harus PERSIS sama dengan awal: variabel dan fungsi) -> PRASYARAT sesudah pulih -> pasang lagi.
# Jalur gagal: gagal1 = satu baris diubah orang lain (prasyarat berhenti, tidak ada yang berubah); gagal2 = PERIKSA dibuat gagal (pulih otomatis).
# pakai: bash uji_lokal.sh [siapkan|snap|semua|gagal1|gagal2]   (hasil ke D:/Aplikasi/aleta/tmp/w111/log)
export TMP='D:\Aplikasi\aleta\tmp' TEMP='D:\Aplikasi\aleta\tmp'
export PATH="/d/Satker Asal/Website PA Bungku/xampp/mysql/bin:$PATH"
export ABT_LOKAL=1 ABT_DB=${ABT_DB:-aps_badilag_alamat} SIPP_DB=sipp_donggala
AKAR=$(cd "$(dirname "$0")/.." && pwd)
PK=$AKAR/paket-satker
DUMP=${DUMP:-D:/Aplikasi/aleta/tmp/w111/dasar-dump.sql}
LOG=${LOG:-/d/Aplikasi/aleta/tmp/w111/log}
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
prasyarat() {
  sed "s/MD5(routine_definition)/MD5(REPLACE(routine_definition, 'sipp_donggala.', 'SIPP.'))/g" "$PK/abt-alamat-putusan-28okt-PRASYARAT.sql" | mysql -u root --default-character-set=latin1 -N $ABT_DB
}
case "${1:-semua}" in
  siapkan) siapkan ;;
  snap) snap ;;
  semua)
    siapkan
    S0=$(snap); echo "SNAP awal   : $S0"
    echo "== 0. PRASYARAT awal (harus $(sed -n 1p "$PK/harap.txt"))"; prasyarat
    echo "== 1. PASANG"; bash "$PK/pasang-satker.sh" > "$LOG/1-pasang.txt" 2>&1; grep -E "^(PRASYARAT|CADANGAN|FUNGSI|SEMUA|UJI|GAGAL|SELESAI|uji)" "$LOG/1-pasang.txt" | cut -c1-200
    S1=$(snap); echo "SNAP pasang : $S1"
    echo "== 2. pasang ulang (idempoten)"; bash "$PK/pasang-satker.sh" > "$LOG/2-ulang.txt" 2>&1; grep -E "^(PRASYARAT|PASANG ULANG|SEMUA|GAGAL|SELESAI)" "$LOG/2-ulang.txt" | cut -c1-200
    S2=$(snap); echo "SNAP ulang  : $S2"
    [ "$S1" = "$S2" ] && echo "PASANG ULANG = TIDAK ADA PERUBAHAN" || echo "PASANG ULANG MENGUBAH SESUATU"
    echo "== 3. PULIH"; bash "$PK/pulih-satker.sh" > "$LOG/3-pulih.txt" 2>&1; tail -n 8 "$LOG/3-pulih.txt"
    S3=$(snap); echo "SNAP pulih  : $S3"
    [ "$S0" = "$S3" ] && echo "PULIH = KEADAAN AWAL PERSIS (variabel dan fungsi)" || echo "PULIH BEDA DARI KEADAAN AWAL"
    echo "== 4. PRASYARAT sesudah pulih (harus sama dengan harap pertama: $(sed -n 1p "$PK/harap.txt"))"; prasyarat
    echo "== 5. pasang lagi"; bash "$PK/pasang-satker.sh" > "$LOG/4-lagi.txt" 2>&1; grep -E "^(PRASYARAT|CADANGAN|FUNGSI|SEMUA|GAGAL|SELESAI)" "$LOG/4-lagi.txt" | cut -c1-200
    S4=$(snap); echo "SNAP lagi   : $S4"
    [ "$S4" = "$S1" ] && echo "PASANG LAGI = SAMA DENGAN PASANG PERTAMA" || echo "PASANG LAGI BEDA DARI PASANG PERTAMA"
    ;;
  gagal1)
    siapkan
    S0=$(snap); echo "SNAP awal : $S0"
    mysql -u root --default-character-set=latin1 $ABT_DB -e "UPDATE abt_variabel SET sql_query=CONCAT(sql_query, ' ') WHERE no_var=8700"
    S0b=$(snap)
    bash "$PK/pasang-satker.sh" > "$LOG/g1-pasang.txt" 2>&1; grep -E "^(PRASYARAT|GAGAL)" "$LOG/g1-pasang.txt" | cut -c1-200
    S1=$(snap); echo "SNAP sesudah gagal : $S1"
    [ "$S0b" = "$S1" ] && echo "PRASYARAT GAGAL = TIDAK ADA YANG BERUBAH" || echo "ADA YANG BERUBAH PADAHAL PRASYARAT GAGAL"
    ;;
  gagal2)
    siapkan
    S0=$(snap); echo "SNAP awal : $S0"
    G=/d/Aplikasi/aleta/tmp/w111/paket-gagal; rm -rf "$G"; cp -r "$PK" "$G"; rm -rf "$G/cadangan"
    sed -i "s/'SEMUA COCOK', 'TIDAK COCOK'/'XX COCOK', 'TIDAK COCOK'/" "$G/abt-alamat-putusan-28okt-PERIKSA.sql"
    (cd "$G" && ls | grep -v '^MD5SUMS.txt$' | xargs md5sum > MD5SUMS.txt)
    bash "$G/pasang-satker.sh" > "$LOG/g2-pasang.txt" 2>&1; grep -E "^(PRASYARAT|CADANGAN|FUNGSI|TIDAK|GAGAL|\.\.\.|FUNGSI|PULIH)" "$LOG/g2-pasang.txt" | cut -c1-200
    S1=$(snap); echo "SNAP sesudah gagal : $S1"
    [ "$S0" = "$S1" ] && echo "PERIKSA GAGAL = DIPULIHKAN PERSIS KEADAAN AWAL" || echo "PERIKSA GAGAL TETAPI KEADAAN BEDA DARI AWAL"
    ;;
esac
