#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-pihak-urut-sisa-28okt" (28 Okt 2026). Dijalankan DI SERVER sebagai root, dari folder paket.
# Isi: variabel Derry yang memilih pihak dengan `urutan = N` tetap (daftar di nomor-ubah.txt) memakai PERINGKAT ke-N lewat satu fungsi baru
#      isian_rtf_pihak_peringkat (perkara e-Court menomori urutan bersambung lintas tabel). Tidak ada blangko yang disentuh.
# Prasyarat: paket abt-pihak-urut-ecourt-27okt sudah terpasang (diperiksa PRASYARAT).
# Urutan: md5 paket -> PRASYARAT (baca saja) -> CADANGAN baris variabel -> FUNGSI -> PASANG SQL (satu transaksi) -> PERIKSA -> UJI atas data nyata (baca saja).
#         Gagal di tengah = PULIH otomatis.
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_ps1 SIPP_DB=sipp_donggala bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-pihak-urut-sisa-28okt
HARAP=$(sed -n 1p harap.txt)
ULANG=$(sed -n 2p harap.txt)
NU=$(tr ',' '\n' < nomor-ubah.txt | grep -c .)
CAD="$SINI/cadangan"
SDB="${SIPP_DB:-SIPP}"
ADB="${ABT_DB:-aps_badilag}"
gagal() { echo "GAGAL: $*"; exit 1; }
pulih() { echo "... memulihkan"; ABT_DB="$ADB" SIPP_DB="$SDB" bash "$SINI/pulih-satker.sh" 2>&1 | tail -6; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp, bukan editor"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
myn() { $MY -N "$@" | tr -d '\r'; }
NOMOR_UBAH=$(cat nomor-ubah.txt)
sqlf() { if [ "$SDB" = SIPP ]; then cat "$1"; else sed "s/SIPP\\./$SDB./g" "$1"; fi; }
# definisi fungsi di basis uji laptop memuat nama basis SIPP uji; md5 server dihitung atas nama "SIPP" - samakan dulu
sqlm() { if [ "$SDB" = SIPP ]; then cat "$1"; else sed "s/MD5(routine_definition)/MD5(REPLACE(routine_definition, '$SDB.', 'SIPP.'))/g" "$1"; fi; }
set -o pipefail

# --- 1. PRASYARAT (baca saja) -------------------------------------------------------------------------------------------
p=$(sqlm "$N-PRASYARAT.sql" | $MY -N | tr -d '\r') || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
if [ "$p" != "$HARAP" ] && [ "$p" != "$ULANG" ]; then
  gagal "prasyarat '$p' (harus '$HARAP', atau '$ULANG' bila pasang ulang) - TIDAK ada yang diubah. Arti angka: lihat $N-PRASYARAT.sql"
fi
echo "PRASYARAT COCOK ($p)"
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"

# --- 2. CADANGAN (hanya saat pertama; pasang ulang TIDAK menimpa cadangan isi lama) ----------------------------------------
if [ "$p" = "$HARAP" ]; then
  [ -f "$CAD/abt_variabel-sebelum.sql" ] && mv "$CAD/abt_variabel-sebelum.sql" "$CAD/abt_variabel-sebelum.$(date +%Y%m%d%H%M%S).sql"
  mysqldump -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
    --complete-insert --skip-comments --hex-blob --where="no_var IN ($NOMOR_UBAH)" "$ADB" abt_variabel > "$CAD/abt_variabel-sebelum.sql" \
    || gagal "mysqldump abt_variabel gagal - TIDAK ada yang diubah"
  nlama=$(grep -c '^REPLACE' "$CAD/abt_variabel-sebelum.sql")
  [ "$nlama" = "$NU" ] || gagal "cadangan memuat $nlama baris (harus $NU) - TIDAK ada yang diubah"
  echo "CADANGAN: $CAD/abt_variabel-sebelum.sql ($nlama baris lama)"
  # --- 3. FUNGSI (satu fungsi baru) -------------------------------------------------------------------------------------
  sqlf "$N-FUNGSI.sql" | $MY > "$CAD/fungsi-pasang.log" 2>&1 || { tail -5 "$CAD/fungsi-pasang.log"; pulih; gagal "fungsi tidak bisa dibuat - dipulihkan"; }
  echo "FUNGSI: $(myn -e "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_comment LIKE 'PS:%'") dibuat (1 = isian_rtf_pihak_peringkat)"
  # --- 4. PASANG SQL ----------------------------------------------------------------------------------------------------
  $MY < "$N-PASANG.sql" || { pulih; gagal "$N-PASANG.sql gagal (transaksi tidak di-COMMIT) - dipulihkan"; }
else
  [ -f "$CAD/abt_variabel-sebelum.sql" ] || echo "PERINGATAN: paket sudah terpasang tetapi $CAD/abt_variabel-sebelum.sql tidak ada - PULIH tidak dapat mengembalikan isi lama (ambil dari cadangan DB harian)"
  echo "PASANG ULANG: cadangan isi lama dibiarkan"
fi

# --- 5. PERIKSA ----------------------------------------------------------------------------------------------------------------
sqlm "$N-PERIKSA.sql" | $MY -N 2>&1 | tr -d '\r' > "$CAD/periksa-sesudah.txt"
tail -1 "$CAD/periksa-sesudah.txt"
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  grep -v '	1$' "$CAD/periksa-sesudah.txt" | head -20
  [ "$p" = "$HARAP" ] && pulih
  gagal "PERIKSA tidak cocok$([ "$p" = "$HARAP" ] && echo ' - dipulihkan')"
fi

# --- 6. UJI atas data nyata (baca saja) -----------------------------------------------------------------------------------------
SQ="mysql -h $H -u root --default-character-set=latin1 $SDB -N"
batal() { [ "$p" = "$HARAP" ] && pulih; gagal "$1$([ "$p" = "$HARAP" ] && echo ' - dipulihkan')"; }
# (a) perkara berurutan rapat (mulai 1, tanpa lubang, tanpa kembar): peringkat HARUS sama dengan urutan; perkara tak rapat: peringkat 1..jumlah tanpa kembar
for T in 1 2; do
  UJI="SELECT COUNT(*), SUM($ADB.isian_rtf_pihak_peringkat($T, a.id) <> a.urutan) FROM SIPP_TBL a JOIN (SELECT perkara_id FROM SIPP_TBL GROUP BY perkara_id HAVING MIN(urutan) = 1 AND MAX(urutan) = COUNT(*) AND COUNT(DISTINCT urutan) = COUNT(*)) r ON r.perkara_id = a.perkara_id"
  UJI="${UJI//SIPP_TBL/perkara_pihak$T}"
  u1=$($SQ -e "$UJI" 2>"$CAD/uji-rapat$T.err" | tr -d '\r') || { head -3 "$CAD/uji-rapat$T.err"; batal "fungsi peringkat gagal dijalankan atas perkara_pihak$T"; }
  echo "UJI rapat perkara_pihak$T (baris | peringkat beda dari urutan): $(echo "$u1" | tr '\t' ' ')"
  [ "$(echo "$u1" | cut -f2)" = 0 ] || batal "peringkat tidak sama dengan urutan pada perkara berurutan rapat (perkara_pihak$T)"
  UJI2="SELECT COUNT(*), IFNULL(SUM(k.p IS NULL OR k.p < 1 OR k.p > k.n), 0), COUNT(*) - COUNT(DISTINCT CONCAT(k.perkara_id, '-', k.p)) FROM (SELECT a.perkara_id, $ADB.isian_rtf_pihak_peringkat($T, a.id) AS p, (SELECT COUNT(*) FROM SIPP_TBL z WHERE z.perkara_id = a.perkara_id) AS n FROM SIPP_TBL a JOIN (SELECT perkara_id FROM SIPP_TBL GROUP BY perkara_id HAVING NOT (MIN(urutan) = 1 AND MAX(urutan) = COUNT(*) AND COUNT(DISTINCT urutan) = COUNT(*))) r ON r.perkara_id = a.perkara_id) k"
  UJI2="${UJI2//SIPP_TBL/perkara_pihak$T}"
  u2=$($SQ -e "$UJI2" 2>"$CAD/uji-tak-rapat$T.err" | tr -d '\r') || { head -3 "$CAD/uji-tak-rapat$T.err"; batal "fungsi peringkat gagal dijalankan atas perkara tak rapat (perkara_pihak$T)"; }
  echo "UJI tak rapat perkara_pihak$T (baris | di luar 1..jumlah | peringkat kembar): $(echo "$u2" | tr '\t' ' ')"
  if [ "$(echo "$u2" | cut -f2)" != 0 ] || [ "$(echo "$u2" | cut -f3)" != 0 ]; then batal "peringkat perkara tak rapat salah (perkara_pihak$T)"; fi
done
# (b) kueri baru tiap variabel yang diubah harus berjalan tanpa galat atas perkara contoh (perkara-uji.txt); galat tabel luar yang tak ada di laptop tidak dihitung
PERKARA_UJI="$(cat perkara-uji.txt | tr '\n' ',' | sed "s/,\$//; s/,/','/g")"
galat=0
for PID in $($SQ -e "SELECT perkara_id FROM perkara WHERE nomor_perkara IN ('$PERKARA_UJI')" 2>/dev/null | tr -d '\r' | grep -v NULL | sort -u); do
  ( echo "SET @pid = $PID;"; sed "s/aps_badilag\\./$ADB./g" "$N-UJIVAR.sql" ) | mysql -h "$H" -u root --default-character-set=latin1 --force "$SDB" -N > "$CAD/ujivar-$PID.out" 2> "$CAD/ujivar-$PID.err"
  g=$(grep -c '^ERROR' "$CAD/ujivar-$PID.err")
  gt=$(grep -c "^ERROR 1146\|^ERROR 1049" "$CAD/ujivar-$PID.err")
  echo "uji kueri baru perkara $PID: $(grep -c . "$CAD/ujivar-$PID.out") variabel jalan, $((g - gt)) galat, $gt galat tabel luar tidak ada"
  galat=$((galat + g - gt))
  [ "$((g - gt))" = 0 ] || head -3 "$CAD/ujivar-$PID.err"
done
# kueri berat (9280 9281 9290 9291) hanya untuk SATU perkara contoh (yang pertama)
PID1=$($SQ -e "SELECT perkara_id FROM perkara WHERE nomor_perkara IN ('$PERKARA_UJI')" 2>/dev/null | tr -d '\r' | grep -v NULL | sort -u | head -1)
if [ -n "$PID1" ]; then
  ( echo "SET @pid = $PID1;"; sed "s/aps_badilag\./$ADB./g" "$N-UJIVAR-BERAT.sql" ) | mysql -h "$H" -u root --default-character-set=latin1 --force "$SDB" -N > "$CAD/ujivar-berat.out" 2> "$CAD/ujivar-berat.err"
  g=$(grep -c '^ERROR' "$CAD/ujivar-berat.err")
  echo "uji kueri berat perkara $PID1: $(grep -c . "$CAD/ujivar-berat.out") variabel jalan, $g galat"
  [ "$g" = 0 ] || head -3 "$CAD/ujivar-berat.err"
  galat=$((galat + g))
fi
[ "$galat" = 0 ] || batal "kueri baru berhenti dengan galat atas perkara contoh"
touch "$CAD/pasang.selesai"
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
