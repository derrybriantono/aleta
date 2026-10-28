#!/bin/bash
# Uji bolak-balik paket court-calendar-28okt di ABT laptop (MariaDB XAMPP), basis milik sendiri aps_badilag_cc (dibuat dari dump keadaan server sesudah paket 27 Okt:
# abt_variabel 2.677 baris, 49 fungsi; abt_menu dan abt_menu_grup disalin dari aps_badilag lokal, hanya SELECT atas sumber).
# Urutan: siapkan -> PASANG -> pasang ulang (idempoten) -> PULIH (keadaan harus PERSIS sama dengan awal) -> pasang lagi -> pulih -> penjaga (prasyarat dilanggar).
# pakai: bash uji_lokal.sh [siapkan|semua]   (hasil ke D:/Aplikasi/aleta/tmp/cc/log; paket disalin ke jalur pendek D:/Aplikasi/aleta/tmp/cc/paket)
export TMP='D:\Aplikasi\aleta\tmp' TEMP='D:\Aplikasi\aleta\tmp'
export PATH="/d/Satker Asal/Website PA Bungku/xampp/mysql/bin:$PATH"
export ABT_LOKAL=1 ABT_DB=aps_badilag_cc PY=python
UJI=/d/Aplikasi/aleta/tmp/cc
export ABT_BLANGKO=$UJI/blangko
DUMP=${DUMP:-D:/Aplikasi/aleta/tmp/w105/pu3-dump.sql}
LOG=$UJI/log
AKAR=$(cd "$(dirname "$0")/.." && pwd)
PK=$UJI/paket
mkdir -p "$LOG"
snap() {
  local m b
  m=$(mysql -u root --default-character-set=latin1 -N $ABT_DB -e "SET SESSION group_concat_max_len=1000000000; SELECT COUNT(*), MD5(GROUP_CONCAT(CONCAT_WS('|',id,nama,nama_alias,direktori,parent_direktori,proses_id_min,proses_id_max,IFNULL(perkara_id_min,'~'),IFNULL(perkara_id_max,'~'),IFNULL(perkara_id_referensi,'~'),user_cek,IFNULL(user_grup_id,'~'),IFNULL(user_top_id,'~'),IFNULL(user_validator,'~')) ORDER BY id)) FROM abt_menu" | tr '\t\r' ' ')
  v=$(mysql -u root --default-character-set=latin1 -N $ABT_DB -e "SELECT COUNT(*) FROM abt_variabel" | tr -d '\r')
  b=$(find "$ABT_BLANGKO" | sort | md5sum | cut -c1-12)
  echo "menu[$m] variabel[$v] pohon[$b]"
}
siapkan() {
  mysql -u root -e "DROP DATABASE IF EXISTS $ABT_DB; CREATE DATABASE $ABT_DB DEFAULT CHARSET latin1"
  mysql -u root --default-character-set=latin1 $ABT_DB < "$DUMP"
  mysql -u root $ABT_DB -e "CREATE TABLE abt_menu LIKE aps_badilag.abt_menu; INSERT INTO abt_menu SELECT * FROM aps_badilag.abt_menu; CREATE TABLE abt_menu_grup LIKE aps_badilag.abt_menu_grup; INSERT INTO abt_menu_grup SELECT * FROM aps_badilag.abt_menu_grup"
  rm -rf "$UJI/blangko" "$PK"
  mkdir -p "$UJI/blangko/derry_briantono/ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)"
  cp -r "$AKAR/paket-satker" "$PK"
}
case "${1:-semua}" in
  siapkan) siapkan ;;
  semua)
    siapkan
    S0=$(snap); echo "SNAP awal   : $S0"
    echo "== 1. PASANG"; bash "$PK/pasang-satker.sh" > "$LOG/1-pasang.txt" 2>&1; cut -c1-170 "$LOG/1-pasang.txt"
    S1=$(snap); echo "SNAP pasang : $S1"
    echo "== 2. pasang ulang (idempoten)"; bash "$PK/pasang-satker.sh" > "$LOG/2-ulang.txt" 2>&1; cut -c1-170 "$LOG/2-ulang.txt"
    S2=$(snap); echo "SNAP ulang  : $S2"
    [ "$S1" = "$S2" ] && echo "PASANG ULANG = TIDAK ADA PERUBAHAN" || echo "PASANG ULANG MENGUBAH SESUATU"
    echo "== 3. PULIH"; bash "$PK/pulih-satker.sh" > "$LOG/3-pulih.txt" 2>&1; cut -c1-170 "$LOG/3-pulih.txt"
    S3=$(snap); echo "SNAP pulih  : $S3"
    [ "$S0" = "$S3" ] && echo "PULIH = KEADAAN AWAL PERSIS (menu, variabel, pohon blangko)" || echo "PULIH BEDA DARI KEADAAN AWAL"
    echo "== 4. PRASYARAT sesudah pulih (harus 37|0|1)"
    mysql -u root --default-character-set=latin1 -N $ABT_DB < "$PK/abt-court-calendar-28okt-PRASYARAT.sql"
    echo "== 5. pasang lagi"; bash "$PK/pasang-satker.sh" > "$LOG/4-lagi.txt" 2>&1; cut -c1-170 "$LOG/4-lagi.txt"
    S4=$(snap); echo "SNAP lagi   : $S4"
    [ "$S4" = "$S1" ] && echo "PASANG LAGI = SAMA DENGAN PASANG PERTAMA" || echo "PASANG LAGI BEDA DARI PASANG PERTAMA"
    echo "== 6. PULIH lagi"; bash "$PK/pulih-satker.sh" > "$LOG/5-pulih2.txt" 2>&1; tail -n 3 "$LOG/5-pulih2.txt"
    echo "== 7. PENJAGA: menu 963 berubah hak -> pasang HARUS berhenti tanpa mengubah apa pun"
    S5=$(snap)
    mysql -u root $ABT_DB -e "UPDATE abt_menu SET user_validator='10' WHERE id=963"
    bash "$PK/pasang-satker.sh" > "$LOG/6-penjaga.txt" 2>&1; cut -c1-200 "$LOG/6-penjaga.txt"
    mysql -u root $ABT_DB -e "UPDATE abt_menu SET user_validator='10|20' WHERE id=963"
    S6=$(snap); [ "$S5" = "$S6" ] && echo "PENJAGA: TIDAK ADA YANG BERUBAH" || echo "PENJAGA: ADA YANG BERUBAH ($S5 -> $S6)"
    echo "== 8. PENJAGA: folder baru sudah ada sebelum paket terpasang -> pasang HARUS berhenti"
    mkdir -p "$ABT_BLANGKO/derry_briantono/98c Court Calendar - BAS"
    echo x > "$ABT_BLANGKO/derry_briantono/98c Court Calendar - BAS/Court Calendar - Penetapan Jadwal Persidangan.rtf"
    bash "$PK/pasang-satker.sh" > "$LOG/7-penjaga2.txt" 2>&1; cut -c1-200 "$LOG/7-penjaga2.txt"
    rm -rf "$ABT_BLANGKO/derry_briantono/98c Court Calendar - BAS"
    ;;
esac
