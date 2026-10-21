#!/bin/bash
# Uji lokal paket x7 di ABT laptop (MariaDB XAMPP 10.4): basis aps_badilag_x7 = SAMPEL abt_keterangan_saksi server (semua perkara tanpa catatan
# Minutasi + 120 perkara minutasi ber-penutup + 60 minutasi tanpa penutup; dump baca-saja, di luar repo) + abt_keterangan_terdakwa penuh +
# 20 fungsi isian_rtf_* persis server + paket x6 terpasang; sipp_x7 = status perkara (proses_terakhir_id, ada tidaknya proses 220) dari SIPP server.
# Urutan: keadaan awal (server sebelum x7) -> PASANG -> periksa angka & isi -> pasang ulang -> PULIH (isi tabel harus kembali SAMA persis) -> PRASYARAT -> pasang lagi.
export TMP='D:\Aplikasi\aleta\tmp' TEMP='D:\Aplikasi\aleta\tmp'
export PATH="/d/Satker Asal/Website PA Bungku/xampp/mysql/bin:$PATH"
export ABT_LOKAL=1
export ABT_DB=${ABT_DB:-aps_badilag_x7}
export SIPP_DB=${SIPP_DB:-sipp_x7}
AKAR=$(cd "$(dirname "$0")/.." && pwd)
PK="$AKAR/paket-satker"
LOG=${LOG:-/d/Aplikasi/aleta/tmp/w30/x7/log}
mkdir -p "$LOG"
MY="mysql -u root --default-character-set=latin1 -N $ABT_DB"
md5fn() { $MY -e "SELECT MD5(REPLACE(routine_definition, '$ABT_DB.abt_', 'aps_badilag.abt_')) FROM information_schema.routines WHERE routine_schema='$ABT_DB' AND routine_name='isian_rtf_keterangan'"; }
# sidik jari isi tabel (seluruh kolom, HEX): semua baris, dan hanya baris yang BUKAN id yang dihapus
snap() { $MY -e "SET SESSION group_concat_max_len=1000000000; SELECT COUNT(*), MD5(GROUP_CONCAT(CONCAT_WS('|',id,IFNULL(perkara_id,'~'),IFNULL(sidang_id,'~'),IFNULL(penanya_id,'~'),IFNULL(saksi_id,'~'),IFNULL(urutan_pertanyaan,'~'),IFNULL(HEX(pertanyaan),'~'),IFNULL(HEX(jawaban),'~'),IFNULL(diinput_oleh,'~'),IFNULL(diinput_tanggal,'~')) ORDER BY id)) FROM abt_keterangan_saksi"; }
snap_td() { $MY -e "SET SESSION group_concat_max_len=1000000000; SELECT COUNT(*), MD5(GROUP_CONCAT(CONCAT_WS('|',id,IFNULL(perkara_id,'~'),IFNULL(pihak_id,'~'),IFNULL(HEX(pertanyaan),'~'),IFNULL(HEX(jawaban),'~')) ORDER BY id)) FROM abt_keterangan_terdakwa"; }
snap_min() { $MY -e "SET SESSION group_concat_max_len=1000000000; SELECT COUNT(*), MD5(GROUP_CONCAT(CONCAT_WS('|',k.id,HEX(k.jawaban),HEX(k.pertanyaan)) ORDER BY k.id)) FROM abt_keterangan_saksi k WHERE NOT (EXISTS (SELECT 1 FROM $SIPP_DB.perkara p WHERE p.perkara_id = k.perkara_id AND p.proses_terakhir_id < 220) AND NOT EXISTS (SELECT 1 FROM $SIPP_DB.perkara_proses pp WHERE pp.perkara_id = k.perkara_id AND pp.proses_id = 220))"; }
case "${1:-semua}" in
  lama)
    # fungsi ke keadaan server sebelum x7 (isian_rtf_keterangan dari fungsi-lama.sql)
    sed "s/aps_badilag\./$ABT_DB./g" "$PK/fungsi-lama.sql" | mysql -u root --default-character-set=latin1 $ABT_DB
    echo "md5 isian_rtf_keterangan lama: $(md5fn) (server: 9b005e6442a8b8731f97f3b8dbe98a61)"
    ;;
  semua)
    bash "$0" lama
    rm -rf "$PK/cadangan"
    S0=$(snap); T0=$(snap_td); M0=$(snap_min)
    echo "SIDIK awal   : saksi=$S0 | terdakwa=$T0 | minutasi=$M0"
    echo "== 1. PASANG"; bash "$PK/pasang-satker.sh" > "$LOG/1-pasang.txt" 2>&1; grep -E "^(PRASYARAT|MODE|CADANGAN|SEBELUM|HAPUS|PERIKSA|SESUDAH|PER PERKARA|SELESAI|GAGAL)" "$LOG/1-pasang.txt" | cut -c1-230
    S1=$(snap); T1=$(snap_td); M1=$(snap_min)
    echo "SIDIK pasang : saksi=$S1 | terdakwa=$T1 | minutasi=$M1"
    echo "   perkara minutasi tak berubah: $([ "$M0" = "$M1" ] && echo YA || echo TIDAK); terdakwa tak berubah: $([ "$T0" = "$T1" ] && echo YA || echo TIDAK)"
    echo "   id dihapus = harapan JS: $(node "$AKAR/alat/bandingkan_id.js" "$PK/cadangan/id-hapus.txt")"
    echo "== 2. pasang ulang"; bash "$PK/pasang-satker.sh" > "$LOG/2-ulang.txt" 2>&1; grep -E "^(PRASYARAT|MODE|SEBELUM|SUDAH|PERIKSA|SESUDAH|SELESAI|GAGAL)" "$LOG/2-ulang.txt" | cut -c1-200
    S2=$(snap); echo "SIDIK ulang  : saksi=$S2 ($([ "$S1" = "$S2" ] && echo sama || echo BEDA))"
    echo "== 3. PULIH"; bash "$PK/pulih-satker.sh" > "$LOG/3-pulih.txt" 2>&1; cut -c1-200 "$LOG/3-pulih.txt"
    S3=$(snap); T3=$(snap_td)
    echo "SIDIK pulih  : saksi=$S3 | terdakwa=$T3"
    echo "   isi tabel kembali SAMA persis dengan awal: saksi $([ "$S0" = "$S3" ] && echo YA || echo TIDAK); terdakwa $([ "$T0" = "$T3" ] && echo YA || echo TIDAK); md5 fungsi $(md5fn)"
    echo "== 4. PRASYARAT sesudah pulih"; sed -e "s/__SIPP__/$SIPP_DB/g" -e "s/aps_badilag\./$ABT_DB./g" "$PK/abt-x7-bersih-penutup-21okt-PRASYARAT.sql" | $MY
    echo "== 5. pasang lagi"; rm -rf "$PK/cadangan"; bash "$PK/pasang-satker.sh" > "$LOG/4-lagi.txt" 2>&1; grep -E "^(PRASYARAT|MODE|SEBELUM|HAPUS|PERIKSA|SESUDAH|SELESAI|GAGAL)" "$LOG/4-lagi.txt" | cut -c1-200
    S4=$(snap); echo "SIDIK akhir  : saksi=$S4 ($([ "$S1" = "$S4" ] && echo sama-dengan-pasang-pertama || echo BEDA))"
    ;;
esac
