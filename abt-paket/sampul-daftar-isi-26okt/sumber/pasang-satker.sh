#!/bin/bash
# =============================================================================
# PASANG paket ABT "@@N@@" (26 Okt 2026). Dijalankan DI SERVER sebagai root, dari folder paket. HANYA pengguna derry_briantono.
# Isi: @@JUMLAH@@ variabel baru (5700-5779 dan 5800-5899), fungsi @@FUNGSI@@, satu baris abt_menu (folder "98b Berkas Perkara - BAS" untuk Panitera Sidang),
# enam blangko RTF (sampul: folder 99 PTSP; daftar isi: folder baru), masing-masing A4 (bawaan), F4, dan Legal. Tidak ada berkas, variabel, atau menu lama yang diubah.
# Urutan: md5 -> PRASYARAT (baca saja) + BERKAS (baca saja) -> CADANGAN -> FUNGSI -> PASANG SQL (satu transaksi) -> PERIKSA -> UJI kueri baru atas perkara nyata
#         (baca saja) -> FOLDER BARU + BERKAS RTF -> PERIKSA BERKAS. Gagal sesudah PASANG = PULIH otomatis (berkas, folder, baris, dan fungsi baru dikembalikan).
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_s1 ABT_BLANGKO=<_blangko_abt uji> SIPP_DB=sipp_donggala MYSQL_BIN=<folder mysql.exe> bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=@@N@@
HARAP='@@HARAP@@'
ULANG='@@ULANG@@'
TINGKAT='@@TINGKAT@@'
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
# PULIH SQL sesuai mode (dibaca setelah prasyarat; sebelum itu belum ada yang diubah)
pulih_sql() { if [ "${MODE:-baru}" = peningkatan ]; then $MY -N < "$N-PULIH-PENINGKATAN.sql"; else $MY -N < "$N-PULIH.sql"; fi; }
# berkas SQL memuat nama basis aps_badilag dan penanda __SIPP__; di basis uji laptop diganti nama basis ujinya
sqlf() { sed "s/__SIPP__/$SDB/g; s/aps_badilag\./$ADB./g" "$1"; }

# --- 1. PRASYARAT (baca saja) -------------------------------------------------------------------------------------------
p=$($MY -N < "$N-PRASYARAT.sql") || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
if [ "$p" != "$HARAP" ] && [ "$p" != "$ULANG" ] && [ "$p" != "$TINGKAT" ]; then
  gagal "prasyarat '$p' (harus '$HARAP' pasang pertama, '$ULANG' pasang ulang, atau '$TINGKAT' PENINGKATAN dari paket sebelumnya) - TIDAK ada yang diubah. Arti angka: lihat $N-PRASYARAT.sql"
fi
if [ "$p" = "$TINGKAT" ]; then echo "PRASYARAT COCOK ($p) - PENINGKATAN: @@UBAH@@ variabel dan berkas RTF paket sebelumnya diganti isi barunya"; else echo "PRASYARAT COCOK ($p)"; fi
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
# MODE pulih: "baru" (pasang pertama: pulih = hapus semua) atau "peningkatan" (pulih = kembali ke paket sebelumnya). Pasang ulang tidak mengubahnya.
if [ "$p" = "$HARAP" ]; then echo baru > "$CAD/mode.txt"; elif [ "$p" = "$TINGKAT" ]; then echo peningkatan > "$CAD/mode.txt"; elif [ ! -f "$CAD/mode.txt" ]; then echo baru > "$CAD/mode.txt"; fi
MODE=$(cat "$CAD/mode.txt")
if [ "$p" = "$HARAP" ]; then
  while IFS= read -r f; do
    [ -e "$B/$f" ] && gagal "folder baru $B/$f sudah ada padahal paket belum terpasang - TIDAK ada yang diubah"
  done < <(grep -v '^#' folder-baru.txt)
fi
c=$($PY berkas_rtf.py cek "$B"); echo "$c"
[ "$(echo "$c" | tail -1)" = "BERKAS SIAP" ] || gagal "berkas tujuan tidak sesuai - TIDAK ada yang diubah"

# --- 2. CADANGAN (sesudah prasyarat; tidak pernah menimpa cadangan lama) ------------------------------------------------
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
NOMOR="@@NOMOR@@"
for T in abt_variabel abt_data_teks abt_data_tanggal abt_menu; do
  [ -f "$CAD/$T-sebelum.sql" ] && mv "$CAD/$T-sebelum.sql" "$CAD/$T-sebelum.$(date +%Y%m%d%H%M%S).sql"
  if [ "$T" = abt_menu ]; then W="direktori='98b Berkas Perkara - BAS' AND parent_direktori='derry_briantono'"; else W="no_var IN ($NOMOR)"; fi
  "${BIN}mysqldump" -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
    --complete-insert --skip-comments --hex-blob --where="$W" "$ADB" "$T" > "$CAD/$T-sebelum.sql" \
    || gagal "mysqldump $T gagal - TIDAK ada yang diubah"
done
echo "CADANGAN: $CAD (variabel lama bernomor baru: $(grep -c '^REPLACE' "$CAD/abt_variabel-sebelum.sql"); menu: $(grep -c '^REPLACE' "$CAD/abt_menu-sebelum.sql"))"

# --- 3. FUNGSI, PASANG SQL, PERIKSA ------------------------------------------------------------------------------------
sqlf "$N-FUNGSI.sql" | $MY || { pulih_sql; gagal "fungsi tidak terpasang - dipulihkan"; }
$MY < "$N-PASANG.sql" || { pulih_sql; gagal "$N-PASANG.sql gagal (transaksi tidak di-COMMIT) - dipulihkan"; }
$MY -N < "$N-PERIKSA.sql" > "$CAD/periksa-sesudah.txt"
tail -1 "$CAD/periksa-sesudah.txt" | cut -f1
if [ "$(tail -1 "$CAD/periksa-sesudah.txt" | cut -f1)" != "SEMUA COCOK" ]; then
  head -20 "$CAD/periksa-sesudah.txt"
  pulih_sql
  gagal "PERIKSA tidak cocok - baris dan fungsi baru dihapus; berkas belum disentuh"
fi

# --- 4. UJI kueri baru atas perkara nyata (baca saja) ------------------------------------------------------------------
SQ="${BIN}mysql -h $H -u root --default-character-set=latin1 $SDB -N"
NU=$(awk -F'\t' '!/^#/ && NF==2' uji-kueri.tsv | wc -l | tr -d ' ')
for PID in $($SQ -e "SELECT perkara_id FROM perkara WHERE jenis_perkara_id IN (347,346,362,360,358,354,363,371) ORDER BY perkara_id DESC LIMIT 14" 2>/dev/null | grep -v NULL | sort -u); do
  if ! sed "s/#perkara_id#/$PID/g; s/aps_badilag\./$ADB./g" uji-kueri.tsv | awk -F'\t' '!/^#/ && NF==2 {print "SELECT " $1 " AS var, LEFT(REPLACE(IFNULL((SELECT x.data FROM (" $2 ") x LIMIT 1), \"(kosong)\"), CHAR(10), \" \"), 90) AS nilai;"}' \
       | $SQ > "$CAD/uji-$PID.txt" 2>&1; then
    echo "uji perkara $PID: GALAT $(head -c 300 "$CAD/uji-$PID.txt")"
    pulih_sql
    gagal "kueri variabel baru tidak jalan di server ini - baris dan fungsi baru dihapus; berkas belum disentuh. Kirim $CAD/uji-$PID.txt ke pengembang"
  fi
  [ "$(grep -c . "$CAD/uji-$PID.txt")" = "$NU" ] || { pulih_sql; gagal "uji perkara $PID tidak menjawab $NU baris - dipulihkan"; }
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
    pulih_sql; gagal "folder $f tidak bisa dibuat - baris dan fungsi baru dihapus"
  fi
done < <(grep -v '^#' folder-baru.txt)
hapus_folder_baru() { while IFS= read -r f; do rmdir "$B/$f" 2>/dev/null; done < "$CAD/folder-dibuat.txt"; }
$PY berkas_rtf.py pasang "$B" "$SINI" "$CAD" | tee "$CAD/berkas-pasang.txt"
if [ "${PIPESTATUS[0]}" != "0" ]; then
  $PY berkas_rtf.py pulih "$B" "$CAD"; hapus_folder_baru
  pulih_sql
  gagal "berkas RTF tidak terpasang - berkas, folder, baris, dan fungsi baru dikembalikan (lihat $CAD/berkas-pasang.txt)"
fi
$PY berkas_rtf.py periksa "$B" "$CAD" | tee "$CAD/berkas-periksa.txt"
if [ "$(tail -1 "$CAD/berkas-periksa.txt")" != "BERKAS COCOK" ]; then
  $PY berkas_rtf.py pulih "$B" "$CAD"; hapus_folder_baru
  pulih_sql
  gagal "periksa berkas tidak cocok - berkas, folder, baris, dan fungsi baru dikembalikan"
fi
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
