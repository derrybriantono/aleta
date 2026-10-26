#!/bin/bash
# Uji siklus paket di ABT LAPTOP (bukan server): siapkan basis, PRASYARAT+pasang, pasang ulang (idempoten), pulih (keadaan awal persis), pasang lagi.
# Pakai (Git Bash): bash sumber/uji_lokal.sh      Hasil di D:/Aplikasi/aleta/tmp/uji-s1 (di luar repo).
SINI="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/d/Satker Asal/Website PA Bungku/xampp/mysql/bin:$PATH"
T=/d/Aplikasi/aleta/tmp/uji-s1
rm -rf "$T"; mkdir -p "$T/blangko/derry_briantono/99 PTSP" "$T/paket"
echo x > "$T/blangko/derry_briantono/99 PTSP/@ 0 - PMH - PHS.rtf"
bash "$SINI/sumber/siapkan_lab.sh" >/dev/null 2>&1
cp -r "$SINI/paket-satker/"* "$T/paket/"
cd "$T/paket" || exit 1
export ABT_LOKAL=1 ABT_DB=aps_badilag_s1 ABT_BLANGKO="$T/blangko" SIPP_DB=sipp_donggala
snap() { mysql -h127.0.0.1 -uroot -N -e "SELECT COUNT(*), MD5(GROUP_CONCAT(CONCAT_WS('|',no_var,nama,data_type,IFNULL(sql_query,''),locked) ORDER BY no_var SEPARATOR '#')) FROM aps_badilag_s1.abt_variabel; SELECT COUNT(*), MAX(id) FROM aps_badilag_s1.abt_menu; SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema='aps_badilag_s1' AND routine_name LIKE 'isian_rtf_daftar%'" | tr '\n\t' '  '; ls "$T/blangko/derry_briantono" | tr '\n' ','; ls "$T/blangko/derry_briantono/99 PTSP" | wc -l; }
AWAL=$(snap); echo "AWAL: $AWAL"
echo "== 1. pasang"; bash pasang-satker.sh 2>&1 | grep -E "PRASYARAT|SEMUA|SELESAI|GAGAL|COCOK|UJI"
echo "== 2. pasang ulang"; bash pasang-satker.sh 2>&1 | grep -E "PRASYARAT|SEMUA|SELESAI|GAGAL|COCOK"
echo "== 3. pulih"; bash pulih-satker.sh 2>&1 | tail -2
AKHIR=$(snap); echo "AKHIR: $AKHIR"
[ "$AWAL" = "$AKHIR" ] && echo "PULIH = KEADAAN AWAL PERSIS" || echo "PULIH BERBEDA DARI AWAL"
echo "== 4. pasang lagi"; bash pasang-satker.sh 2>&1 | grep -E "PRASYARAT|SEMUA|SELESAI|GAGAL"
