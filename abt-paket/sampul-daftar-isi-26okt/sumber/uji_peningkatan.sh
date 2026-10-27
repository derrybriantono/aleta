#!/bin/bash
# Uji PENINGKATAN di ABT LAPTOP (bukan server): paket SEBELUMNYA (yang sudah terpasang di server) dipasang dulu di basis uji, lalu paket ini dipasang DI ATASNYA.
# Memeriksa: PRASYARAT mengenali keadaan terpasang, SEMUA COCOK, berkas RTF diganti, isian yang sudah ada tidak hilang, pasang ulang aman, PULIH = keadaan paket sebelumnya PERSIS
# (variabel, berkas), lalu pasang lagi, pulih lagi, dan terakhir pulih paket sebelumnya = keadaan awal (sebelum paket apa pun) PERSIS.
# Pakai (Git Bash):  bash sumber/uji_peningkatan.sh [rujukan git paket sebelumnya, bawaan origin/integrasi-1205-41b]     Hasil di D:/Aplikasi/aleta/tmp/uji-s2 (di luar repo).
SINI="$(cd "$(dirname "$0")/.." && pwd)"
RUJ="${1:-origin/integrasi-1205-41b}"
export PATH="/d/Satker Asal/Website PA Bungku/xampp/mysql/bin:$PATH"
T=/d/Aplikasi/aleta/tmp/uji-s2
rm -rf "$T"; mkdir -p "$T/blangko/derry_briantono/99 PTSP" "$T/lama" "$T/baru"
echo x > "$T/blangko/derry_briantono/99 PTSP/@ 0 - PMH - PHS.rtf"
bash "$SINI/sumber/siapkan_lab.sh" >/dev/null 2>&1
REPO="$(git -C "$SINI" rev-parse --show-toplevel)"
REL="$(git -C "$SINI" rev-parse --show-prefix)"; REL="${REL%/}"
git -C "$REPO" archive "$RUJ" "$REL/paket-satker" | tar -x -C "$T/lama" || { echo "GAGAL: paket sebelumnya tidak terbaca dari $RUJ"; exit 1; }
cp -r "$T/lama/$REL/paket-satker/"* "$T/lama/"; rm -rf "$T/lama/abt-paket"
cp -r "$SINI/paket-satker/"* "$T/baru/"
export ABT_LOKAL=1 ABT_DB=aps_badilag_s1 ABT_BLANGKO="$T/blangko" SIPP_DB=sipp_donggala
snap() {
  mysql -h127.0.0.1 -uroot -N -e "SELECT COUNT(*), MD5(GROUP_CONCAT(CONCAT_WS('|',no_var,nama,data_type,IFNULL(sql_query,''),locked) ORDER BY no_var SEPARATOR '#')) FROM aps_badilag_s1.abt_variabel; SELECT COUNT(*), MAX(id) FROM aps_badilag_s1.abt_menu; SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema='aps_badilag_s1' AND routine_name LIKE 'isian_rtf_daftar%'; SELECT COUNT(*), IFNULL(MD5(GROUP_CONCAT(CONCAT_WS('|',no_var,perkara_id,data) ORDER BY no_var,perkara_id SEPARATOR '#')),'-') FROM aps_badilag_s1.abt_data_teks" | tr '\n\t' '  '
  (cd "$T/blangko" && find . -type f | sort | while read -r f; do printf '%s ' "$f"; md5sum < "$f"; done | md5sum | cut -c1-32)
  find "$T/blangko" -type d | wc -l
}
ok=1
cek() { if [ "$1" = "$2" ]; then echo "  OK  $3"; else echo "  GAGAL  $3 (dapat '$1', harap '$2')"; ok=0; fi; }

S0=$(snap | tr '\n' ' '); echo "KEADAAN AWAL: $S0"
echo "== 1. pasang paket SEBELUMNYA ($RUJ)"
( cd "$T/lama" && bash pasang-satker.sh 2>&1 | grep -E "PRASYARAT|SEMUA|SELESAI|GAGAL|COCOK" )
# isian yang sudah ada pada variabel yang akan ditingkatkan (harus tetap ada)
mysql -h127.0.0.1 -uroot aps_badilag_s1 -e "INSERT INTO abt_data_teks (no_var,perkara_id,data,modifier) VALUES (5806,99001,'KUASA UJI','uji'),(5807,99001,'GHAIB T','uji')"
S1=$(snap | tr '\n' ' '); echo "TERPASANG (paket sebelumnya): $S1"
echo "== 2. PENINGKATAN: pasang paket ini di atasnya"
( cd "$T/baru" && bash pasang-satker.sh 2>&1 | tee "$T/peningkatan.log" | grep -E "PRASYARAT|SEMUA|SELESAI|GAGAL|COCOK|UJI|PENINGKATAN" )
grep -q "PENINGKATAN: 70 variabel" "$T/peningkatan.log" && echo "  OK  PRASYARAT mengenali keadaan terpasang (PENINGKATAN)" || { echo "  GAGAL  PRASYARAT tidak mengenali keadaan terpasang"; ok=0; }
grep -q "^SELESAI" "$T/peningkatan.log" || { echo "  GAGAL  peningkatan tidak selesai"; ok=0; }
S2=$(snap | tr '\n' ' ')
ISIAN=$(mysql -h127.0.0.1 -uroot -N aps_badilag_s1 -e "SELECT COUNT(*) FROM abt_data_teks WHERE perkara_id=99001")
cek "$ISIAN" "2" "isian yang sudah ada tetap ada sesudah peningkatan"
echo "== 3. pasang ulang (idempoten)"
( cd "$T/baru" && bash pasang-satker.sh 2>&1 | tee "$T/ulang.log" | grep -E "PRASYARAT|SEMUA|SELESAI|GAGAL|COCOK" )
S3=$(snap | tr '\n' ' ')
cek "$S3" "$S2" "pasang ulang tidak mengubah apa pun"
echo "== 4. PULIH (kembali ke paket sebelumnya)"
( cd "$T/baru" && bash pulih-satker.sh 2>&1 | grep -E "PULIH|PERINGATAN|GAGAL|BERKAS" )
S4=$(snap | tr '\n' ' ')
cek "$S4" "$S1" "pulih = keadaan paket sebelumnya PERSIS (variabel, berkas, isian)"
echo "== 5. peningkatan lagi + pulih lagi (siklus kedua)"
( cd "$T/baru" && bash pasang-satker.sh 2>&1 | grep -E "PRASYARAT|SEMUA|SELESAI|GAGAL" )
S5=$(snap | tr '\n' ' ')
cek "$S5" "$S2" "peningkatan kedua = hasil peningkatan pertama"
( cd "$T/baru" && bash pulih-satker.sh 2>&1 | grep -E "PULIH COCOK|PERINGATAN|GAGAL" )
S6=$(snap | tr '\n' ' ')
cek "$S6" "$S1" "pulih kedua = keadaan paket sebelumnya PERSIS"
echo "== 6. pulih paket SEBELUMNYA = keadaan awal"
mysql -h127.0.0.1 -uroot aps_badilag_s1 -e "DELETE FROM abt_data_teks WHERE perkara_id=99001"
( cd "$T/lama" && bash pulih-satker.sh 2>&1 | grep -E "PULIH|PERINGATAN|GAGAL" )
S7=$(snap | tr '\n' ' ')
cek "$S7" "$S0" "pulih paket sebelumnya = keadaan awal PERSIS"
echo "== 7. isian yang diubah orang sesudah peningkatan tidak ditimpa pulih"
( cd "$T/lama" && bash pasang-satker.sh >/dev/null 2>&1 ); ( cd "$T/baru" && bash pasang-satker.sh >/dev/null 2>&1 )
mysql -h127.0.0.1 -uroot aps_badilag_s1 -e "UPDATE abt_variabel SET sql_query=CONCAT(sql_query,' ') WHERE no_var=5801"
( cd "$T/baru" && bash pulih-satker.sh 2>&1 | grep -E "PULIH|PERINGATAN|GAGAL" )
SB=$(mysql -h127.0.0.1 -uroot -N aps_badilag_s1 -e "SELECT RIGHT(sql_query,1)=' ' FROM abt_variabel WHERE no_var=5801")
cek "$SB" "1" "variabel yang sudah disunting orang dibiarkan (tidak ditimpa)"
[ "$ok" = 1 ] && echo "SEMUA UJI PENINGKATAN LULUS" || echo "ADA UJI PENINGKATAN GAGAL"
