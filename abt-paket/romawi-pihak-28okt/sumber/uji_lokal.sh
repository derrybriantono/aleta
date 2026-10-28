#!/bin/bash
# Uji bolak-balik paket romawi-pihak-28okt di ABT laptop (MariaDB XAMPP). Basis uji (ABT_DB, bawaan aps_badilag_rm1) = salinan keadaan server SESUDAH paket 27 Okt dan paket sisa 28 Okt
# (dibuat dari mysqldump --routines basis aps_badilag_rm0: 2.677 baris abt_variabel, 50 fungsi).
# Urutan: siapkan -> PASANG -> PERIKSA -> pasang ulang (idempoten) -> PULIH (keadaan harus PERSIS sama dengan awal: variabel dan fungsi) -> PRASYARAT sesudah pulih -> pasang lagi.
# Jalur gagal (mode "gagal"): (1) prasyarat tak cocok (satu baris diubah orang lain) berhenti tanpa mengubah apa pun; (2) PERIKSA dibuat gagal -> dipulihkan otomatis;
#                              (3) UJI atas data nyata dibuat gagal -> dipulihkan otomatis.
# pakai: bash uji_lokal.sh [siapkan|snap|semua|gagal]   (hasil ke D:/Aplikasi/aleta/tmp/w109/log)
export TMP='D:\Aplikasi\aleta\tmp' TEMP='D:\Aplikasi\aleta\tmp'
export PATH="/d/Satker Asal/Website PA Bungku/xampp/mysql/bin:$PATH"
export ABT_LOKAL=1 ABT_DB=${ABT_DB:-aps_badilag_rm1} SIPP_DB=sipp_donggala
AKAR=$(cd "$(dirname "$0")/.." && pwd)
PK=$AKAR/paket-satker
DUMP=${DUMP:-D:/Aplikasi/aleta/tmp/w109/rm0-dump.sql}
LOG=${LOG:-/d/Aplikasi/aleta/tmp/w109/log}
mkdir -p "$LOG"
snap() {
  local v f
  v=$(timeout 120 mysql -u root --default-character-set=latin1 -N $ABT_DB -e "SET SESSION group_concat_max_len=1000000000; SELECT COUNT(*), MD5(GROUP_CONCAT(CONCAT_WS('|',no_var,HEX(nama),IFNULL(data_type,'~'),IFNULL(data_tabel,'~'),IFNULL(data_kolom,'~'),IFNULL(urutan_data,'~'),IFNULL(referensi,'~'),IFNULL(HEX(sql_query),'~'),IFNULL(HEX(default_data),'~'),IFNULL(multi_sidang,'~'),locked,IFNULL(modifier,'~'),modified) ORDER BY no_var)) FROM abt_variabel" | tr '\t\r' ' ')
  f=$(timeout 60 mysql -u root -N -e "SELECT COUNT(*), IFNULL(MD5(GROUP_CONCAT(CONCAT(routine_name,MD5(REPLACE(routine_definition,'$ABT_DB.','X.'))) ORDER BY routine_name)),'-') FROM information_schema.routines WHERE routine_schema='$ABT_DB'" | tr '\t\r' ' ')
  echo "variabel[$v] fungsi[$f]"
}
siapkan() {
  timeout 60 mysql -u root -e "DROP DATABASE IF EXISTS $ABT_DB; CREATE DATABASE $ABT_DB DEFAULT CHARSET latin1"
  timeout 300 mysql -u root --default-character-set=latin1 $ABT_DB < "$DUMP"
  rm -rf "$PK/cadangan"
}
prasyarat() {
  sed "s/MD5(routine_definition)/MD5(REPLACE(routine_definition, 'sipp_donggala.', 'SIPP.'))/g" "$PK/abt-romawi-pihak-28okt-PRASYARAT.sql" | timeout 120 mysql -u root --default-character-set=latin1 -N $ABT_DB
}
# salin paket ke folder sementara (tanpa cadangan) untuk jalur gagal; $1 = nama folder
salin() { local d=/d/Aplikasi/aleta/tmp/w109/jalur-$1; rm -rf "$d"; mkdir -p "$d"; cp "$PK"/* "$d"/ 2>/dev/null; echo "$d"; }
md5baru() { ( cd "$1" && rm -f MD5SUMS.txt && md5sum $(ls | grep -v '^cadangan$') > MD5SUMS.txt ); }
case "${1:-semua}" in
  siapkan) siapkan ;;
  snap) snap ;;
  semua)
    siapkan
    S0=$(snap); echo "SNAP awal   : $S0"
    echo "== 0. PRASYARAT awal (harus $(sed -n 1p "$PK/harap.txt"))"; prasyarat
    echo "== 1. PASANG"; timeout 900 bash "$PK/pasang-satker.sh" > "$LOG/1-pasang.txt" 2>&1; grep -E "^(PRASYARAT|CADANGAN|SEMUA|UJI|GAGAL|SELESAI)" "$LOG/1-pasang.txt" | cut -c1-170
    S1=$(snap); echo "SNAP pasang : $S1"
    echo "== 2. pasang ulang (idempoten)"; timeout 900 bash "$PK/pasang-satker.sh" > "$LOG/2-ulang.txt" 2>&1; grep -E "^(PRASYARAT|PASANG ULANG|SEMUA|GAGAL|SELESAI)" "$LOG/2-ulang.txt" | cut -c1-170
    S2=$(snap); echo "SNAP ulang  : $S2"
    [ "$S1" = "$S2" ] && echo "PASANG ULANG = TIDAK ADA PERUBAHAN" || echo "PASANG ULANG MENGUBAH SESUATU"
    echo "== 3. PULIH"; timeout 300 bash "$PK/pulih-satker.sh" > "$LOG/3-pulih.txt" 2>&1; tail -n 4 "$LOG/3-pulih.txt"
    S3=$(snap); echo "SNAP pulih  : $S3"
    [ "$S0" = "$S3" ] && echo "PULIH = KEADAAN AWAL PERSIS (variabel dan fungsi)" || echo "PULIH BEDA DARI KEADAAN AWAL"
    echo "== 4. PRASYARAT sesudah pulih (harus sama dengan harap pertama: $(sed -n 1p "$PK/harap.txt"))"; prasyarat
    echo "== 5. pasang lagi"; timeout 900 bash "$PK/pasang-satker.sh" > "$LOG/4-lagi.txt" 2>&1; grep -E "^(PRASYARAT|CADANGAN|SEMUA|GAGAL|SELESAI)" "$LOG/4-lagi.txt" | cut -c1-170
    S4=$(snap); echo "SNAP lagi   : $S4"
    [ "$S4" = "$S1" ] && echo "PASANG LAGI = SAMA DENGAN PASANG PERTAMA" || echo "PASANG LAGI BEDA DARI PASANG PERTAMA"
    ;;
  gagal)
    siapkan; rm -rf "$PK/cadangan"
    S0=$(snap); echo "SNAP awal: $S0"
    echo "== G1. prasyarat tak cocok: 5890 ditambah spasi oleh 'orang lain'"
    timeout 60 mysql -u root --default-character-set=latin1 $ABT_DB -e "UPDATE abt_variabel SET sql_query=CONCAT(sql_query,' ') WHERE no_var=5890"
    SX=$(snap)
    timeout 900 bash "$PK/pasang-satker.sh" 2>&1 | grep -E "^(PRASYARAT|GAGAL|SELESAI)" | cut -c1-200
    [ "$SX" = "$(snap)" ] && echo "G1: TIDAK ADA YANG BERUBAH" || echo "G1: ADA YANG BERUBAH (SALAH)"
    siapkan
    echo "== G1b. basis tanpa paket sisa (fungsi peringkat dihapus)"
    timeout 60 mysql -u root $ABT_DB -e "DROP FUNCTION isian_rtf_pihak_peringkat"
    SX=$(snap)
    timeout 900 bash "$PK/pasang-satker.sh" 2>&1 | grep -E "^(PRASYARAT|GAGAL|SELESAI)" | cut -c1-200
    [ "$SX" = "$(snap)" ] && echo "G1b: TIDAK ADA YANG BERUBAH" || echo "G1b: ADA YANG BERUBAH (SALAH)"
    siapkan
    echo "== G2. PERIKSA dibuat gagal (syarat diubah menjadi mustahil di salinan paket)"
    D=$(salin g2); sed -i "s/= 7 AND/= 8 AND/" "$D/abt-romawi-pihak-28okt-PERIKSA.sql"; md5baru "$D"
    timeout 900 bash "$D/pasang-satker.sh" 2>&1 | grep -E "^(PRASYARAT|CADANGAN|SEMUA|TIDAK|GAGAL|SELESAI|\.\.\.|PULIH)" | cut -c1-200
    S2=$(snap); [ "$S0" = "$S2" ] && echo "G2: KEADAAN AWAL PERSIS" || echo "G2: BEDA DARI AWAL (SALAH)"
    siapkan
    echo "== G3. UJI atas data nyata dibuat gagal (kueri baru di salinan paket dirusak)"
    D=$(salin g3); sed -i "s/BETWEEN 2 AND 1+CEIL/BETWEEN 3 AND 1+CEIL/" "$D/abt-romawi-pihak-28okt-UJIVAR-BARU.sql"; md5baru "$D"
    timeout 900 bash "$D/pasang-satker.sh" 2>&1 | grep -E "^(PRASYARAT|CADANGAN|SEMUA|UJI rapat|GAGAL|SELESAI|\.\.\.|PULIH)" | cut -c1-200 | head -30
    S3=$(snap); [ "$S0" = "$S3" ] && echo "G3: KEADAAN AWAL PERSIS" || echo "G3: BEDA DARI AWAL (SALAH)"
    ;;
esac
