#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-pihak-urut-ecourt-27okt" (27 Okt 2026). Dijalankan DI SERVER sebagai root, dari folder paket.
# Isi: sebutan pihak banyak menurut PERINGKAT (urut urutan, id), bukan nilai kolom urutan (pendaftaran e-Court menomori urutan bersambung):
#      4 fungsi x9 diganti (isian_rtf_pihak_utama/nama/urutan/tambahan), 5 fungsi baru (isian_rtf_pihak_jumlah/identitas/nama_semua/kaki/sebut),
#      2 variabel baru (3520 3521), baris variabel yang DIUBAH (daftar di nomor-ubah.txt: 7036 7037 7047 7048 7097 7098 7148 7149 7152 8516)
#      dan blangko RTF derry_briantono keluarga Turut Tergugat (#8710# dan #7054# sesudah identitas Tergugat). Blangko non-Derry TIDAK disentuh.
# Urutan: md5 paket -> PRASYARAT (baca saja) -> praperiksa RTF (baca saja) -> CADANGAN baris variabel -> FUNGSI -> PASANG SQL (satu transaksi) -> PERIKSA ->
#         UJI atas data nyata (baca saja) -> tambal RTF (cadangan utuh dulu) -> periksa ulang RTF. Gagal di tengah = PULIH otomatis.
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_pu3 SIPP_DB=sipp_donggala ABT_BLANGKO=<salinan derry_briantono> PY=python bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-pihak-urut-ecourt-27okt
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
  # --- 4. FUNGSI (5 baru + empat fungsi x9 yang diganti) ---------------------------------------------------------------
  sqlf "$N-FUNGSI.sql" | $MY > "$CAD/fungsi-pasang.log" 2>&1 || { tail -5 "$CAD/fungsi-pasang.log"; pulih; gagal "fungsi tidak bisa dibuat - dipulihkan"; }
  echo "FUNGSI: $(myn -e "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_comment LIKE 'PU:%'") dibuat (9 = 5 baru + 4 x9 diganti)"
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
# (a) kaki putusan atas SEMUA perkara 2026 yang punya pihak: tidak boleh kosong/NULL padahal ada pihak (alur gugatan/permohonan 15, 16, 17)
UJI="SELECT COUNT(*), SUM($ADB.isian_rtf_pihak_kaki(r.perkara_id, 1) IS NULL OR $ADB.isian_rtf_pihak_kaki(r.perkara_id, 1) = ''), SUM($ADB.isian_rtf_pihak_kaki(r.perkara_id, 2) IS NULL OR $ADB.isian_rtf_pihak_kaki(r.perkara_id, 2) = '') FROM perkara r WHERE r.tanggal_pendaftaran >= '2026-01-01' AND r.alur_perkara_id IN (15, 16, 17) AND EXISTS (SELECT 1 FROM perkara_pihak1 x WHERE x.perkara_id = r.perkara_id) AND EXISTS (SELECT 1 FROM perkara_pihak2 y WHERE y.perkara_id = r.perkara_id)"
u1=$($SQ -e "$UJI" 2>"$CAD/uji-kaki.err" | tr -d '\r') || { head -3 "$CAD/uji-kaki.err"; [ "$p" = "$HARAP" ] && pulih; gagal "fungsi kaki gagal dijalankan atas perkara 2026$([ "$p" = "$HARAP" ] && echo ' - dipulihkan')"; }
echo "UJI kaki 2026 (perkara | kaki P kosong | kaki T kosong): $(echo "$u1" | tr '\t' ' ')"
if [ "$(echo "$u1" | cut -f2)" != 0 ] || [ "$(echo "$u1" | cut -f3)" != 0 ]; then
  [ "$p" = "$HARAP" ] && pulih
  gagal "ada perkara 2026 yang kakinya kosong padahal ada pihak - dibatalkan$([ "$p" = "$HARAP" ] && echo ' dan dipulihkan')"
fi
# (b) fungsi identitas/nama/kaki/sebut/tambahan atas perkara contoh (perkara-uji.txt): harus jalan tanpa galat
PERKARA_UJI="$(cat perkara-uji.txt | tr '\n' ',' | sed "s/,\$//; s/,/','/g")"
for PID in $($SQ -e "SELECT perkara_id FROM perkara WHERE nomor_perkara IN ('$PERKARA_UJI')" 2>/dev/null | tr -d '\r' | grep -v NULL | sort -u); do
  c=$($SQ -e "SELECT $ADB.isian_rtf_pihak_jumlah($PID, 1), $ADB.isian_rtf_pihak_jumlah($PID, 2), $ADB.isian_rtf_pihak_jumlah($PID, 4), CHAR_LENGTH($ADB.isian_rtf_pihak_identitas($PID, 1, 'Penggugat', 'tempat kediaman di', '', '')), CHAR_LENGTH($ADB.isian_rtf_pihak_identitas($PID, 2, 'Tergugat', 'tempat kediaman di', '', '')), CHAR_LENGTH($ADB.isian_rtf_pihak_nama_semua($PID, 2, 'Tergugat')), CHAR_LENGTH($ADB.isian_rtf_pihak_utama($PID, 1, 5, 'Pemohon', 'tempat kediaman di')), CHAR_LENGTH($ADB.isian_rtf_pihak_tambahan($PID, 4)), $ADB.isian_rtf_pihak_kaki($PID, 2), $ADB.isian_rtf_pihak_sebut($PID, 4)" 2>"$CAD/uji-$PID.err" | tr -d '\r') || {
    echo "uji perkara $PID: GALAT $(head -c 300 "$CAD/uji-$PID.err")"; [ "$p" = "$HARAP" ] && pulih; gagal "fungsi tidak jalan di server ini$([ "$p" = "$HARAP" ] && echo ' - dipulihkan')"; }
  echo "uji perkara $PID (jumlah P, T, Turut | panjang identitas P, T, nama T, utama P5+, tambahan | kaki T | sebut Turut): $(echo "$c" | tr '\t' ' ')"
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
