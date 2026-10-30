#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-sampul-rapi-30okt" (30 Okt 2026). Dijalankan DI SERVER sebagai root, dari folder paket. HANYA blangko derry_briantono.
# Isi: 20 variabel BARU (nomor-baru.txt, blok 11600-11619), 106 variabel lama paket sampul diubah (nomor-ubah.txt; HANYA bila isinya persis dasar),
#      5 fungsi baru (isian_rtf_*), dan 21 blangko RTF berkas perkara (99 PTSP: sampul + ceklist, 98b Berkas Perkara - BAS: daftar isi)
#      ditimpa (daftar-timpa.tsv: HANYA bila md5 server persis md5 lama).
# URUTAN: paket ini tidak bersinggungan dengan prodeo-panggilan-29okt, bas-tanya-jawab-29okt, ket-saksi-kata-30okt, relaas-penetapan-30okt
#         (berkas, nomor variabel, dan fungsi berbeda), jadi boleh dipasang sesudah keempatnya (urutan disarankan di PASANG.md).
# Urutan kerja: md5 paket -> PRASYARAT (baca saja) + CEK BERKAS (baca saja) -> CADANGAN -> FUNGSI -> PASANG SQL (satu transaksi) -> PERIKSA
#               -> UJI kueri atas perkara nyata (baca saja) -> BERKAS RTF -> PERIKSA BERKAS. Gagal sesudah FUNGSI = PULIH otomatis.
# Laptop: ABT_LOKAL=1 ABT_DB=<basis uji> SIPP_DB=<salinan SIPP> ABT_BLANGKO=<_blangko_abt uji> MYSQL_BIN=<folder mysql.exe> PY=python bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-sampul-rapi-30okt
. ./harap.txt
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
SDB="${SIPP_DB:-SIPP}"
ADB="${ABT_DB:-aps_badilag}"
PY="${PY:-python}"
BIN="${MYSQL_BIN:-}"; [ -n "$BIN" ] && BIN="$BIN/"
NOMOR="$(grep -hv '^#' nomor-baru.txt nomor-ubah.txt | tr '\n' ',' | sed 's/,$//')"
gagal() { echo "GAGAL: $*"; exit 1; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="${BIN}mysql -h $H -u root --default-character-set=latin1 $ADB"
SQ="${BIN}mysql -h $H -u root --default-character-set=latin1 $SDB -N"
# nama basis: aps_badilag. -> basis ABT, SIPP. -> basis SIPP (fungsi membaca SIPP); 'aps_badilag' (skema di information_schema) -> basis ABT
sqlf() { sed -e "s/aps_badilag\./$ADB./g" -e "s/\bSIPP\./$SDB./g" -e "s/ROUTINE_SCHEMA = 'aps_badilag'/ROUTINE_SCHEMA = '$ADB'/g" "$1"; }
pulih_db() { sqlf "$N-PULIH.sql" | $MY -N; sqlf "$N-FUNGSI-PULIH.sql" | $MY; }

# --- 1. PRASYARAT + CEK BERKAS (baca saja) -------------------------------------------------------------------------------
p=$(sqlf "$N-PRASYARAT.sql" | $MY -N) || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
if [ "$p" != "$HARAP" ] && [ "$p" != "$ULANG" ]; then
  gagal "prasyarat '$p' (harus '$HARAP' pasang pertama atau '$ULANG' pasang ulang) - TIDAK ada yang diubah. Arti angka: lihat $N-PRASYARAT.sql"
fi
echo "PRASYARAT COCOK ($p)"
rm -rf "$SINI/timpa" && tar xzf timpa.tgz -C "$SINI" || gagal "timpa.tgz tidak terbuka - TIDAK ada yang diubah"
c=$($PY berkas_rtf.py cek "$B"); echo "$c" | grep -v '^GAGAL:' ; echo "$c" | grep '^GAGAL:' | head -25
if [ "$(echo "$c" | tail -1)" != "BERKAS SIAP" ]; then
  echo "$c" | grep -c '^GAGAL:' | sed 's/^/jumlah blangko yang md5-nya sudah berubah: /'
  gagal "blangko di server tidak persis keadaan dasar paket - TIDAK ada yang diubah. Bangun ulang paket dari salinan blangko server terbaru (lihat PASANG.md)"
fi

# --- 2. CADANGAN (tidak pernah menimpa cadangan lama) -----------------------------------------------------------------------
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
T=abt_variabel
[ -f "$CAD/$T-sebelum.sql" ] && mv "$CAD/$T-sebelum.sql" "$CAD/$T-sebelum.$(date +%Y%m%d%H%M%S).sql"
"${BIN}mysqldump" -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
  --complete-insert --skip-comments --hex-blob --where="no_var IN ($NOMOR)" "$ADB" "$T" > "$CAD/$T-sebelum.sql" \
  || gagal "mysqldump $T gagal - TIDAK ada yang diubah"
echo "CADANGAN: $CAD (baris variabel paket sebelum pasang: $(grep -c '^REPLACE' "$CAD/$T-sebelum.sql"))"

# --- 3. FUNGSI, PASANG SQL, PERIKSA -------------------------------------------------------------------------------------------
sqlf "$N-FUNGSI.sql" | $MY || { pulih_db; gagal "fungsi tidak terpasang - dipulihkan"; }
sqlf "$N-PASANG.sql" | $MY || { pulih_db; gagal "$N-PASANG.sql gagal (transaksi tidak di-COMMIT) - dipulihkan"; }
sqlf "$N-PERIKSA.sql" | $MY -N > "$CAD/periksa-sesudah.txt"
if [ "$(tail -1 "$CAD/periksa-sesudah.txt" | cut -f1)" != "SEMUA COCOK" ]; then
  grep -v "	1$" "$CAD/periksa-sesudah.txt" | head -20
  pulih_db
  gagal "PERIKSA tidak cocok - variabel dan fungsi dikembalikan; berkas belum disentuh"
fi
echo "SEMUA COCOK"

# --- 4. UJI kueri atas perkara nyata (baca saja; fungsi membaca SIPP) -----------------------------------------------------------
NU=$(grep -vc '^#' uji-kueri.tsv)
for PID in $($SQ -e "SELECT perkara_id FROM perkara ORDER BY perkara_id DESC LIMIT 3; SELECT perkara_id FROM perkara_pihak1 GROUP BY perkara_id HAVING COUNT(*) > 8 ORDER BY perkara_id DESC LIMIT 1; SELECT perkara_id FROM perkara_jadwal_sidang GROUP BY perkara_id HAVING COUNT(*) > 15 ORDER BY perkara_id DESC LIMIT 1; SELECT perkara_id FROM perkara_anak_pihak GROUP BY perkara_id HAVING COUNT(*) > 3 ORDER BY perkara_id DESC LIMIT 1" 2>/dev/null | sort -u); do
  if ! grep -v '^#' uji-kueri.tsv | sed "s/#perkara_id#/$PID/g; s/aps_badilag\./$ADB./g; s/#[0-9][0-9]*#/0/g" \
       | awk -F'\t' '{print "SELECT " $1 " AS var, LENGTH(IFNULL((SELECT x.data FROM (" $2 ") x LIMIT 1), \"\")) AS panjang;"}' \
       | $SQ > "$CAD/uji-$PID.txt" 2>&1; then
    echo "uji perkara $PID: GALAT $(head -c 300 "$CAD/uji-$PID.txt")"
    pulih_db
    gagal "kueri variabel tidak jalan di server ini - variabel dan fungsi dikembalikan; berkas belum disentuh. Kirim $CAD/uji-$PID.txt ke pengembang"
  fi
  [ "$(grep -c . "$CAD/uji-$PID.txt")" = "$NU" ] || { pulih_db; gagal "uji perkara $PID tidak menjawab $NU baris - dipulihkan"; }
  echo "uji kueri perkara $PID: $NU variabel jalan, 0 galat"
done

# --- 5. BERKAS RTF -----------------------------------------------------------------------------------------------------------
$PY berkas_rtf.py pasang "$B" "$SINI" "$CAD" | tee "$CAD/berkas-pasang.txt"
if [ "${PIPESTATUS[0]}" != "0" ]; then
  $PY berkas_rtf.py pulih "$B" "$CAD"; pulih_db
  gagal "berkas RTF tidak terpasang - berkas, variabel, dan fungsi dikembalikan (lihat $CAD/berkas-pasang.txt)"
fi
$PY berkas_rtf.py periksa "$B" "$CAD" | tee "$CAD/berkas-periksa.txt"
if [ "$(tail -1 "$CAD/berkas-periksa.txt")" != "BERKAS COCOK" ]; then
  $PY berkas_rtf.py pulih "$B" "$CAD"; pulih_db
  gagal "periksa berkas tidak cocok - berkas, variabel, dan fungsi dikembalikan"
fi
rm -rf "$SINI/timpa"
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
