#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-identitas-pihak-1nov" (1 Nov 2026, agen V; keputusan pengguna 101 dan 102). Dijalankan DI SERVER sebagai root, dari folder paket.
# HANYA pengguna derry_briantono. Isi:
#   1. bunyi identitas pihak: variabel 7047/7048 (identitas Penggugat-Pemohon / Tergugat-Termohon) memakai SATU jalan (fungsi isian_rtf_pihak_identitas) dengan
#      TANPA umur (keputusan 112), urutan agama-pendidikan-pekerjaan, kalimat kuasa tanpa koma sebelum "yang telah didaftarkan"; fungsi
#      isian_rtf_pihak_tambahan (Turut Tergugat/intervensi) disamakan (pendidikan);
#   2. blangko RTF: paragraf identitas pihak dibentuk persis blangko acuan "[01] [Kabul Verstek] Cerai (Format Lengkap)" (baris pertama menjorok 1,25 cm, baris lanjutan
#      menjorok gantung 4,5 cm, rata kanan-kiri); identitas tertulis tangan diganti #7047#/#7048# (daftar-tambal.tsv + tambal.tsv).
# URUTAN PASANG: KE-31, PALING AKHIR - sesudah perbaikan-1nov (ke-30) (md5 dasar = keadaan SESUDAH 30 paket ../URUTAN-PASANG-1nov.md).
# Urutan: md5 -> PRASYARAT SQL + BERKAS (baca saja) -> CADANGAN -> FUNGSI -> PASANG SQL (satu transaksi) -> PERIKSA -> UJI atas data nyata (baca saja)
#         -> BERKAS -> PERIKSA BERKAS. Gagal sesudah FUNGSI = PULIH otomatis.
# Laptop: ABT_LOKAL=1 ABT_DB=<basis ABT uji> SIPP_DB=<basis SIPP uji> ABT_BLANGKO=<_blangko_abt uji> MYSQL_BIN=<folder mysql.exe> PY=python bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-identitas-pihak-1nov
HARAP="$(sed -n 1p harap.txt | tr -d '\r')"
ULANG="$(sed -n 2p harap.txt | tr -d '\r')"
UBAH="$(grep -v '^#' nomor-diubah.txt | paste -sd, -)"
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
SDB="${SIPP_DB:-SIPP}"
ADB="${ABT_DB:-aps_badilag}"
PY="${PY:-python}"
BIN="${MYSQL_BIN:-}"; [ -n "$BIN" ] && BIN="$BIN/"
gagal() { echo "GAGAL: $*"; exit 1; }
pulih() { echo "... memulihkan"; ABT_DB="$ADB" SIPP_DB="$SDB" ABT_BLANGKO="$B" PY="$PY" MYSQL_BIN="${MYSQL_BIN:-}" bash "$SINI/pulih-satker.sh" 2>&1 | tail -6; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp, bukan editor"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="${BIN}mysql -h $H -u root --default-character-set=latin1 $ADB"
myn() { $MY -N "$@" | tr -d '\r'; }
sqlf() { if [ "$SDB" = SIPP ]; then cat "$1"; else sed "s/SIPP\\./$SDB./g" "$1"; fi; }
# definisi fungsi di basis uji laptop memuat nama basis SIPP uji; md5 server dihitung atas nama "SIPP" - samakan dulu
sqlm() { if [ "$SDB" = SIPP ]; then cat "$1"; else sed "s/MD5(routine_definition)/MD5(REPLACE(routine_definition, '$SDB.', 'SIPP.'))/g" "$1"; fi; }
set -o pipefail

# --- 1. PRASYARAT (baca saja) -------------------------------------------------------------------------------------------
p=$(sqlm "$N-PRASYARAT.sql" | $MY -N | tr -d '\r') || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
if [ "$p" != "$HARAP" ] && [ "$p" != "$ULANG" ]; then
  gagal "prasyarat '$p' (harus '$HARAP' pasang pertama atau '$ULANG' pasang ulang) - TIDAK ada yang diubah. Arti angka: lihat $N-PRASYARAT.sql"
fi
echo "PRASYARAT COCOK ($p)"
c=$($PY tambal_rtf.py cek "$B"); echo "$c" | tail -3
[ "$(echo "$c" | tail -1 | tr -d '\r')" = "BERKAS SIAP" ] || gagal "berkas tujuan tidak sesuai - TIDAK ada yang diubah"

# --- 2. CADANGAN (hanya saat pertama; pasang ulang TIDAK menimpa cadangan isi lama) --------------------------------------
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
if [ "$p" = "$HARAP" ]; then
  [ -f "$CAD/abt_variabel-sebelum.sql" ] && mv "$CAD/abt_variabel-sebelum.sql" "$CAD/abt_variabel-sebelum.$(date +%Y%m%d%H%M%S).sql"
  "${BIN}mysqldump" -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
    --complete-insert --skip-comments --hex-blob --where="no_var IN ($UBAH)" "$ADB" abt_variabel > "$CAD/abt_variabel-sebelum.sql" \
    || gagal "mysqldump abt_variabel gagal - TIDAK ada yang diubah"
  nlama=$(grep -c '^REPLACE' "$CAD/abt_variabel-sebelum.sql")
  nharap=$(echo "$UBAH" | tr ',' '\n' | grep -c .)
  [ "$nlama" = "$nharap" ] || gagal "cadangan memuat $nlama baris (harus $nharap) - TIDAK ada yang diubah"
  echo "CADANGAN: $CAD/abt_variabel-sebelum.sql ($nlama baris lama)"
  # --- 3. FUNGSI (2 diganti) ---------------------------------------------------------------------------------------------
  sqlf "$N-FUNGSI.sql" | $MY > "$CAD/fungsi-pasang.log" 2>&1 || { tail -5 "$CAD/fungsi-pasang.log"; pulih; gagal "fungsi tidak bisa dibuat - dipulihkan"; }
  echo "FUNGSI: 2 diganti (isian_rtf_pihak_identitas, isian_rtf_pihak_tambahan)"
  # --- 4. PASANG SQL ------------------------------------------------------------------------------------------------------
  $MY < "$N-PASANG.sql" || { pulih; gagal "$N-PASANG.sql gagal (transaksi tidak di-COMMIT) - dipulihkan"; }
else
  [ -f "$CAD/abt_variabel-sebelum.sql" ] || echo "PERINGATAN: paket sudah terpasang tetapi $CAD/abt_variabel-sebelum.sql tidak ada - PULIH tidak dapat mengembalikan isi lama (ambil dari cadangan DB harian)"
  echo "PASANG ULANG: cadangan isi lama dibiarkan"
fi

# --- 5. PERIKSA ------------------------------------------------------------------------------------------------------------------
sqlm "$N-PERIKSA.sql" | $MY -N 2>&1 | tr -d '\r' > "$CAD/periksa-sesudah.txt"
tail -1 "$CAD/periksa-sesudah.txt"
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  grep -v '	1$' "$CAD/periksa-sesudah.txt" | head -20
  [ "$p" = "$HARAP" ] && pulih
  gagal "PERIKSA tidak cocok$([ "$p" = "$HARAP" ] && echo ' - dipulihkan')"
fi

# --- 6. UJI atas data nyata (baca saja) ---------------------------------------------------------------------------------------------
SQ="${BIN}mysql -h $H -u root --default-character-set=latin1 $SDB -N"
batal() { [ "$p" = "$HARAP" ] && pulih; gagal "$1$([ "$p" = "$HARAP" ] && echo ' - dipulihkan')"; }
# (a) fungsi identitas atas perkara contoh: TANPA "(N tahun)" dan tanpa tulisan "(umur)" (keputusan 112), pendidikan SEBELUM pekerjaan, sebutan tebal
for SISI in 1 2; do
  T=perkara_pihak$SISI
  PID=$($SQ -e "SELECT a.perkara_id FROM $T a JOIN pihak b ON b.id = a.pihak_id JOIN perkara p ON p.perkara_id = a.perkara_id WHERE b.tanggal_lahir > '1900-01-01' AND b.tempat_lahir <> '' AND b.pekerjaan <> '' AND b.pendidikan_id IS NOT NULL AND a.alamat NOT LIKE '%dahulu%' ORDER BY a.perkara_id DESC LIMIT 1" 2>/dev/null | tr -d '\r')
  if [ -z "$PID" ]; then echo "UJI identitas sisi $SISI dilewati: tidak ada perkara contoh"; continue; fi
  S=$([ "$SISI" = 1 ] && echo Penggugat || echo Tergugat)
  HA=$($SQ -e "SELECT $ADB.isian_rtf_pihak_identitas($PID, $SISI, '$S', 'tempat kediaman di', '', '')" 2>"$CAD/uji-id-$SISI.err" | tr -d '\r')
  [ -n "$HA" ] || { head -3 "$CAD/uji-id-$SISI.err"; batal "fungsi identitas tidak menjawab (sisi $SISI, perkara $PID)"; }
  echo "$HA" | grep -Eq ' \([0-9]+ tahun\)' && batal "identitas sisi $SISI perkara $PID masih memuat umur dalam kurung (keputusan 112: umur tidak dicetak)"
  echo "$HA" | grep -q '(umur)' && batal "identitas sisi $SISI perkara $PID masih memuat tulisan (umur)"
  echo "$HA" | grep -Eq '([0-9]{4}|\.\.\.), agama ' || batal "identitas sisi $SISI perkara $PID: tanggal lahir tidak langsung disusul agama"
  echo "$HA" | grep -Eq ', pendidikan .*, pekerjaan ' || batal "identitas sisi $SISI perkara $PID: urutan pendidikan-pekerjaan salah"
  echo "$HA" | grep -q "sebagai <strong>$S</strong>;" || batal "identitas sisi $SISI perkara $PID: sebutan tebal tidak ada"
  echo "UJI identitas sisi $SISI perkara $PID: ${HA:0:70}..."
done
# (b) Turut Tergugat (perkara_pihak4): bila ada contoh, tanpa umur
PID4=$($SQ -e "SELECT t.perkara_id FROM perkara_pihak4 t JOIN pihak b ON b.id = t.pihak_id WHERE b.tanggal_lahir > '1900-01-01' AND IFNULL(b.tempat_lahir,'') <> '' ORDER BY t.perkara_id DESC LIMIT 1" 2>/dev/null | tr -d '\r')
if [ -n "$PID4" ]; then
  HT=$($SQ -e "SELECT $ADB.isian_rtf_pihak_tambahan($PID4, 4)" 2>"$CAD/uji-tambahan.err" | tr -d '\r')
  [ -n "$HT" ] || { head -3 "$CAD/uji-tambahan.err"; batal "fungsi Turut Tergugat tidak menjawab (perkara $PID4)"; }
  echo "$HT" | grep -Eq '\([0-9]+ tahun\)|\(umur\)' && batal "identitas Turut Tergugat perkara $PID4 masih memuat umur"
  echo "UJI Turut Tergugat perkara $PID4: ${HT:0:60}..."
else
  echo "UJI Turut Tergugat dilewati: tidak ada perkara contoh"
fi
# (c) kueri baru tiap variabel yang diubah harus berjalan tanpa galat atas perkara contoh (perkara-uji.txt); galat tabel luar yang tak ada di laptop tidak dihitung
PERKARA_UJI="$(cat perkara-uji.txt | tr '\n' ',' | sed "s/,\$//; s/,/','/g")"
galat=0
for PID in $($SQ -e "SELECT perkara_id FROM perkara WHERE nomor_perkara IN ('$PERKARA_UJI')" 2>/dev/null | tr -d '\r' | grep -v NULL | sort -u); do
  ( echo "SET @pid = $PID;"; sed "s/aps_badilag\\./$ADB./g" "$N-UJIVAR.sql" ) | ${BIN}mysql -h "$H" -u root --default-character-set=latin1 --force "$SDB" -N > "$CAD/ujivar-$PID.out" 2> "$CAD/ujivar-$PID.err"
  g=$(grep -c '^ERROR' "$CAD/ujivar-$PID.err")
  gt=$(grep -c "^ERROR 1146\|^ERROR 1049" "$CAD/ujivar-$PID.err")
  echo "uji kueri baru perkara $PID: $(grep -c . "$CAD/ujivar-$PID.out") variabel jalan, $((g - gt)) galat, $gt galat tabel luar tidak ada"
  galat=$((galat + g - gt))
  [ "$((g - gt))" = 0 ] || head -3 "$CAD/ujivar-$PID.err"
done
[ "$galat" = 0 ] || batal "kueri baru berhenti dengan galat atas perkara contoh"

# --- 7. BERKAS RTF ---------------------------------------------------------------------------------------------------------------
$PY tambal_rtf.py pasang "$B" "$CAD" > "$CAD/berkas-pasang.txt"
if [ "$?" != "0" ]; then
  tail -5 "$CAD/berkas-pasang.txt"
  $PY tambal_rtf.py pulih "$B" "$CAD"; [ "$p" = "$HARAP" ] && pulih
  gagal "berkas RTF tidak terpasang - berkas & variabel dikembalikan (lihat $CAD/berkas-pasang.txt)"
fi
tail -1 "$CAD/berkas-pasang.txt"
$PY tambal_rtf.py periksa "$B" > "$CAD/berkas-periksa.txt"
tail -1 "$CAD/berkas-periksa.txt"
if [ "$(tail -1 "$CAD/berkas-periksa.txt" | tr -d '\r')" != "BERKAS COCOK" ]; then
  $PY tambal_rtf.py pulih "$B" "$CAD"; [ "$p" = "$HARAP" ] && pulih
  gagal "periksa berkas tidak cocok - berkas & variabel dikembalikan"
fi
touch "$CAD/pasang.selesai"
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
