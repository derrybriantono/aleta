#!/bin/bash
# PULIH paket ABT "abt-sela-ps-30okt" (30 Okt 2026) - deterministik, TANPA hapus permanen berkas:
#   - berkas BARU paket dipindah ke cadangan/pulih-arsip/ HANYA bila md5-nya masih isi paket (yang disunting orang dibiarkan dan dilaporkan);
#   - dua berkas yang DITIMPA dikembalikan dari cadangan/timpa-asal (isi paket disalin juga ke pulih-arsip);
#   - folder baru dilepas HANYA bila sudah kosong (isinya sudah di arsip);
#   - isian perkara nomor paket (abt_data_teks) dicadangkan ke cadangan/abt_data_teks-pulih-<waktu>.sql, lalu variabel dan menu baru
#     dihapus HANYA bila isinya masih persis paket. Baris terakhir harus "PULIH COCOK".
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_sela30 ABT_BLANGKO=<_blangko_abt uji> MYSQL_BIN=<folder mysql.exe> PY=python bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-sela-ps-30okt
NOMOR="$(grep -v '^#' nomor-variabel.txt | paste -sd, -)"
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
$PY berkas_rtf.py pulih "$B" "$CAD" || echo "PERINGATAN: sebagian berkas tidak dipulihkan (lihat di atas)"
while IFS= read -r f; do
  [ -d "$B/$f" ] || continue
  rmdir "$B/$f" 2>/dev/null && echo "FOLDER DILEPAS (kosong, isinya di $CAD/pulih-arsip) $f" || echo "PERINGATAN: folder $f tidak kosong, dibiarkan"
done < <(grep -v '^#' folder-baru.txt)
W="$(date +%Y%m%d%H%M%S)"
"${BIN}mysqldump" -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
  --complete-insert --skip-comments --hex-blob --where="no_var IN ($NOMOR)" "$ADB" abt_data_teks > "$CAD/abt_data_teks-pulih-$W.sql" \
  || { echo "GAGAL: cadangan isian abt_data_teks tidak terbuat - variabel tidak dihapus"; exit 1; }
echo "CADANGAN ISIAN: $CAD/abt_data_teks-pulih-$W.sql ($(grep -c '^REPLACE' "$CAD/abt_data_teks-pulih-$W.sql") baris)"
$MY -N < "$N-PULIH.sql" | tr -d '\r' || { echo "GAGAL: PULIH SQL berhenti"; exit 1; }
sisa=$($MY -N -e "SELECT (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN ($NOMOR)) + (SELECT COUNT(*) FROM abt_menu WHERE id IN (151, 152) AND parent_direktori = 'derry_briantono' AND direktori IN ('97a Putusan Sela', '97a Putusan Sela - BAS'))" | tr -d '\r')
if [ "$sisa" = 0 ]; then echo "PULIH COCOK"; else echo "PULIH SEBAGIAN: $sisa baris variabel/menu paket masih ada (sudah disunting orang, dibiarkan)"; exit 1; fi
