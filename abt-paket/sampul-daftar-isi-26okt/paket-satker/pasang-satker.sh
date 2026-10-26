#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-sampul-daftar-isi-26okt" (26 Okt 2026). Dijalankan DI SERVER sebagai root, dari folder paket. HANYA pengguna derry_briantono.
# Isi: 168 variabel baru (5700-5779 dan 5800-5899), fungsi isian_rtf_daftar_isi, satu baris abt_menu (folder "98b Berkas Perkara - BAS" untuk Panitera Sidang),
# enam blangko RTF (sampul: folder 99 PTSP; daftar isi: folder baru), masing-masing A4 (bawaan), F4, dan Legal. Tidak ada berkas, variabel, atau menu lama yang diubah.
# Urutan: md5 -> PRASYARAT (baca saja) + BERKAS (baca saja) -> CADANGAN -> FUNGSI -> PASANG SQL (satu transaksi) -> PERIKSA -> UJI kueri baru atas perkara nyata
#         (baca saja) -> FOLDER BARU + BERKAS RTF -> PERIKSA BERKAS. Gagal sesudah PASANG = PULIH otomatis (berkas, folder, baris, dan fungsi baru dikembalikan).
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_s1 ABT_BLANGKO=<_blangko_abt uji> SIPP_DB=sipp_donggala MYSQL_BIN=<folder mysql.exe> bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-sampul-daftar-isi-26okt
HARAP='0|0|31|0|1|0|0'
ULANG='0|168|31|1|1|1|0'
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
SDB="${SIPP_DB:-SIPP}"
ADB="${ABT_DB:-aps_badilag}"
PY="${PY:-python}"
BIN="${MYSQL_BIN:-}"; [ -n "$BIN" ] && BIN="$BIN/"
gagal() { echo "GAGAL: $*"; exit 1; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
while IFS= read -r f; do
  [ -d "$B/$f" ] || gagal "folder blangko $B/$f tidak ada - TIDAK ada yang diubah"
done < <(grep -v '^#' folder-ada.txt)
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="${BIN}mysql -h $H -u root --default-character-set=latin1 $ADB"
# berkas SQL memuat nama basis aps_badilag dan penanda __SIPP__; di basis uji laptop diganti nama basis ujinya
sqlf() { sed "s/__SIPP__/$SDB/g; s/aps_badilag\./$ADB./g" "$1"; }

# --- 1. PRASYARAT (baca saja) -------------------------------------------------------------------------------------------
p=$($MY -N < "$N-PRASYARAT.sql") || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
if [ "$p" != "$HARAP" ] && [ "$p" != "$ULANG" ]; then
  gagal "prasyarat '$p' (harus '$HARAP', atau '$ULANG' bila pasang ulang) - TIDAK ada yang diubah. Arti angka: lihat $N-PRASYARAT.sql"
fi
echo "PRASYARAT COCOK ($p)"
if [ "$p" = "$HARAP" ]; then
  while IFS= read -r f; do
    [ -e "$B/$f" ] && gagal "folder baru $B/$f sudah ada padahal paket belum terpasang - TIDAK ada yang diubah"
  done < <(grep -v '^#' folder-baru.txt)
fi
c=$($PY berkas_rtf.py cek "$B"); echo "$c"
[ "$(echo "$c" | tail -1)" = "BERKAS SIAP" ] || gagal "berkas tujuan tidak sesuai - TIDAK ada yang diubah"

# --- 2. CADANGAN (sesudah prasyarat; tidak pernah menimpa cadangan lama) ------------------------------------------------
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
NOMOR="5802,5803,5805,5806,5807,5808,5809,5810,5811,5812,5813,5814,5815,5816,5817,5818,5819,5820,5821,5822,5823,5824,5825,5826,5827,5801,5800,5829,5836,5837,5839,5840,5841,5845,5846,5842,5843,5851,5852,5853,5854,5856,5857,5858,5859,5700,5701,5702,5703,5704,5705,5706,5707,5708,5709,5710,5711,5712,5713,5714,5715,5716,5717,5718,5719,5720,5721,5722,5723,5724,5725,5726,5727,5728,5729,5730,5731,5732,5733,5734,5735,5736,5737,5738,5739,5740,5741,5742,5743,5744,5745,5746,5747,5748,5749,5750,5751,5752,5753,5754,5755,5756,5757,5758,5759,5760,5761,5762,5763,5764,5765,5766,5767,5768,5769,5770,5771,5772,5773,5774,5775,5776,5777,5778,5779,5861,5862,5863,5864,5865,5866,5867,5868,5869,5890,5891,5892,5893,5894,5895,5896,5897,5898,5899,5830,5831,5832,5833,5870,5871,5872,5873,5874,5875,5876,5877,5878,5879,5880,5881,5882,5883,5884,5885,5886,5887,5888,5889"
for T in abt_variabel abt_data_teks abt_data_tanggal abt_menu; do
  [ -f "$CAD/$T-sebelum.sql" ] && mv "$CAD/$T-sebelum.sql" "$CAD/$T-sebelum.$(date +%Y%m%d%H%M%S).sql"
  if [ "$T" = abt_menu ]; then W="direktori='98b Berkas Perkara - BAS' AND parent_direktori='derry_briantono'"; else W="no_var IN ($NOMOR)"; fi
  "${BIN}mysqldump" -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
    --complete-insert --skip-comments --hex-blob --where="$W" "$ADB" "$T" > "$CAD/$T-sebelum.sql" \
    || gagal "mysqldump $T gagal - TIDAK ada yang diubah"
done
echo "CADANGAN: $CAD (variabel lama bernomor baru: $(grep -c '^REPLACE' "$CAD/abt_variabel-sebelum.sql"); menu: $(grep -c '^REPLACE' "$CAD/abt_menu-sebelum.sql"))"

# --- 3. FUNGSI, PASANG SQL, PERIKSA ------------------------------------------------------------------------------------
sqlf "$N-FUNGSI.sql" | $MY || { $MY -N < "$N-PULIH.sql"; gagal "fungsi tidak terpasang - dipulihkan"; }
$MY < "$N-PASANG.sql" || { $MY -N < "$N-PULIH.sql"; gagal "$N-PASANG.sql gagal (transaksi tidak di-COMMIT) - dipulihkan"; }
$MY -N < "$N-PERIKSA.sql" > "$CAD/periksa-sesudah.txt"
tail -1 "$CAD/periksa-sesudah.txt" | cut -f1
if [ "$(tail -1 "$CAD/periksa-sesudah.txt" | cut -f1)" != "SEMUA COCOK" ]; then
  head -20 "$CAD/periksa-sesudah.txt"
  $MY -N < "$N-PULIH.sql"
  gagal "PERIKSA tidak cocok - baris dan fungsi baru dihapus; berkas belum disentuh"
fi

# --- 4. UJI kueri baru atas perkara nyata (baca saja) ------------------------------------------------------------------
SQ="${BIN}mysql -h $H -u root --default-character-set=latin1 $SDB -N"
NU=$(awk -F'\t' '!/^#/ && NF==2' uji-kueri.tsv | wc -l | tr -d ' ')
for PID in $($SQ -e "SELECT perkara_id FROM perkara WHERE jenis_perkara_id IN (347,346,362,360,358,354,363,371) ORDER BY perkara_id DESC LIMIT 14" 2>/dev/null | grep -v NULL | sort -u); do
  if ! sed "s/#perkara_id#/$PID/g; s/aps_badilag\./$ADB./g" uji-kueri.tsv | awk -F'\t' '!/^#/ && NF==2 {print "SELECT " $1 " AS var, LEFT(REPLACE(IFNULL((SELECT x.data FROM (" $2 ") x LIMIT 1), \"(kosong)\"), CHAR(10), \" \"), 90) AS nilai;"}' \
       | $SQ > "$CAD/uji-$PID.txt" 2>&1; then
    echo "uji perkara $PID: GALAT $(head -c 300 "$CAD/uji-$PID.txt")"
    $MY -N < "$N-PULIH.sql"
    gagal "kueri variabel baru tidak jalan di server ini - baris dan fungsi baru dihapus; berkas belum disentuh. Kirim $CAD/uji-$PID.txt ke pengembang"
  fi
  [ "$(grep -c . "$CAD/uji-$PID.txt")" = "$NU" ] || { $MY -N < "$N-PULIH.sql"; gagal "uji perkara $PID tidak menjawab $NU baris - dipulihkan"; }
done
echo "UJI kueri: $NU variabel x perkara contoh: JALAN"

# --- 5. FOLDER BARU + BERKAS RTF ---------------------------------------------------------------------------------------
: > "$CAD/folder-dibuat.txt"
while IFS= read -r f; do
  [ -d "$B/$f" ] && { echo "FOLDER SUDAH ADA $f"; continue; }
  if mkdir "$B/$f"; then
    echo "$f" >> "$CAD/folder-dibuat.txt"; echo "FOLDER BARU $f"
    st=$(stat -c '%u:%g' "$(dirname "$B/$f")" 2>/dev/null) && chown "$st" "$B/$f" 2>/dev/null; chmod "$(stat -c %a "$(dirname "$B/$f")" 2>/dev/null || echo 755)" "$B/$f" 2>/dev/null
  else
    $MY -N < "$N-PULIH.sql"; gagal "folder $f tidak bisa dibuat - baris dan fungsi baru dihapus"
  fi
done < <(grep -v '^#' folder-baru.txt)
hapus_folder_baru() { while IFS= read -r f; do rmdir "$B/$f" 2>/dev/null; done < "$CAD/folder-dibuat.txt"; }
$PY berkas_rtf.py pasang "$B" "$SINI" "$CAD" | tee "$CAD/berkas-pasang.txt"
if [ "${PIPESTATUS[0]}" != "0" ]; then
  $PY berkas_rtf.py pulih "$B" "$CAD"; hapus_folder_baru
  $MY -N < "$N-PULIH.sql"
  gagal "berkas RTF tidak terpasang - berkas, folder, baris, dan fungsi baru dikembalikan (lihat $CAD/berkas-pasang.txt)"
fi
$PY berkas_rtf.py periksa "$B" "$CAD" | tee "$CAD/berkas-periksa.txt"
if [ "$(tail -1 "$CAD/berkas-periksa.txt")" != "BERKAS COCOK" ]; then
  $PY berkas_rtf.py pulih "$B" "$CAD"; hapus_folder_baru
  $MY -N < "$N-PULIH.sql"
  gagal "periksa berkas tidak cocok - berkas, folder, baris, dan fungsi baru dikembalikan"
fi
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
