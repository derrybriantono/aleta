#!/bin/bash
# =============================================================================
# PASANG paket ABT "w2a-kebendaan" di SATKER (dijalankan DI SERVER, sebagai root, dari folder paket ini).
# Urutan: periksa berkas paket -> periksa md5 SEMUA blangko satker -> periksa jatah nomor -> CADANG -> PASANG variabel -> PERIKSA -> ganti blangko RTF -> periksa md5.
# Bila PERIKSA atau md5 gagal: PULIH otomatis (variabel dihapus, RTF dikembalikan dari cadangan).
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
DASAR=/var/www/html/aps_badilag/_blangko_abt/derry_briantono
CAD="$SINI/cadangan"
TAB=$(printf '\t')
md5() { md5sum "$1" | cut -d' ' -f1; }
gagal() { echo "GAGAL: $*"; exit 1; }

MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
export MYSQL_PWD
MY="mysql -h 127.0.0.1 -u root --default-character-set=latin1 aps_badilag"

# --- 0. berkas paket utuh -------------------------------------------------------
md5sum -c MD5SUMS.txt > /tmp/w2a-md5.txt 2>&1 || { cat /tmp/w2a-md5.txt | grep -v ': OK$' | head; gagal "berkas paket rusak (md5 berbeda) - salin ulang paket (scp, bukan editor)"; }
[ -e "$CAD/DAFTAR-SUDAH" ] && gagal "cadangan lama sudah ada di $CAD - paket ini sudah pernah dijalankan? Periksa dulu, jangan timpa cadangan"

# --- 1. md5 blangko satker harus sama dengan yang diukur 21 Okt (semua atau tidak sama sekali) ---
SALAH=0
while IFS="$TAB" read -r NN FOLDER BERKAS PRA BARU; do
  [ -z "$NN" ] && continue
  F="$DASAR/$FOLDER/$BERKAS"
  [ -f "$F" ] || { echo "TIDAK ADA: $FOLDER/$BERKAS"; SALAH=1; continue; }
  [ "$(md5 "$F")" = "$PRA" ] || { echo "BERBEDA dari yang diukur 21 Okt: $FOLDER/$BERKAS (md5 $(md5 "$F"))"; SALAH=1; }
  [ "$(md5 "rtf/$NN.rtf")" = "$BARU" ] || { echo "RUSAK di paket: rtf/$NN.rtf"; SALAH=1; }
done < DAFTAR-BLANGKO.tsv
[ "$SALAH" = "0" ] || gagal "ada blangko satker yang bukan versi terukur (atau berkas paket rusak) - TIDAK ada yang diubah (bangun ulang tambalan: lihat PASANG.md)"

N=$($MY -N -e "SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN 4780 AND 4849")
[ "$N" = "0" ] || gagal "jatah 4780-4849 sudah terpakai ($N baris) - TIDAK ada yang diubah"

# --- 2. CADANG ----------------------------------------------------------------
mkdir -p "$CAD/rtf" || gagal "tidak bisa membuat $CAD"
mysqldump -h 127.0.0.1 -u root --default-character-set=latin1 --no-create-info --replace --skip-extended-insert \
  --complete-insert --skip-comments aps_badilag abt_variabel > "$CAD/abt_variabel-seluruhnya-sebelum.sql" || gagal "mysqldump gagal - TIDAK ada yang diubah"
[ -s "$CAD/abt_variabel-seluruhnya-sebelum.sql" ] || gagal "cadangan abt_variabel kosong"
while IFS="$TAB" read -r NN FOLDER BERKAS PRA BARU; do
  [ -z "$NN" ] && continue
  cp -p "$DASAR/$FOLDER/$BERKAS" "$CAD/rtf/$NN.rtf" || gagal "salin cadangan RTF gagal: $FOLDER/$BERKAS"
done < DAFTAR-BLANGKO.tsv
cp DAFTAR-BLANGKO.tsv "$CAD/DAFTAR-SUDAH"
echo "CADANGAN: $CAD (abt_variabel utuh + semua blangko)"

# --- 3. PASANG (prasyarat di dalam SQL; gagal = tidak ada yang ditulis) ----------
$MY < abt-w2a-PASANG.sql || { rm -f "$CAD/DAFTAR-SUDAH"; gagal "abt-w2a-PASANG.sql berhenti (lihat galat di atas) - transaksi tidak di-COMMIT, tidak ada yang ditulis"; }

# --- 4. PERIKSA panjang + MD5 tiap baris ---------------------------------------
$MY < abt-w2a-PERIKSA.sql | tee "$CAD/periksa-sesudah.txt"
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  echo "PERIKSA tidak cocok - menghapus variabel baru"
  $MY < abt-w2a-PULIH-HAPUS-BARU.sql
  rm -f "$CAD/DAFTAR-SUDAH"
  gagal "pemasangan SQL dibatalkan dan dipulihkan; blangko RTF belum disentuh"
fi

# --- 5. GANTI BLANGKO (cat > berkas: pemilik apache:apache dan izin tetap) --------
SALAH=0
while IFS="$TAB" read -r NN FOLDER BERKAS PRA BARU; do
  [ -z "$NN" ] && continue
  F="$DASAR/$FOLDER/$BERKAS"
  cat "rtf/$NN.rtf" > "$F"
  [ "$(md5 "$F")" = "$BARU" ] || { echo "md5 sesudah ganti tidak cocok: $FOLDER/$BERKAS"; SALAH=1; }
done < DAFTAR-BLANGKO.tsv
if [ "$SALAH" != "0" ]; then
  echo "md5 blangko sesudah ganti tidak cocok - memulihkan SEMUA"
  bash "$SINI/pulih-satker.sh"
  gagal "dipulihkan"
fi
echo "SELESAI - paket w2a-kebendaan terpasang ($(grep -c . DAFTAR-BLANGKO.tsv) blangko, 68 variabel). Cadangan untuk pulih: $CAD"
