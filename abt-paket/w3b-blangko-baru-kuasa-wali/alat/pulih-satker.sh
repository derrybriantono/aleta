#!/bin/bash
# PULIH paket ABT "@@NAMA@@" (21 Okt 2026, agen W3b) - deterministik: berkas baru dihapus HANYA bila md5-nya masih isi paket, berkas yang
# diganti dikembalikan dari cadangan HANYA bila isinya masih isi paket (yang sudah disunting dibiarkan dan dilaporkan), folder baru
# dihapus HANYA bila kosong, isian nomor baru disalin ke cadangan (FK CASCADE) lalu baris baru dihapus HANYA bila masih isi paket.
# Baris terakhir harus "PULIH COCOK". Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_w3b ABT_BLANGKO=<_blangko_abt uji> bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=@@NAMA@@
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
ADB="${ABT_DB:-aps_badilag}"
PY="${PY:-python}"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
mkdir -p "$CAD"
for T in abt_data_teks abt_data_tanggal; do
  mysqldump -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
    --complete-insert --skip-comments --hex-blob --where="no_var IN (@@NO_VAR@@)" "$ADB" "$T" > "$CAD/$T-isian-sebelum-pulih.$(date +%Y%m%d%H%M%S).sql" \
    || { echo "GAGAL: isian nomor baru tidak bisa dicadangkan - tidak ada yang dipulihkan"; exit 1; }
done
$PY berkas_rtf.py pulih "$B" "$CAD" || echo "PERINGATAN: sebagian berkas tidak dipulihkan (lihat di atas)"
while IFS= read -r f; do
  [ -d "$B/$f" ] || continue
  rmdir "$B/$f" 2>/dev/null && echo "FOLDER DIHAPUS $f" || echo "PERINGATAN: folder $f tidak kosong, dibiarkan"
done < <(grep -v '^#' folder-baru.txt)
$MY -N < "$N-PULIH.sql" || { echo "GAGAL: PULIH SQL berhenti"; exit 1; }
