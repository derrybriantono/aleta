#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-alamat-ganda-26okt" (26 Okt 2026). Dijalankan DI SERVER sebagai root, dari folder paket.
# Isi: 10 fungsi tersimpan isian_rtf_alamat* (merapikan alamat pihak, membuang ekor wilayah ganda dari SIPP/e-Court), 3 variabel baru (3517-3519),
#      baris variabel yang DIUBAH (daftar di nomor-ubah.txt: 7047, 7048, relaas, kewenangan relatif, kode pos, ekonomi syariah, eksekusi ...), dua fungsi x9
#      (isian_rtf_pihak_utama, isian_rtf_pihak_tambahan) yang kini membungkus alamatnya, dan 116 blangko RTF derry_briantono yang menyebut #0101#, #0105#, #1036#
#      (diganti #3517#, #3518#, #3519#). Blangko non-Derry TIDAK disentuh. Fungsi hanya MEMBACA tabel SIPP.
# Urutan: md5 paket -> PRASYARAT (baca saja) -> praperiksa RTF (baca saja) -> CADANGAN baris variabel -> FUNGSI -> PASANG SQL (satu transaksi) -> PERIKSA ->
#         UJI atas data nyata (baca saja) -> tambal RTF (cadangan utuh dulu) -> periksa ulang RTF. Gagal di tengah = PULIH otomatis.
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_ag1 SIPP_DB=sipp_donggala ABT_BLANGKO=<salinan derry_briantono> PY=python bash pasang-satker.sh
#         (nama basis SIPP di berkas fungsi/uji disesuaikan otomatis; variabel tetap menyebut aps_badilag.isian_rtf_alamat)
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-alamat-ganda-26okt
HARAP=$(sed -n 1p harap.txt)
ULANG=$(sed -n 2p harap.txt)
NR=$(grep -c . rtf-daftar-tambal.tsv)
NU=$(tr ',' '\n' < nomor-ubah.txt | grep -c .)
CAD="$SINI/cadangan"
SDB="${SIPP_DB:-SIPP}"
ADB="${ABT_DB:-aps_badilag}"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt/derry_briantono}"
PERL="${PERL:-perl}"
gagal() { echo "GAGAL: $*"; exit 1; }
pulih() { echo "... memulihkan"; ABT_DB="$ADB" SIPP_DB="$SDB" ABT_BLANGKO="$B" bash "$SINI/pulih-satker.sh" 2>&1 | tail -6; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp, bukan editor"
[ -d "$B" ] || gagal "folder blangko $B tidak ada"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
myn() { $MY -N "$@" | tr -d '\r'; }
NOMOR_UBAH=$(cat nomor-ubah.txt)
sqlf() { if [ "$SDB" = SIPP ]; then cat "$1"; else sed "s/SIPP\\./$SDB./g" "$1"; fi; }
# definisi fungsi x9 di basis uji laptop memuat nama basis SIPP uji; md5 server dihitung atas nama "SIPP" - samakan dulu
sqlm() { if [ "$SDB" = SIPP ]; then cat "$1"; else sed "s/MD5(routine_definition)/MD5(REPLACE(routine_definition, '$SDB.', 'SIPP.'))/g" "$1"; fi; }
set -o pipefail

# --- 1. PRASYARAT (baca saja) -------------------------------------------------------------------------------------------
p=$(sqlm "$N-PRASYARAT.sql" | $MY -N | tr -d '\r') || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
if [ "$p" != "$HARAP" ] && [ "$p" != "$ULANG" ]; then
  gagal "prasyarat '$p' (harus '$HARAP', atau '$ULANG' bila pasang ulang) - TIDAK ada yang diubah. Arti angka: lihat $N-PRASYARAT.sql"
fi
echo "PRASYARAT COCOK ($p)"
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"

# --- 2. praperiksa RTF (baca saja): semua COCOK (belum ditambal) atau semua SUDAH --------------------------------------------
$PERL tambal-rtf.pl periksa "$B" "$CAD" > "$CAD/periksa-rtf-sebelum.txt" || gagal "praperiksa RTF galat (lihat $CAD/periksa-rtf-sebelum.txt) - TIDAK ada yang diubah"
r=$(tail -1 "$CAD/periksa-rtf-sebelum.txt")
case "$r" in
  "RINGKAS COCOK=$NR SUDAH=0 LEWAT=0") RTF=belum ;;
  "RINGKAS COCOK=0 SUDAH=$NR LEWAT=0") RTF=sudah ;;
  *) tail -n 12 "$CAD/periksa-rtf-sebelum.txt"; gagal "praperiksa RTF '$r' (harus COCOK=$NR SUDAH=0 LEWAT=0 atau COCOK=0 SUDAH=$NR LEWAT=0) - TIDAK ada yang diubah; berkas LEWAT: lihat di atas" ;;
esac
echo "PRAPERIKSA RTF: $r"

# --- 3. CADANGAN (hanya saat pertama; pasang ulang TIDAK menimpa cadangan isi lama) ----------------------------------------
if [ "$p" = "$HARAP" ]; then
  [ -f "$CAD/abt_variabel-sebelum.sql" ] && mv "$CAD/abt_variabel-sebelum.sql" "$CAD/abt_variabel-sebelum.$(date +%Y%m%d%H%M%S).sql"
  mysqldump -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
    --complete-insert --skip-comments --hex-blob --where="no_var IN ($NOMOR_UBAH)" "$ADB" abt_variabel > "$CAD/abt_variabel-sebelum.sql" \
    || gagal "mysqldump abt_variabel gagal - TIDAK ada yang diubah"
  nlama=$(grep -c '^REPLACE' "$CAD/abt_variabel-sebelum.sql")
  [ "$nlama" = "$NU" ] || gagal "cadangan memuat $nlama baris (harus $NU) - TIDAK ada yang diubah"
  echo "CADANGAN: $CAD/abt_variabel-sebelum.sql ($nlama baris lama)"
  # --- 4. FUNGSI (10 baru + dua fungsi x9 yang dibungkus) ---------------------------------------------------------------
  sqlf "$N-FUNGSI.sql" | $MY > "$CAD/fungsi-pasang.log" 2>&1 || { tail -5 "$CAD/fungsi-pasang.log"; pulih; gagal "fungsi tidak bisa dibuat - dipulihkan"; }
  echo "FUNGSI: $(myn -e "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name LIKE 'isian\\_rtf\\_alamat%' AND routine_comment LIKE 'AG:%'") dibuat"
  # --- 5. PASANG SQL ----------------------------------------------------------------------------------------------------
  $MY < "$N-PASANG.sql" || { pulih; gagal "$N-PASANG.sql gagal (transaksi tidak di-COMMIT) - dipulihkan"; }
else
  [ -f "$CAD/abt_variabel-sebelum.sql" ] || echo "PERINGATAN: paket sudah terpasang tetapi $CAD/abt_variabel-sebelum.sql tidak ada - PULIH tidak dapat mengembalikan isi lama (ambil dari cadangan DB harian)"
  echo "PASANG ULANG: cadangan isi lama dibiarkan"
fi

# --- 6. PERIKSA ----------------------------------------------------------------------------------------------------------------
sqlm "$N-PERIKSA.sql" | $MY -N 2>&1 | tr -d '\r' > "$CAD/periksa-sesudah.txt"
tail -1 "$CAD/periksa-sesudah.txt"
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  grep -v '	1$' "$CAD/periksa-sesudah.txt" | head -20
  [ "$p" = "$HARAP" ] && pulih
  gagal "PERIKSA tidak cocok$([ "$p" = "$HARAP" ] && echo ' - dipulihkan')"
fi

# --- 7. UJI atas data nyata (baca saja) -----------------------------------------------------------------------------------------
SQ="mysql -h $H -u root --default-character-set=latin1 $SDB -N"
UJI="SELECT COUNT(*), SUM(CHAR_LENGTH($ADB.isian_rtf_alamat(a.alamat)) = 0 AND CHAR_LENGTH(IFNULL(a.alamat,'')) > 0), SUM($ADB.isian_rtf_alamat(a.alamat) <> TRIM(IFNULL(a.alamat,''))) FROM perkara_pihak1 a JOIN perkara r ON r.perkara_id = a.perkara_id WHERE r.tanggal_pendaftaran >= '2026-01-01'"
u1=$($SQ -e "$UJI" 2>"$CAD/uji-alamat.err" | tr -d '\r') || { cat "$CAD/uji-alamat.err" | head -3; [ "$p" = "$HARAP" ] && pulih; gagal "fungsi alamat gagal dijalankan atas alamat Pemohon/Penggugat 2026$([ "$p" = "$HARAP" ] && echo ' - dipulihkan')"; }
u2=$($SQ -e "${UJI//perkara_pihak1/perkara_pihak2}" 2>"$CAD/uji-alamat.err" | tr -d '\r') || { cat "$CAD/uji-alamat.err" | head -3; [ "$p" = "$HARAP" ] && pulih; gagal "fungsi alamat gagal dijalankan atas alamat Termohon/Tergugat 2026$([ "$p" = "$HARAP" ] && echo ' - dipulihkan')"; }
echo "UJI alamat 2026 (jumlah | jadi kosong padahal ada | berubah): Pemohon/Penggugat $(echo "$u1" | tr '\t' ' ') ; Termohon/Tergugat $(echo "$u2" | tr '\t' ' ')"
if [ "$(echo "$u1" | cut -f2)" != 0 ] || [ "$(echo "$u2" | cut -f2)" != 0 ]; then
  [ "$p" = "$HARAP" ] && pulih
  gagal "ada alamat yang menjadi kosong - dibatalkan$([ "$p" = "$HARAP" ] && echo ' dan dipulihkan')"
fi
PERKARA_UJI="$(cat perkara-uji.txt | tr '\n' ',' | sed "s/,\$//; s/,/','/g")"
for PID in $($SQ -e "SELECT perkara_id FROM perkara WHERE nomor_perkara IN ('$PERKARA_UJI')" 2>/dev/null | tr -d '\r' | grep -v NULL | sort -u); do
  c=$($SQ -e "SELECT CHAR_LENGTH($ADB.isian_rtf_pihak_utama($PID, 1, 5, 'Pemohon', 'tempat kediaman di')), CHAR_LENGTH($ADB.isian_rtf_pihak_utama($PID, 2, 6, 'Tergugat', 'tempat kediaman di')), CHAR_LENGTH($ADB.isian_rtf_pihak_tambahan($PID, 4)), CHAR_LENGTH($ADB.isian_rtf_pihak_tambahan($PID, 3))" 2>"$CAD/uji-$PID.err" | tr -d '\r') || {
    echo "uji perkara $PID: GALAT $(head -c 300 "$CAD/uji-$PID.err")"; [ "$p" = "$HARAP" ] && pulih; gagal "fungsi x9 yang dibungkus tidak jalan di server ini$([ "$p" = "$HARAP" ] && echo ' - dipulihkan')"; }
  echo "uji perkara $PID: fungsi x9 jalan (panjang utama1 utama2 tambahan4 tambahan3): $(echo "$c" | tr '\t' ' ')"
done

# --- 8. tambal RTF (cadangan utuh dulu) ---------------------------------------------------------------------------------------------
if [ "$RTF" = belum ]; then
  echo "== tambal blangko RTF derry_briantono ($NR berkas)"
  if ! $PERL tambal-rtf.pl pasang "$B" "$CAD" > "$CAD/tambal-hasil.txt"; then
    tail -n 6 "$CAD/tambal-hasil.txt"
    echo "tambal RTF gagal - memulihkan"; $PERL tambal-rtf.pl pulih "$B" "$CAD" | tail -n 3
    [ "$p" = "$HARAP" ] && pulih
    gagal "tambal RTF dibatalkan dan dipulihkan"
  fi
  tail -n 3 "$CAD/tambal-hasil.txt"
  $PERL tambal-rtf.pl periksa "$B" "$CAD" > "$CAD/periksa-rtf-sesudah.txt"
  tail -n 2 "$CAD/periksa-rtf-sesudah.txt"
  if [ "$(tail -1 "$CAD/periksa-rtf-sesudah.txt")" != "RINGKAS COCOK=0 SUDAH=$NR LEWAT=0" ]; then
    echo "periksa ulang RTF tidak cocok - memulihkan"; $PERL tambal-rtf.pl pulih "$B" "$CAD" | tail -n 3
    [ "$p" = "$HARAP" ] && pulih
    gagal "RTF dibatalkan dan dipulihkan"
  fi
fi
touch "$CAD/pasang.selesai"
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
