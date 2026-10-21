#!/bin/bash
# Uji lokal paket x6 di ABT laptop (MariaDB XAMPP 10.4): basis aps_badilag_x6 = abt_variabel server 21 Okt (alat/siapkan_lab.py) + tabel
# abt_keterangan_saksi SALINAN data server (dump baca-saja, D:/Aplikasi/aleta/tmp/w30/ks_semua.tsv, di luar repo) + 20 fungsi isian_rtf_*
# persis seperti di server (SHOW CREATE FUNCTION, nama basis diganti). Keadaan awal = server sebelum paket (fungsi lama).
# Urutan: siapkan -> PASANG -> PERIKSA -> pasang ulang -> PULIH (md5 definisi harus kembali SAMA dengan server) -> PRASYARAT -> pasang lagi.
export TMP='D:\Aplikasi\aleta\tmp' TEMP='D:\Aplikasi\aleta\tmp'
export PATH="/d/Satker Asal/Website PA Bungku/xampp/mysql/bin:$PATH"
export ABT_LOKAL=1
export ABT_DB=${ABT_DB:-aps_badilag_x6}
AKAR=$(cd "$(dirname "$0")/.." && pwd)
PK="$AKAR/paket-satker"
LOG=${LOG:-/d/Aplikasi/aleta/tmp/w30/log}
mkdir -p "$LOG"
MY="mysql -u root --default-character-set=latin1 -N $ABT_DB"
md5fn() { $MY -e "SELECT MD5(REPLACE(routine_definition, '$ABT_DB.abt_', 'aps_badilag.abt_')) FROM information_schema.routines WHERE routine_schema='$ABT_DB' AND routine_name='isian_rtf_ket_saksi'"; }
daftarfn() { $MY -e "SELECT GROUP_CONCAT(routine_name ORDER BY routine_name) FROM information_schema.routines WHERE routine_schema='$ABT_DB' AND routine_name LIKE 'isian\\_rtf\\_%'" | tr ',' ' ' | wc -w; }
case "${1:-semua}" in
  lama)
    # kembalikan fungsi ke keadaan server (sebelum paket): fungsi-lama.sql + buang dua fungsi baru
    $MY -e "DROP FUNCTION IF EXISTS isian_rtf_saring_penutup; DROP FUNCTION IF EXISTS isian_rtf_penutup;"
    sed "s/aps_badilag\./$ABT_DB./g" "$PK/fungsi-lama.sql" | mysql -u root --default-character-set=latin1 $ABT_DB
    echo "md5 lama: $(md5fn) (server: f984ebccf51a11d4f3779cc9092fd491); fungsi isian_rtf_*: $(daftarfn)"
    ;;
  semua)
    bash "$0" lama
    rm -rf "$PK/cadangan"
    echo "== 1. PASANG"; bash "$PK/pasang-satker.sh" > "$LOG/1-pasang.txt" 2>&1; grep -E "^(PRASYARAT|MODE|CADANGAN|SEBELUM|PERIKSA|SESUDAH|FUNGSI|SELESAI|GAGAL)" "$LOG/1-pasang.txt" | cut -c1-200
    echo "md5 sesudah pasang: $(md5fn); fungsi: $(daftarfn)"
    echo "== 2. pasang ulang"; bash "$PK/pasang-satker.sh" > "$LOG/2-ulang.txt" 2>&1; grep -E "^(PRASYARAT|MODE|SUDAH|PERIKSA|SESUDAH|SELESAI|GAGAL)" "$LOG/2-ulang.txt" | cut -c1-200
    echo "== 3. PULIH"; bash "$PK/pulih-satker.sh" > "$LOG/3-pulih.txt" 2>&1; cat "$LOG/3-pulih.txt" | cut -c1-200
    echo "md5 sesudah pulih: $(md5fn) (harus = md5 lama); fungsi: $(daftarfn)"
    echo "== 4. PRASYARAT sesudah pulih"; $MY < "$PK/abt-x6-penutup-saksi-21okt-PRASYARAT.sql"
    echo "== 5. pasang lagi"; rm -rf "$PK/cadangan"; bash "$PK/pasang-satker.sh" > "$LOG/4-lagi.txt" 2>&1; grep -E "^(PRASYARAT|MODE|SEBELUM|PERIKSA|SESUDAH|SELESAI|GAGAL)" "$LOG/4-lagi.txt" | cut -c1-200
    echo "md5 akhir: $(md5fn); fungsi: $(daftarfn)"
    ;;
esac
