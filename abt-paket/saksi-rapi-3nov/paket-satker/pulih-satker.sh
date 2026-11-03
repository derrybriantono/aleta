#!/bin/bash
# PULIH paket ABT "abt-saksi-rapi-3nov" (3 Nov 2026) - tanpa hapus permanen:
#   - berkas RTF yang ditambal paket ini dikembalikan dari cadangan HANYA bila isinya masih persis isi paket (yang disunting orang dibiarkan, dilaporkan);
#   - isian_rtf_ket_saksi kembali ke versi titik-koma-30okt, isian_rtf_tahu_lengkap dan isian_rtf_objek_tanya dihapus.
# Baris terakhir harus "PULIH COCOK (1|0|0)".
# Laptop: ABT_LOKAL=1 ABT_DB=<basis ABT uji> ABT_BLANGKO=<_blangko_abt uji> MYSQL_BIN=<folder mysql.exe> PY=python bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-saksi-rapi-3nov
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
sqlf() { if [ "$ADB" = aps_badilag ]; then cat "$1"; else sed "s/aps_badilag\\./$ADB./g" "$1"; fi; }
mkdir -p "$CAD"
$PY tambal_rtf.py pulih "$B" "$CAD" || echo "PERINGATAN: sebagian berkas tidak dipulihkan (lihat di atas)"
sqlf "$N-FUNGSI-LAMA.sql" | $MY || { echo "GAGAL: fungsi lama tidak terpasang"; exit 1; }
p=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r')
if [ "$p" = "$(sed -n 1p harap.txt | tr -d '\r')" ]; then echo "PULIH COCOK ($p)"; else echo "PULIH SEBAGIAN: prasyarat sekarang '$p'"; exit 1; fi
