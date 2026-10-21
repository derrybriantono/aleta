#!/bin/bash
# Uji lokal paket x11 di ABT laptop (MariaDB XAMPP 10.4): aps_badilag_x11 = sampel abt_keterangan_saksi server SESUDAH x7 (52 baris penutup perkara belum minutasi sudah tiada),
# 20 fungsi persis server + x6 + x7; sipp_x11 = status perkara server; salinan dua BAS P (Kuasa) dari server (baca saja) di folder blangko uji.
# Urutan: PASANG -> pasang ulang -> PULIH (isi tabel & md5 berkas kembali SAMA persis) -> PRASYARAT -> pasang lagi.
export TMP='D:\Aplikasi\aleta\tmp' TEMP='D:\Aplikasi\aleta\tmp'
export PATH="/d/Satker Asal/Website PA Bungku/xampp/mysql/bin:$PATH"
export ABT_LOKAL=1 ABT_DB=${ABT_DB:-aps_badilag_x11} SIPP_DB=${SIPP_DB:-sipp_x11}
BAHAN=${BAHAN:-/d/Aplikasi/aleta/tmp/w30/x7}
export ABT_BLANGKO=${ABT_BLANGKO:-/d/Aplikasi/aleta/tmp/w30/x7/blangko11_kerja}
AKAR=$(cd "$(dirname "$0")/.." && pwd)
PK="$AKAR/paket-satker"
LOG=${LOG:-/d/Aplikasi/aleta/tmp/w30/x7/log11}
mkdir -p "$LOG"
MY="mysql -u root --default-character-set=latin1 -N $ABT_DB"
snap() { $MY -e "SET SESSION group_concat_max_len=1000000000; SELECT COUNT(*), MD5(GROUP_CONCAT(CONCAT_WS('|',id,IFNULL(perkara_id,'~'),IFNULL(sidang_id,'~'),IFNULL(saksi_id,'~'),IFNULL(urutan_pertanyaan,'~'),IFNULL(HEX(pertanyaan),'~'),IFNULL(HEX(jawaban),'~'),IFNULL(diinput_oleh,'~'),IFNULL(diinput_tanggal,'~')) ORDER BY id)) FROM abt_keterangan_saksi"; }
snap_min() { $MY -e "SET SESSION group_concat_max_len=1000000000; SELECT COUNT(*), MD5(GROUP_CONCAT(CONCAT_WS('|',k.id,HEX(k.jawaban),HEX(k.pertanyaan)) ORDER BY k.id)) FROM abt_keterangan_saksi k WHERE EXISTS (SELECT 1 FROM $SIPP_DB.perkara_proses pp WHERE pp.perkara_id = k.perkara_id AND pp.proses_id = 220)"; }
rtfmd5() { (cd "$ABT_BLANGKO/berita_acara_sidang/1 BAS Pertama Standar" && md5sum *.rtf | cut -c1-32 | paste -sd,); }
rm -rf "$ABT_BLANGKO" "$PK/cadangan"; cp -r "$BAHAN/blangko11" "$ABT_BLANGKO"
S0=$(snap); M0=$(snap_min); R0=$(rtfmd5)
echo "SIDIK awal   : saksi=$S0 | minutasi=$M0 | rtf=$R0"
echo "== 1. PASANG"; bash "$PK/pasang-satker.sh" > "$LOG/1-pasang.txt" 2>&1; grep -E "^(PRASYARAT|RTF|SEBELUM|CADANGAN|HAPUS|PERIKSA|SESUDAH|SELESAI|GAGAL)" "$LOG/1-pasang.txt" | cut -c1-220
S1=$(snap); M1=$(snap_min); R1=$(rtfmd5)
echo "SIDIK pasang : saksi=$S1 | minutasi=$M1 | rtf=$R1"
echo "   perkara bercatatan Minutasi tak berubah: $([ "$M0" = "$M1" ] && echo YA || echo TIDAK); id dihapus = harapan JS: $(node "$AKAR/alat/bandingkan_id.js" "$PK/cadangan/id-hapus.txt")"
echo "   md5 RTF sesudah = kunci paket: $(for m in $(echo $R1 | tr , ' '); do grep -c "^[0-9a-f]* $m" "$PK/rtf-md5.txt"; done | paste -sd,) (1,1 = cocok); berkas lain (01-a) utuh: $(md5sum "$ABT_BLANGKO/berita_acara_sidang/1 BAS Pertama Standar/01-a. lain.rtf" | cut -c1-8)"
echo "== 2. pasang ulang"; bash "$PK/pasang-satker.sh" > "$LOG/2-ulang.txt" 2>&1; grep -E "^(PRASYARAT|RTF|SEBELUM|SUDAH|PERIKSA|SESUDAH|SELESAI|GAGAL)" "$LOG/2-ulang.txt" | cut -c1-200
S2=$(snap); R2=$(rtfmd5); echo "SIDIK ulang  : saksi sama=$([ "$S1" = "$S2" ] && echo YA || echo TIDAK) rtf sama=$([ "$R1" = "$R2" ] && echo YA || echo TIDAK)"
echo "== 3. PULIH"; bash "$PK/pulih-satker.sh" > "$LOG/3-pulih.txt" 2>&1; cut -c1-200 "$LOG/3-pulih.txt"
S3=$(snap); R3=$(rtfmd5)
echo "   isi tabel kembali SAMA persis: $([ "$S0" = "$S3" ] && echo YA || echo TIDAK); md5 berkas RTF kembali SAMA persis: $([ "$R0" = "$R3" ] && echo YA || echo TIDAK)"
echo "== 4. pasang lagi"; rm -rf "$PK/cadangan"; bash "$PK/pasang-satker.sh" > "$LOG/4-lagi.txt" 2>&1; grep -E "^(PRASYARAT|RTF|SEBELUM|HAPUS|PERIKSA|SESUDAH|SELESAI|GAGAL)" "$LOG/4-lagi.txt" | cut -c1-200
S4=$(snap); R4=$(rtfmd5); echo "SIDIK akhir  : saksi sama dengan pasang pertama=$([ "$S1" = "$S4" ] && echo YA || echo TIDAK) rtf=$([ "$R1" = "$R4" ] && echo YA || echo TIDAK)"
