#!/bin/bash
# =============================================================================
# PASANG paket ABT "u5-ahli-waris" di SATKER (dijalankan DI SERVER, sebagai root, dari folder paket ini).
# Urutan: periksa prasyarat -> CADANG -> PASANG variabel -> PERIKSA -> ganti 3 blangko RTF -> periksa md5.
# Bila PERIKSA atau md5 gagal: PULIH otomatis (variabel dihapus, RTF dikembalikan).
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
B=/var/www/html/aps_badilag/_blangko_abt/derry_briantono/"9 Penetapan Ahli Waris"
F01="$B/[01] [Kabul] PAW - Ahli Waris Anak Kandung (Suami-Istri dan Orang Tua Pewaris Telah Meninggal).rtf"
F01B="$B/[01b] [Kabul] PAW - Susunan Ahli Waris Dinamis (Pasangan, Anak, Ayah, Ibu - Pertimbangan Bagian Otomatis).rtf"
F01C="$B/[01c] [Kabul] PAW - Susunan Ahli Waris Lengkap (Cucu Pengganti, Kakek, Nenek, Saudara Seibu - Aul dan Radd Otomatis).rtf"
# md5 blangko SEBELUM (diukur 20 Okt 2026) dan SESUDAH tambal
PRA_01=ed404d72a8f2cb783cd8b897d9730613;  BARU_01=3f9df01692b10bd302dab00de4a2deaf
PRA_01B=9438b0c63a8efef348a454475299f655;  BARU_01B=3a2af6863b04f31bcdcecb171992fc5e
PRA_01C=80930f5537a2ccffb82ae8ceae44c35f;  BARU_01C=2d7de65e88d797c54b2ff6db52c2b762
CAD="$SINI/cadangan"

md5() { md5sum "$1" | cut -d' ' -f1; }
gagal() { echo "GAGAL: $*"; exit 1; }

MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
export MYSQL_PWD
MY="mysql -h 127.0.0.1 -u root --default-character-set=latin1 aps_badilag"

# --- 0. prasyarat berkas paket dan blangko satker -----------------------------
[ "$(md5 rtf/01.rtf)" = "$BARU_01" ] && [ "$(md5 rtf/01b.rtf)" = "$BARU_01B" ] && [ "$(md5 rtf/01c.rtf)" = "$BARU_01C" ] \
  || gagal "berkas rtf/ di paket rusak (md5 berbeda) - salin ulang paket (scp, bukan editor)"
[ "$(md5 "$F01")" = "$PRA_01" ]   || gagal "blangko [01] satker bukan versi yang diukur 20 Okt (md5 $(md5 "$F01")) - TIDAK ada yang diubah (bangun ulang tambalan: lihat PASANG.md)"
[ "$(md5 "$F01B")" = "$PRA_01B" ] || gagal "blangko [01b] satker bukan versi yang diukur 20 Okt (md5 $(md5 "$F01B")) - TIDAK ada yang diubah"
[ "$(md5 "$F01C")" = "$PRA_01C" ] || gagal "blangko [01c] satker bukan versi yang diukur 20 Okt (md5 $(md5 "$F01C")) - TIDAK ada yang diubah"
[ -e "$CAD/rtf-sebelum-01c.rtf" ] && gagal "cadangan lama sudah ada di $CAD - paket ini sudah pernah dijalankan? Periksa dulu, jangan timpa cadangan"
N=$($MY -N -e "SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN 4500 AND 4599")
[ "$N" = "0" ] || gagal "jatah 4500-4599 sudah terpakai ($N baris) - TIDAK ada yang diubah"

# --- 1. CADANG ----------------------------------------------------------------
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
mysqldump -h 127.0.0.1 -u root --default-character-set=latin1 --no-create-info --replace --skip-extended-insert \
  --complete-insert --skip-comments aps_badilag abt_variabel > "$CAD/abt_variabel-seluruhnya-sebelum.sql" || gagal "mysqldump gagal - TIDAK ada yang diubah"
[ -s "$CAD/abt_variabel-seluruhnya-sebelum.sql" ] || gagal "cadangan abt_variabel kosong"
cp -p "$F01" "$CAD/rtf-sebelum-01.rtf" && cp -p "$F01B" "$CAD/rtf-sebelum-01b.rtf" && cp -p "$F01C" "$CAD/rtf-sebelum-01c.rtf" || gagal "salin cadangan RTF gagal"
echo "CADANGAN: $CAD (abt_variabel utuh + 3 RTF)"

# --- 2. PASANG (prasyarat di dalam SQL; gagal = tidak ada yang ditulis) ----------
$MY < abt-u5-PASANG.sql || gagal "abt-u5-PASANG.sql berhenti (lihat galat di atas) - transaksi tidak di-COMMIT, tidak ada yang ditulis"

# --- 3. PERIKSA panjang + MD5 tiap baris ---------------------------------------
$MY < abt-u5-PERIKSA.sql | tee "$CAD/periksa-sesudah.txt"
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  echo "PERIKSA tidak cocok - menghapus variabel baru"
  $MY < abt-u5-PULIH-HAPUS-BARU.sql
  gagal "pemasangan SQL dibatalkan dan dipulihkan; blangko RTF belum disentuh"
fi

# --- 4. GANTI 3 BLANGKO (cat > berkas: pemilik apache:apache dan izin 750 tetap) --
cat rtf/01.rtf > "$F01" && cat rtf/01b.rtf > "$F01B" && cat rtf/01c.rtf > "$F01C"
if [ "$(md5 "$F01")" != "$BARU_01" ] || [ "$(md5 "$F01B")" != "$BARU_01B" ] || [ "$(md5 "$F01C")" != "$BARU_01C" ]; then
  echo "md5 blangko sesudah ganti tidak cocok - memulihkan SEMUA"
  bash "$SINI/pulih-satker.sh"
  gagal "dipulihkan"
fi
ls -l "$F01" "$F01B" "$F01C"
echo "SELESAI - paket u5-ahli-waris terpasang. Cadangan untuk pulih: $CAD"
