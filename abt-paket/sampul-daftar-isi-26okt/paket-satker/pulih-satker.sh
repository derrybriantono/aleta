#!/bin/bash
# PULIH paket ABT "abt-sampul-daftar-isi-26okt" (26 Okt 2026) - deterministik: berkas baru dihapus HANYA bila md5-nya masih isi paket, folder baru dihapus HANYA bila kosong, isian
# nomor baru disalin ke cadangan (FK CASCADE) lalu baris variabel dan menu baru dihapus HANYA bila masih isi paket, fungsi dihapus.
# Baris terakhir harus "PULIH COCOK". Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_s1 ABT_BLANGKO=<_blangko_abt uji> MYSQL_BIN=<folder mysql.exe> bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-sampul-daftar-isi-26okt
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
NOMOR="5802,5803,5805,5806,5807,5808,5809,5810,5811,5812,5813,5814,5815,5816,5817,5818,5819,5820,5821,5822,5823,5824,5825,5826,5827,5801,5800,5829,5836,5837,5839,5840,5841,5845,5846,5842,5843,5851,5852,5853,5854,5856,5857,5858,5859,5700,5701,5702,5703,5704,5705,5706,5707,5708,5709,5710,5711,5712,5713,5714,5715,5716,5717,5718,5719,5720,5721,5722,5723,5724,5725,5726,5727,5728,5729,5730,5731,5732,5733,5734,5735,5736,5737,5738,5739,5740,5741,5742,5743,5744,5745,5746,5747,5748,5749,5750,5751,5752,5753,5754,5755,5756,5757,5758,5759,5760,5761,5762,5763,5764,5765,5766,5767,5768,5769,5770,5771,5772,5773,5774,5775,5776,5777,5778,5779"
for T in abt_data_teks abt_data_tanggal; do
  "${BIN}mysqldump" -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
    --complete-insert --skip-comments --hex-blob --where="no_var IN ($NOMOR)" "$ADB" "$T" > "$CAD/$T-sebelum-pulih.$(date +%Y%m%d%H%M%S).sql" \
    || { echo "GAGAL: isian nomor baru tidak bisa dicadangkan - tidak ada yang dipulihkan"; exit 1; }
done
$PY berkas_rtf.py pulih "$B" "$CAD" || echo "PERINGATAN: sebagian berkas tidak dipulihkan (lihat di atas)"
while IFS= read -r f; do
  [ -d "$B/$f" ] || continue
  rmdir "$B/$f" 2>/dev/null && echo "FOLDER DIHAPUS $f" || echo "PERINGATAN: folder $f tidak kosong, dibiarkan"
done < <(grep -v '^#' folder-baru.txt)
$MY -N < "$N-PULIH.sql" || { echo "GAGAL: PULIH SQL berhenti"; exit 1; }
sisa=$($MY -N -e "SELECT (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN ($NOMOR)) + (SELECT COUNT(*) FROM abt_menu WHERE direktori='98b Berkas Perkara - BAS' AND parent_direktori='derry_briantono') + (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='isian_rtf_daftar_isi')")
if [ "$sisa" = 0 ]; then echo "PULIH COCOK"; else echo "PULIH SEBAGIAN: $sisa baris/fungsi baru masih ada (sudah disunting orang, dibiarkan)"; exit 1; fi
