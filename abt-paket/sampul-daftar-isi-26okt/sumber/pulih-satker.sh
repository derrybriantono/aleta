#!/bin/bash
# PULIH paket ABT "@@N@@" (26 Okt 2026) - deterministik: berkas baru dihapus HANYA bila md5-nya masih isi paket, folder baru dihapus HANYA bila kosong, isian
# nomor baru disalin ke cadangan (FK CASCADE) lalu baris variabel dan menu baru dihapus HANYA bila masih isi paket, fungsi dihapus.
# Baris terakhir harus "PULIH COCOK". Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_s1 ABT_BLANGKO=<_blangko_abt uji> MYSQL_BIN=<folder mysql.exe> bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=@@N@@
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
ADB="${ABT_DB:-aps_badilag}"
PY="${PY:-python}"
BIN="${MYSQL_BIN:-}"; [ -n "$BIN" ] && BIN="$BIN/"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="${BIN}mysql -h $H -u root --default-character-set=latin1 $ADB"
mkdir -p "$CAD"
MODE=baru; [ -f "$CAD/mode.txt" ] && MODE=$(cat "$CAD/mode.txt")
echo "PULIH mode: $MODE (baru = hapus semua yang dipasang paket ini; peningkatan = kembali ke isi paket sebelumnya)"
NOMOR="@@NOMOR@@"
for T in abt_data_teks abt_data_tanggal; do
  "${BIN}mysqldump" -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
    --complete-insert --skip-comments --hex-blob --where="no_var IN ($NOMOR)" "$ADB" "$T" > "$CAD/$T-sebelum-pulih.$(date +%Y%m%d%H%M%S).sql" \
    || { echo "GAGAL: isian nomor baru tidak bisa dicadangkan - tidak ada yang dipulihkan"; exit 1; }
done
$PY berkas_rtf.py pulih "$B" "$CAD" || echo "PERINGATAN: sebagian berkas tidak dipulihkan (lihat di atas)"
if [ "$MODE" = peningkatan ]; then
  # paket sebelumnya sudah punya folder dan menu dan fungsi: tidak ada yang dihapus; variabel dikembalikan di tempat (isian tetap)
  $MY -N < "$N-PULIH-PENINGKATAN.sql" || { echo "GAGAL: PULIH PENINGKATAN SQL berhenti"; exit 1; }
  lama=$($MY -N < "$N-PERIKSA-LAMA.sql")
  if [ "$lama" = "@@UBAH@@" ]; then echo "PULIH COCOK"; exit 0; else echo "PULIH SEBAGIAN: hanya $lama dari @@UBAH@@ variabel kembali ke isi paket sebelumnya (sisanya sudah disunting orang, dibiarkan)"; exit 1; fi
fi
while IFS= read -r f; do
  [ -d "$B/$f" ] || continue
  rmdir "$B/$f" 2>/dev/null && echo "FOLDER DIHAPUS $f" || echo "PERINGATAN: folder $f tidak kosong, dibiarkan"
done < <(grep -v '^#' folder-baru.txt)
$MY -N < "$N-PULIH.sql" || { echo "GAGAL: PULIH SQL berhenti"; exit 1; }
sisa=$($MY -N -e "SELECT (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN ($NOMOR)) + (SELECT COUNT(*) FROM abt_menu WHERE direktori='98b Berkas Perkara - BAS' AND parent_direktori='derry_briantono') + (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='@@FUNGSI@@')")
if [ "$sisa" = 0 ]; then echo "PULIH COCOK"; else echo "PULIH SEBAGIAN: $sisa baris/fungsi baru masih ada (sudah disunting orang, dibiarkan)"; exit 1; fi
