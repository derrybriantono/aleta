#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-alamat-putusan-28okt" (28 Okt 2026). Dijalankan DI SERVER sebagai root, dari folder paket.
# Isi: keterangan arah di dalam KURUNG pada alamat pihak ("Jalan Poros Palu-Bangga (rumah sesudah Jembatan / Kios X), Desa Poi") dibuang di PUTUSAN, tidak di relaas.
#      3 fungsi baru (isian_rtf_alamat_arah, _buang_arah, isian_rtf_alamat_putusan), 2 fungsi paket 27 Okt diganti (isian_rtf_pihak_identitas, isian_rtf_pihak_utama),
#      6 variabel Derry diubah (nomor-ubah.txt). Tidak ada blangko yang disentuh; alamat di SIPP tidak diubah.
# Prasyarat: paket abt-pihak-urut-ecourt-27okt dan abt-pihak-urut-sisa-28okt sudah terpasang (diperiksa PRASYARAT).
# Urutan: md5 paket -> PRASYARAT (baca saja) -> CADANGAN baris variabel -> FUNGSI -> PASANG SQL (satu transaksi) -> PERIKSA -> UJI atas data nyata (baca saja). Gagal di tengah = PULIH otomatis.
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_alamat SIPP_DB=sipp_donggala bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-alamat-putusan-28okt
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
sqlf() { if [ "$SDB" = SIPP ]; then cat "$1"; else sed "s/SIPP\./$SDB./g" "$1"; fi; }
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
  # --- 3. FUNGSI (3 baru + 2 diganti) -----------------------------------------------------------------------------------
  sqlf "$N-FUNGSI.sql" | $MY > "$CAD/fungsi-pasang.log" 2>&1 || { tail -5 "$CAD/fungsi-pasang.log"; pulih; gagal "fungsi tidak bisa dibuat - dipulihkan"; }
  echo "FUNGSI: $(myn -e "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_comment LIKE 'AP:%'") dibuat (3 = isian_rtf_alamat_arah, _buang_arah, _putusan), 2 diganti (identitas, utama)"
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
# (a) alamat TANPA kurung tidak boleh berubah sama sekali; (b) alamat berkurung: berubah hanya karena kurung dibuang, tanpa spasi/koma ganda atau koma di tepi yang baru
for T in perkara_pihak1 perkara_pihak2 perkara_pihak4; do
  u1=$($SQ -e "SELECT COUNT(*), IFNULL(SUM($ADB.isian_rtf_alamat_buang_arah(alamat) <> CONVERT(alamat USING latin1)), 0) FROM $T WHERE alamat IS NOT NULL AND alamat NOT LIKE '%(%'" 2>"$CAD/uji-a-$T.err" | tr -d '\r') || { head -3 "$CAD/uji-a-$T.err"; batal "fungsi buang_arah gagal atas $T"; }
  echo "UJI tanpa kurung $T (baris | berubah): $(echo "$u1" | tr '\t' ' ')"
  [ "$(echo "$u1" | cut -f2)" = 0 ] || batal "alamat tanpa kurung berubah ($T)"
  AN="' ,|,,|, ,|^[ ,]|[ ,]\$|  '"
  u2=$($SQ -e "SELECT COUNT(*), IFNULL(SUM(k.b <> k.a), 0), IFNULL(SUM(k.b <> k.a AND k.b REGEXP $AN AND NOT k.a REGEXP $AN), 0), IFNULL(SUM(CHAR_LENGTH(k.b) > CHAR_LENGTH(k.a)), 0) FROM (SELECT CONVERT(alamat USING latin1) AS a, $ADB.isian_rtf_alamat_buang_arah(alamat) AS b FROM $T WHERE alamat LIKE '%(%') k" 2>"$CAD/uji-b-$T.err" | tr -d '\r') || { head -3 "$CAD/uji-b-$T.err"; batal "fungsi buang_arah gagal atas alamat berkurung ($T)"; }
  echo "UJI berkurung $T (baris | berubah | tanda baca baru rusak | jadi lebih panjang): $(echo "$u2" | tr '\t' ' ')"
  if [ "$(echo "$u2" | cut -f3)" != 0 ] || [ "$(echo "$u2" | cut -f4)" != 0 ]; then batal "pembuangan kurung merusak tanda baca atau memperpanjang alamat ($T)"; fi
done
# (c) kueri baru tiap variabel yang diubah harus berjalan tanpa galat atas perkara contoh (perkara-uji.txt); galat tabel luar yang tak ada di laptop tidak dihitung
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
[ "$galat" = 0 ] || batal "kueri baru berhenti dengan galat atas perkara contoh"
touch "$CAD/pasang.selesai"
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
