#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-u3-itsbat-aua" (20 Okt 2026, agen U3). Dijalankan DI SERVER sebagai root, dari folder paket.
# Isi: 14 variabel BARU 4300-4315 (data_sql hanya SELECT + data_teks isian/pilihan majelis) dan 8 blangko BARU:
#   2 Itsbat Nikah            : [01d] Format Lengkap Rukun dan Syarat per Unsur ; [01e] Satu Pemohon (Pasangan Meninggal, Voluntair)
#   8 Asal Usul Anak          : [01a] Perkawinan Siri Dicatat Kemudian ; [01b] Anak Luar Perkawinan Sah ; [01c] Anak Lahir Kurang dari Enam Bulan
#   2 Itsbat Nikah - BAS      : ALUR 11 [1b] dan [1c] (tanya jawab saksi dari katalog)
#   8 Asal Usul Anak - BAS    : ALUR 13 [1b] (tanya jawab saksi dari katalog)
#   Tidak ada baris lama yang diubah, tidak ada berkas lama yang disentuh, abt_menu tidak diubah.
# Urutan: md5 -> PRASYARAT (baca saja) -> CADANGAN (sesudah prasyarat lolos; tidak menimpa cadangan lama) -> PASANG SQL
#         (satu transaksi) -> PERIKSA -> UJI kueri baru atas perkara nyata (baca saja) -> BERKAS -> PERIKSA BERKAS.
#         Gagal sesudah PASANG = PULIH otomatis.
# Laptop: ABT_LOKAL=1 ABT_BLANGKO=<_blangko_abt> SIPP_DB=sipp_donggala [ABT_DB=aps_badilag_uji] bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-u3-itsbat-aua
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
SDB="${SIPP_DB:-SIPP}"
ADB="${ABT_DB:-aps_badilag}"
PY="${PY:-python}"
gagal() { echo "GAGAL: $*"; exit 1; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
for f in $(grep -v '^#' daftar-rtf.tsv | cut -f1 | sort -u | tr ' ' '#'); do
  f=$(echo "$f" | tr '#' ' ')
  [ -d "$B/$f" ] || gagal "folder blangko $B/$f tidak ada"
done
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"

# --- 1. PRASYARAT (baca saja) -------------------------------------------------------------------------------------------
HARAP=$(grep -o 'menjawab [0-9|]*' "$N-PRASYARAT.sql" | head -1 | cut -d' ' -f2)
p=$($MY -N < "$N-PRASYARAT.sql") || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
[ "$p" = "$HARAP" ] || gagal "prasyarat '$p' (harus $HARAP: nomor 4300-4399 kosong | variabel lama yang dipakai ada | variabel isian sumber berjenis data_teks) - TIDAK ada yang diubah"
echo "PRASYARAT COCOK ($p)"

# --- 2. CADANGAN (sesudah prasyarat; tidak pernah menimpa cadangan lama) ------------------------------------------------
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
[ -f "$CAD/abt_variabel-sebelum.sql" ] && mv "$CAD/abt_variabel-sebelum.sql" "$CAD/abt_variabel-sebelum.$(date +%Y%m%d%H%M%S).sql"
mysqldump -h "$H" -u root --default-character-set=latin1 --no-create-info --replace --skip-extended-insert --complete-insert \
  --skip-comments --hex-blob --where="no_var BETWEEN 4300 AND 4399" "$ADB" abt_variabel > "$CAD/abt_variabel-sebelum.sql" \
  || gagal "mysqldump gagal - TIDAK ada yang diubah"
for f in $(grep -v '^#' daftar-rtf.tsv | cut -f1 | sort -u | tr ' ' '#'); do
  f=$(echo "$f" | tr '#' ' ')
  ls -b "$B/$f" > "$CAD/daftar-$(echo "$f" | tr '/ ' '__').txt" 2>&1
done
echo "CADANGAN: $CAD ($(grep -c '^REPLACE' "$CAD/abt_variabel-sebelum.sql") baris lama 4300-4399, harus 0; daftar folder blangko disimpan)"

# --- 3. PASANG SQL + PERIKSA -------------------------------------------------------------------------------------------
$MY < "$N-PASANG.sql" || { $MY < "$N-PULIH.sql"; gagal "$N-PASANG.sql gagal - dipulihkan"; }
$MY < "$N-PERIKSA.sql" | tee "$CAD/periksa-sesudah.txt"
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  $MY < "$N-PULIH.sql"
  gagal "PERIKSA tidak cocok - variabel baru dihapus; berkas belum disentuh"
fi

# --- 4. UJI kueri baru atas perkara nyata (baca saja): itsbat voluntair 2 Pemohon, asal usul anak ----------------------------
SQ="mysql -h $H -u root --default-character-set=latin1 $SDB -N"
JUMLAH=$(grep -vc '^#' uji-kueri.tsv)
for PID in $($SQ -e "SELECT MAX(perkara_id) FROM perkara WHERE jenis_perkara_id=360 AND alur_perkara_id=16; SELECT MAX(perkara_id) FROM perkara WHERE jenis_perkara_id=358" 2>/dev/null | grep -v NULL); do
  if ! sed "s/#perkara_id#/$PID/g" uji-kueri.tsv | awk -F'\t' '!/^#/ && NF==2 {print "SELECT " $1 " AS var, x.data FROM (" $2 ") x;"}' \
       | $SQ > "$CAD/uji-$PID.txt" 2>&1; then
    echo "uji perkara $PID: GALAT $(head -c 300 "$CAD/uji-$PID.txt")"
    $MY < "$N-PULIH.sql"
    gagal "kueri variabel baru tidak jalan di server ini - variabel baru dihapus; berkas belum disentuh. Kirim $CAD/uji-$PID.txt ke pengembang"
  fi
  [ "$(wc -l < "$CAD/uji-$PID.txt")" = "$JUMLAH" ] || { $MY < "$N-PULIH.sql"; gagal "uji perkara $PID tidak menjawab $JUMLAH baris - dipulihkan"; }
  echo "uji perkara $PID: $JUMLAH kueri menjawab"
done

# --- 5. BERKAS RTF BARU ------------------------------------------------------------------------------------------------
$PY berkas_rtf.py pasang "$B" "$SINI/rtf" "$CAD" | tee "$CAD/berkas-pasang.txt"
if [ "${PIPESTATUS[0]}" != "0" ]; then
  $PY berkas_rtf.py pulih "$B" "$CAD"
  $MY < "$N-PULIH.sql"
  gagal "berkas RTF tidak terpasang - berkas & variabel dikembalikan (lihat $CAD/berkas-pasang.txt)"
fi
$PY berkas_rtf.py periksa "$B" "$CAD" | tee "$CAD/berkas-periksa.txt"
if [ "$(tail -1 "$CAD/berkas-periksa.txt")" != "BERKAS COCOK" ]; then
  $PY berkas_rtf.py pulih "$B" "$CAD"
  $MY < "$N-PULIH.sql"
  gagal "periksa berkas tidak cocok - berkas & variabel dikembalikan"
fi
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
