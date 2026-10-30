#!/bin/bash
# Uji bolak-balik paket sela-ps-30okt di MariaDB XAMPP laptop, basis milik sendiri aps_badilag_sela30 (= dump server 28 Okt + paket prodeo-panggilan-29okt),
# SIPP baca saja ${SIPP_DB:-sipp_2810} (hanya untuk uji kueri), pohon blangko uji D:/Aplikasi/aleta/tmp/sela30/blangko (folder-ada + dua berkas yang ditimpa).
# Urutan: snap -> PASANG -> pasang ulang (idempoten) -> PULIH (keadaan harus PERSIS awal, berkas baru di arsip) -> pasang lagi -> pulih -> penjaga.
# pakai: bash uji_lokal.sh [semua|pasang]   (log ke D:/Aplikasi/aleta/tmp/sela30/log; paket disalin ke D:/Aplikasi/aleta/tmp/sela30/paket)
export TMP='D:\Aplikasi\aleta\tmp' TEMP='D:\Aplikasi\aleta\tmp'
X="/d/Satker Asal/Website PA Bungku/xampp/mysql/bin"
export PATH="$X:$PATH"
export ABT_LOKAL=1 ABT_DB=aps_badilag_sela30 SIPP_DB=${SIPP_DB:-sipp_2810} PY=python MYSQL_BIN=
UJI=/d/Aplikasi/aleta/tmp/sela30
export ABT_BLANGKO=$UJI/blangko
LOG=$UJI/log
AKAR=$(cd "$(dirname "$0")/.." && pwd)
PK=$UJI/paket
mkdir -p "$LOG"
my() { mysql -h 127.0.0.1 -u root --default-character-set=latin1 -N $ABT_DB "$@"; }
snap() {
  local m v b
  m=$(my -e "SET SESSION group_concat_max_len=1000000000; SELECT COUNT(*), MD5(GROUP_CONCAT(CONCAT_WS('|',id,nama,nama_alias,direktori,parent_direktori,proses_id_min,proses_id_max,IFNULL(perkara_id_min,'~'),IFNULL(perkara_id_max,'~'),IFNULL(perkara_id_referensi,'~'),user_cek,IFNULL(user_grup_id,'~'),IFNULL(user_top_id,'~'),IFNULL(user_validator,'~')) ORDER BY id)) FROM abt_menu" | tr '\t\r' ' ')
  v=$(my -e "SET SESSION group_concat_max_len=1000000000; SELECT COUNT(*), MD5(GROUP_CONCAT(CONCAT_WS('|',no_var,nama,IFNULL(sql_query,'')) ORDER BY no_var)) FROM abt_variabel" | tr '\t\r' ' ')
  b=$(cd "$ABT_BLANGKO" && find . -type f | sort | while IFS= read -r f; do md5sum "$f"; done | md5sum | cut -c1-12)
  echo "menu[$m] variabel[$v] pohon[$b]"
}
salin() { rm -rf "$PK"; cp -r "$AKAR/paket-satker" "$PK"; rm -rf "$PK/cadangan"; }
case "${1:-semua}" in
  pasang) salin; bash "$PK/pasang-satker.sh" ;;
  semua)
    salin
    S0=$(snap); echo "SNAP awal   : $S0"
    echo "== 1. PASANG"; bash "$PK/pasang-satker.sh" > "$LOG/1-pasang.txt" 2>&1; cut -c1-170 "$LOG/1-pasang.txt"
    S1=$(snap); echo "SNAP pasang : $S1"
    echo "== 2. pasang ulang (idempoten)"; bash "$PK/pasang-satker.sh" > "$LOG/2-ulang.txt" 2>&1; grep -v "^uji perkara" "$LOG/2-ulang.txt" | cut -c1-170
    S2=$(snap); echo "SNAP ulang  : $S2"
    [ "$S1" = "$S2" ] && echo "PASANG ULANG = TIDAK ADA PERUBAHAN" || echo "PASANG ULANG MENGUBAH SESUATU"
    echo "== 3. PULIH"; bash "$PK/pulih-satker.sh" > "$LOG/3-pulih.txt" 2>&1; cut -c1-170 "$LOG/3-pulih.txt"
    S3=$(snap); echo "SNAP pulih  : $S3"
    [ "$S0" = "$S3" ] && echo "PULIH = KEADAAN AWAL PERSIS (menu, variabel, pohon blangko)" || echo "PULIH BEDA DARI KEADAAN AWAL"
    echo "   arsip pulih: $(find "$PK/cadangan/pulih-arsip" -type f | wc -l) berkas (tidak ada yang dihapus permanen)"
    echo "== 4. PRASYARAT sesudah pulih (harus $(sed -n 1p "$PK/harap.txt"))"; my < "$PK/abt-sela-ps-30okt-PRASYARAT.sql"
    echo "== 5. pasang lagi"; bash "$PK/pasang-satker.sh" > "$LOG/4-lagi.txt" 2>&1; tail -n 2 "$LOG/4-lagi.txt"
    S4=$(snap); echo "SNAP lagi   : $S4"
    [ "$S4" = "$S1" ] && echo "PASANG LAGI = SAMA DENGAN PASANG PERTAMA" || echo "PASANG LAGI BEDA DARI PASANG PERTAMA"
    echo "== 6. PULIH lagi"; bash "$PK/pulih-satker.sh" > "$LOG/5-pulih2.txt" 2>&1; tail -n 2 "$LOG/5-pulih2.txt"
    echo "== 7. PENJAGA: menu 151 dipakai lain -> pasang HARUS berhenti tanpa mengubah apa pun"
    S5=$(snap)
    my -e "INSERT INTO abt_menu (id, nama, nama_alias, direktori, parent_direktori, proses_id_min, proses_id_max, user_cek) VALUES (151, 'uji', 'uji', 'uji', 'uji', 1, 1, 0)"
    bash "$PK/pasang-satker.sh" > "$LOG/6-penjaga.txt" 2>&1; cut -c1-200 "$LOG/6-penjaga.txt" | tail -2
    my -e "DELETE FROM abt_menu WHERE id = 151 AND nama = 'uji'"
    S6=$(snap); [ "$S5" = "$S6" ] && echo "PENJAGA 1: TIDAK ADA YANG BERUBAH" || echo "PENJAGA 1: ADA YANG BERUBAH ($S5 -> $S6)"
    echo "== 8. PENJAGA: berkas yang akan ditimpa sudah disunting orang -> pasang HARUS berhenti"
    F="$ABT_BLANGKO/derry_briantono/4a Harta Bersama - BAS/BAS ALUR 30 HB - Sidang PS - Pemeriksaan Setempat di Lokasi Objek (antara ALUR 04 [7] dan [8]).rtf"
    cp "$F" "$UJI/simpan-ps.rtf"; printf ' ' >> "$F"; S7=$(snap)
    bash "$PK/pasang-satker.sh" > "$LOG/7-penjaga2.txt" 2>&1; tail -n 2 "$LOG/7-penjaga2.txt" | cut -c1-200
    S8=$(snap); [ "$S7" = "$S8" ] && echo "PENJAGA 2: TIDAK ADA YANG BERUBAH" || echo "PENJAGA 2: ADA YANG BERUBAH"
    cp "$UJI/simpan-ps.rtf" "$F"; rm -f "$UJI/simpan-ps.rtf"
    S9=$(snap); [ "$S9" = "$S0" ] && echo "AKHIR = KEADAAN AWAL" || echo "AKHIR BEDA DARI AWAL"
    ;;
esac
