#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-u4-dk-wali-perwalian" (20 Okt 2026, agen U4). Dijalankan DI SERVER sebagai root, dari folder paket.
# Isi: 24 variabel baru 4400-4442; blangko BARU: Perwalian oleh kerabat, DK alasan otomatis, DK dua keluarga; 12 blangko lama diperbarui (penjaga md5, cadangan utuh).
# Paket yang harus terpasang lebih dulu: abt-wali-adhal dan paket DK/Perwalian/Wali Adhal terbaru (md5 berkas lama dicek per berkas; beda = GAGAL tanpa mengubah apa pun).
# Urutan: md5 -> PRASYARAT SQL + BERKAS (baca saja) -> CADANGAN (sesudah prasyarat lolos; tidak pernah menimpa cadangan lama)
#         -> PASANG SQL (satu transaksi) -> PERIKSA -> UJI kueri baru atas perkara nyata (baca saja) -> BERKAS (baru + sunting potongan)
#         -> PERIKSA BERKAS. Gagal sesudah PASANG = PULIH otomatis (berkas, folder baru & baris baru dikembalikan).
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_u4 ABT_BLANGKO=<_blangko_abt uji> SIPP_DB=sipp_donggala bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-u4-dk-wali-perwalian
HARAP='0|0|130|0|0'
ULANG='0|24|130|0|0'
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
SDB="${SIPP_DB:-SIPP}"
ADB="${ABT_DB:-aps_badilag}"
PY="${PY:-python}"
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
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"

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
for T in abt_variabel abt_data_teks abt_data_tanggal abt_menu; do
  [ -f "$CAD/$T-sebelum.sql" ] && mv "$CAD/$T-sebelum.sql" "$CAD/$T-sebelum.$(date +%Y%m%d%H%M%S).sql"
  if [ "$T" = abt_menu ]; then W="id IN (0)"; else W="no_var IN (4400,4401,4402,4403,4404,4405,4406,4407,4409,4410,4411,4412,4420,4421,4422,4423,4424,4425,4426,4427,4428,4440,4441,4442)"; fi
  mysqldump -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
    --complete-insert --skip-comments --hex-blob --where="$W" "$ADB" "$T" > "$CAD/$T-sebelum.sql" \
    || gagal "mysqldump $T gagal - TIDAK ada yang diubah"
done
echo "CADANGAN: $CAD (variabel lama bernomor baru: $(grep -c '^REPLACE' "$CAD/abt_variabel-sebelum.sql"); menu: $(grep -c '^REPLACE' "$CAD/abt_menu-sebelum.sql"))"

# --- 3. PASANG SQL + PERIKSA -------------------------------------------------------------------------------------------
$MY < "$N-PASANG.sql" || { $MY -N < "$N-PULIH.sql"; gagal "$N-PASANG.sql gagal (transaksi tidak di-COMMIT) - dipulihkan"; }
$MY -N < "$N-PERIKSA.sql" > "$CAD/periksa-sesudah.txt"
tail -1 "$CAD/periksa-sesudah.txt"
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  grep -v '	1$' "$CAD/periksa-sesudah.txt"
  $MY -N < "$N-PULIH.sql"
  gagal "PERIKSA tidak cocok - baris baru dihapus; berkas belum disentuh"
fi

# --- 4. UJI kueri baru atas perkara nyata (baca saja) ------------------------------------------------------------------
SQ="mysql -h $H -u root --default-character-set=latin1 $SDB -N"
NU=$(awk -F'\t' '!/^#/ && NF==2' uji-kueri.tsv | wc -l | tr -d ' ')
if [ "$NU" != 0 ]; then
for PID in $($SQ -e "SELECT perkara_id FROM perkara WHERE nomor_perkara IN ('61/Pdt.P/2026/PA.Dgl','85/Pdt.P/2026/PA.Dgl','173/Pdt.P/2026/PA.Dgl','27/Pdt.P/2025/PA.Dgl','21/Pdt.P/2025/PA.Dgl','224/Pdt.P/2026/PA.Dgl')" 2>/dev/null | grep -v NULL | sort -u); do
  if ! sed "s/#perkara_id#/$PID/g" uji-kueri.tsv | awk -F'\t' '!/^#/ && NF==2 {print "SELECT " $1 " AS var, LEFT(REPLACE(IFNULL((SELECT x.data FROM (" $2 ") x LIMIT 1), \"(kosong)\"), CHAR(10), \" \"), 150) AS data;"}' \
       | $SQ > "$CAD/uji-$PID.txt" 2>&1; then
    echo "uji perkara $PID: GALAT $(head -c 300 "$CAD/uji-$PID.txt")"
    $MY -N < "$N-PULIH.sql"
    gagal "kueri variabel baru tidak jalan di server ini - baris baru dihapus; berkas belum disentuh. Kirim $CAD/uji-$PID.txt ke pengembang"
  fi
  [ "$(grep -c . "$CAD/uji-$PID.txt")" = "$NU" ] || { $MY -N < "$N-PULIH.sql"; gagal "uji perkara $PID tidak menjawab $NU baris - dipulihkan"; }
  cut -c1-170 "$CAD/uji-$PID.txt" | sed "s/^/uji perkara $PID: /"
done
fi

# --- 5. FOLDER BARU + BERKAS RTF ---------------------------------------------------------------------------------------
: > "$CAD/folder-dibuat.txt"
while IFS= read -r f; do
  [ -d "$B/$f" ] && { echo "FOLDER SUDAH ADA $f"; continue; }
  if mkdir "$B/$f"; then
    echo "$f" >> "$CAD/folder-dibuat.txt"; echo "FOLDER BARU $f"
    st=$(stat -c '%u:%g' "$(dirname "$B/$f")" 2>/dev/null) && chown "$st" "$B/$f" 2>/dev/null; chmod 755 "$B/$f"
  else
    $MY -N < "$N-PULIH.sql"; gagal "folder $f tidak bisa dibuat - baris baru dihapus"
  fi
done < <(grep -v '^#' folder-baru.txt)
hapus_folder_baru() { while IFS= read -r f; do rmdir "$B/$f" 2>/dev/null; done < "$CAD/folder-dibuat.txt"; }
$PY berkas_rtf.py pasang "$B" "$SINI" "$CAD" | tee "$CAD/berkas-pasang.txt"
if [ "${PIPESTATUS[0]}" != "0" ]; then
  $PY berkas_rtf.py pulih "$B" "$CAD"; hapus_folder_baru
  $MY -N < "$N-PULIH.sql"
  gagal "berkas RTF tidak terpasang - berkas, folder & baris baru dikembalikan (lihat $CAD/berkas-pasang.txt)"
fi
$PY berkas_rtf.py periksa "$B" "$CAD" | tee "$CAD/berkas-periksa.txt"
if [ "$(tail -1 "$CAD/berkas-periksa.txt")" != "BERKAS COCOK" ]; then
  $PY berkas_rtf.py pulih "$B" "$CAD"; hapus_folder_baru
  $MY -N < "$N-PULIH.sql"
  gagal "periksa berkas tidak cocok - berkas, folder & baris baru dikembalikan"
fi
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
