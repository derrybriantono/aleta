#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-court-calendar-28okt" (28 Okt 2026). Dijalankan DI SERVER sebagai root, dari folder paket. HANYA pengguna derry_briantono.
# Isi: dua blangko RTF "Court Calendar" (penetapan jadwal persidangan; perubahan jadwal karena gugatan rekonvensi) di folder BARU "98c Court Calendar - BAS"
# dan SATU baris abt_menu untuk folder itu (hak sama dengan menu ALUR 04 Cerai Kontra Tertulis, id 963). Tidak ada variabel, fungsi, berkas, atau menu lama yang diubah.
# Urutan: md5 -> PRASYARAT (baca saja) + BERKAS (baca saja) -> CADANGAN -> PASANG SQL (satu transaksi) -> PERIKSA -> FOLDER BARU + BERKAS RTF -> PERIKSA BERKAS.
#         Gagal sesudah PASANG = PULIH otomatis (berkas, folder, dan baris menu baru dikembalikan).
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_cc ABT_BLANGKO=<_blangko_abt uji> MYSQL_BIN=<folder mysql.exe> PY=python bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-court-calendar-28okt
HARAP='37|0|1'
ULANG='37|1|1'
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
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
pulih_sql() { $MY -N < "$N-PULIH.sql"; }

# --- 1. PRASYARAT (baca saja) -------------------------------------------------------------------------------------------
p=$($MY -N < "$N-PRASYARAT.sql") || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
if [ "$p" != "$HARAP" ] && [ "$p" != "$ULANG" ]; then
  gagal "prasyarat '$p' (harus '$HARAP' pasang pertama atau '$ULANG' pasang ulang) - TIDAK ada yang diubah. Arti angka: lihat $N-PRASYARAT.sql"
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
T=abt_menu
[ -f "$CAD/$T-sebelum.sql" ] && mv "$CAD/$T-sebelum.sql" "$CAD/$T-sebelum.$(date +%Y%m%d%H%M%S).sql"
"${BIN}mysqldump" -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
  --complete-insert --skip-comments --hex-blob --where="direktori='98c Court Calendar - BAS' AND parent_direktori='derry_briantono'" "$ADB" "$T" > "$CAD/$T-sebelum.sql" \
  || gagal "mysqldump $T gagal - TIDAK ada yang diubah"
echo "CADANGAN: $CAD (menu lama folder ini: $(grep -c '^REPLACE' "$CAD/$T-sebelum.sql"))"

# --- 3. PASANG SQL, PERIKSA ---------------------------------------------------------------------------------------------
$MY < "$N-PASANG.sql" || { pulih_sql; gagal "$N-PASANG.sql gagal (transaksi tidak di-COMMIT) - dipulihkan"; }
$MY -N < "$N-PERIKSA.sql" > "$CAD/periksa-sesudah.txt"
tail -1 "$CAD/periksa-sesudah.txt" | cut -f1
if [ "$(tail -1 "$CAD/periksa-sesudah.txt" | cut -f1)" != "SEMUA COCOK" ]; then
  head -20 "$CAD/periksa-sesudah.txt"
  pulih_sql
  gagal "PERIKSA tidak cocok - baris menu baru dihapus; berkas belum disentuh"
fi

# --- 4. FOLDER BARU + BERKAS RTF ---------------------------------------------------------------------------------------
: > "$CAD/folder-dibuat.txt"
while IFS= read -r f; do
  [ -d "$B/$f" ] && { echo "FOLDER SUDAH ADA $f"; continue; }
  if mkdir "$B/$f"; then
    echo "$f" >> "$CAD/folder-dibuat.txt"; echo "FOLDER BARU $f"
    st=$(stat -c '%u:%g' "$(dirname "$B/$f")" 2>/dev/null) && chown "$st" "$B/$f" 2>/dev/null; chmod "$(stat -c %a "$(dirname "$B/$f")" 2>/dev/null || echo 755)" "$B/$f" 2>/dev/null
  else
    pulih_sql; gagal "folder $f tidak bisa dibuat - baris menu baru dihapus"
  fi
done < <(grep -v '^#' folder-baru.txt)
hapus_folder_baru() { while IFS= read -r f; do rmdir "$B/$f" 2>/dev/null; done < "$CAD/folder-dibuat.txt"; }
$PY berkas_rtf.py pasang "$B" "$SINI" "$CAD" | tee "$CAD/berkas-pasang.txt"
if [ "${PIPESTATUS[0]}" != "0" ]; then
  $PY berkas_rtf.py pulih "$B" "$CAD"; hapus_folder_baru
  pulih_sql
  gagal "berkas RTF tidak terpasang - berkas, folder, dan baris menu baru dikembalikan (lihat $CAD/berkas-pasang.txt)"
fi
$PY berkas_rtf.py periksa "$B" "$CAD" | tee "$CAD/berkas-periksa.txt"
if [ "$(tail -1 "$CAD/berkas-periksa.txt")" != "BERKAS COCOK" ]; then
  $PY berkas_rtf.py pulih "$B" "$CAD"; hapus_folder_baru
  pulih_sql
  gagal "periksa berkas tidak cocok - berkas, folder, dan baris menu baru dikembalikan"
fi
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
