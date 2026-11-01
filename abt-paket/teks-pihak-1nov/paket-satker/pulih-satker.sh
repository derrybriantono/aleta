#!/bin/bash
# PULIH paket ABT "abt-teks-pihak-1nov" (1 Nov 2026) - deterministik, TANPA hapus permanen berkas:
#   - berkas yang DITAMBAL dikembalikan dari cadangan HANYA bila isinya masih persis isi paket (yang sudah disunting orang dibiarkan, dilaporkan);
#   - variabel 9255/9256/11313 dikembalikan ke isi LAMA dan variabel baru dihapus HANYA bila masih persis paket;
#   - fungsi baru dihapus dan isian_rtf_penanda dikembalikan ke isi LAMA HANYA bila isinya masih persis paket dan tidak ada variabel paket yang tersisa.
# Baris terakhir harus "PULIH COCOK". Pulihkan paket ini SEBELUM paket sebelumnya.
# Laptop: ABT_LOKAL=1 ABT_DB=<salinan> ABT_BLANGKO=<_blangko_abt uji> MYSQL_BIN=<folder mysql.exe> PY=python bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-teks-pihak-1nov
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
$PY tambal_rtf.py pulih "$B" "$CAD" || echo "PERINGATAN: sebagian berkas tidak dipulihkan (lihat di atas)"
$MY -N < "$N-PULIH.sql" | tr -d '\r' || { echo "GAGAL: PULIH SQL berhenti"; exit 1; }
p=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r')
# kolom: 1 variabel lama LAMA | 2 variabel lama BARU | 3 variabel baru | 4 asing | 5 penanda LAMA | 6 penanda BARU | 7 fungsi baru | 8 fungsi asing | 9 fungsi dipakai
b=$(echo "$p" | cut -d'|' -f2); v=$(echo "$p" | cut -d'|' -f3); f6=$(echo "$p" | cut -d'|' -f6); f7=$(echo "$p" | cut -d'|' -f7)
if [ "$b" = "0" ] && [ "$v" = "0" ] && [ "$f6" = "1" ] && [ "$f7" = "2" ]; then
  $MY < "$N-FUNGSI-PULIH.sql" || { echo "GAGAL: fungsi tidak terhapus"; exit 1; }
fi
p=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r')
if [ "$p" = "$(sed -n 1p harap.txt | tr -d '\r')" ]; then echo "PULIH COCOK ($p)"; else echo "PULIH SEBAGIAN: prasyarat sekarang '$p' (ada yang sudah disunting orang, dibiarkan)"; exit 1; fi
