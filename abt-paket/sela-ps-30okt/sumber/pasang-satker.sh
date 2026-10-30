#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-sela-ps-30okt" (30 Okt 2026). Dijalankan DI SERVER sebagai root, dari folder paket. HANYA pengguna derry_briantono.
# Isi: 70 variabel baru (11300-11369), 2 menu baru (151 "Putusan Sela ...", 152 "Putusan Sela - BAS"), 22 blangko RTF baru (folder baru
# "97a Putusan Sela" dan "97a Putusan Sela - BAS", BAS pemeriksaan setempat di 4c/4d/4e/10a - BAS) dan 2 blangko DITIMPA (BAS pemeriksaan
# setempat 4a Harta Bersama - BAS dan 4b Kewarisan - BAS; hanya bila md5 persis dasar). Variabel dan menu lama tidak diubah.
# URUTAN PASANG: PALING AKHIR - sesudah prodeo-panggilan-29okt (variabel 11122-11140 dirujuk; PRASYARAT C memeriksanya), bas-tanya-jawab-29okt,
# ket-saksi-kata-30okt, relaas-penetapan-30okt, sampul-rapi-30okt.
# Urutan: md5 -> PRASYARAT SQL + BERKAS (baca saja) -> CADANGAN (sesudah prasyarat lolos; tidak pernah menimpa cadangan lama)
#         -> PASANG SQL (satu transaksi) -> PERIKSA -> UJI kueri baru atas perkara nyata (baca saja) -> FOLDER BARU + BERKAS -> PERIKSA BERKAS.
#         Gagal sesudah PASANG = PULIH otomatis (berkas, folder baru & baris baru dikembalikan).
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_sela30 SIPP_DB=sipp_sela30 ABT_BLANGKO=<_blangko_abt uji> MYSQL_BIN=<folder mysql.exe> PY=python bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-sela-ps-30okt
HARAP="$(sed -n 1p harap.txt | tr -d '\r')"
ULANG="$(sed -n 2p harap.txt | tr -d '\r')"
NOMOR="$(grep -v '^#' nomor-variabel.txt | paste -sd, -)"
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
pulih_sql() { $MY -N < "$N-PULIH.sql"; }

# --- 1. PRASYARAT (baca saja) -------------------------------------------------------------------------------------------
p=$($MY -N < "$N-PRASYARAT.sql") || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
p=$(echo "$p" | tr -d '\r')
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
for T in abt_variabel abt_data_teks abt_menu; do
  [ -f "$CAD/$T-sebelum.sql" ] && mv "$CAD/$T-sebelum.sql" "$CAD/$T-sebelum.$(date +%Y%m%d%H%M%S).sql"
  if [ "$T" = abt_menu ]; then W="id IN (151,152)"; else W="no_var IN ($NOMOR)"; fi
  "${BIN}mysqldump" -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
    --complete-insert --skip-comments --hex-blob --where="$W" "$ADB" "$T" > "$CAD/$T-sebelum.sql" \
    || gagal "mysqldump $T gagal - TIDAK ada yang diubah"
done
echo "CADANGAN: $CAD (variabel bernomor paket: $(grep -c '^REPLACE' "$CAD/abt_variabel-sebelum.sql"); menu 151/152: $(grep -c '^REPLACE' "$CAD/abt_menu-sebelum.sql"))"

# --- 3. PASANG SQL + PERIKSA -------------------------------------------------------------------------------------------
$MY < "$N-PASANG.sql" || { pulih_sql; gagal "$N-PASANG.sql gagal (transaksi tidak di-COMMIT) - dipulihkan"; }
$MY -N < "$N-PERIKSA.sql" | tr -d '\r' > "$CAD/periksa-sesudah.txt"
tail -1 "$CAD/periksa-sesudah.txt" | cut -f1
if [ "$(tail -1 "$CAD/periksa-sesudah.txt" | cut -f1)" != "SEMUA COCOK" ]; then
  head -20 "$CAD/periksa-sesudah.txt"
  pulih_sql
  gagal "PERIKSA tidak cocok - baris baru dihapus; berkas belum disentuh"
fi

# --- 4. UJI kueri baru atas perkara nyata (baca saja; perkara dipilih dari SIPP sendiri: putusan sela terbaru + perkara terbaru) ---
SQ="${BIN}mysql -h $H -u root --default-character-set=latin1 $SDB -N"
NU=$(awk -F'\t' '!/^#/ && NF==2' uji-kueri.tsv | wc -l | tr -d ' ')
PIDS=$($SQ -e "SELECT perkara_id FROM (SELECT perkara_id FROM perkara_putusan_sela ORDER BY putusansela_id DESC LIMIT 4) a UNION SELECT MAX(perkara_id) FROM perkara UNION SELECT MAX(perkara_id) FROM perkara WHERE alur_perkara_id = 16" 2>/dev/null | tr -d '\r' | grep -v NULL | sort -u)
[ -n "$PIDS" ] || { pulih_sql; gagal "perkara uji tidak terbaca dari $SDB - dipulihkan"; }
for PID in $PIDS; do
  if ! sed "s/#perkara_id#/$PID/g; s/aps_badilag\./$ADB./g" uji-kueri.tsv | awk -F'\t' '!/^#/ && NF==2 {print "SELECT " $1 " AS var, LEFT(REPLACE(IFNULL((SELECT x.data FROM (" $2 ") x LIMIT 1), \"(kosong)\"), CHAR(10), \" \"), 150) AS data;"}' \
       | $SQ > "$CAD/uji-$PID.txt" 2>&1; then
    echo "uji perkara $PID: GALAT $(head -c 300 "$CAD/uji-$PID.txt")"
    pulih_sql
    gagal "kueri variabel baru tidak jalan di server ini - baris baru dihapus; berkas belum disentuh. Kirim $CAD/uji-$PID.txt ke pengembang"
  fi
  [ "$(grep -c . "$CAD/uji-$PID.txt")" = "$NU" ] || { pulih_sql; gagal "uji perkara $PID tidak menjawab $NU baris - dipulihkan"; }
  echo "uji perkara $PID: $NU kueri COCOK"
done

# --- 5. FOLDER BARU + BERKAS RTF ---------------------------------------------------------------------------------------
: > "$CAD/folder-dibuat.txt"
while IFS= read -r f; do
  [ -d "$B/$f" ] && { echo "FOLDER SUDAH ADA $f"; continue; }
  if mkdir "$B/$f"; then
    echo "$f" >> "$CAD/folder-dibuat.txt"; echo "FOLDER BARU $f"
    st=$(stat -c '%u:%g' "$(dirname "$B/$f")" 2>/dev/null) && chown "$st" "$B/$f" 2>/dev/null; chmod "$(stat -c %a "$(dirname "$B/$f")" 2>/dev/null || echo 755)" "$B/$f" 2>/dev/null
  else
    pulih_sql; gagal "folder $f tidak bisa dibuat - baris baru dihapus"
  fi
done < <(grep -v '^#' folder-baru.txt)
hapus_folder_baru() { while IFS= read -r f; do rmdir "$B/$f" 2>/dev/null; done < "$CAD/folder-dibuat.txt"; }
$PY berkas_rtf.py pasang "$B" "$SINI" "$CAD" | tee "$CAD/berkas-pasang.txt"
if [ "${PIPESTATUS[0]}" != "0" ]; then
  $PY berkas_rtf.py pulih "$B" "$CAD"; hapus_folder_baru
  pulih_sql
  gagal "berkas RTF tidak terpasang - berkas, folder & baris baru dikembalikan (lihat $CAD/berkas-pasang.txt)"
fi
$PY berkas_rtf.py periksa "$B" "$CAD" | tee "$CAD/berkas-periksa.txt"
if [ "$(tail -1 "$CAD/berkas-periksa.txt" | tr -d '\r')" != "BERKAS COCOK" ]; then
  $PY berkas_rtf.py pulih "$B" "$CAD"; hapus_folder_baru
  pulih_sql
  gagal "periksa berkas tidak cocok - berkas, folder & baris baru dikembalikan"
fi
if grep -ril "aleta" "$B/derry_briantono/97a Putusan Sela" "$B/derry_briantono/97a Putusan Sela - BAS" >/dev/null 2>&1; then
  echo "PERINGATAN: kata nama aplikasi ditemukan di folder baru"
else
  echo "TANPA KATA NAMA APLIKASI"
fi
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
