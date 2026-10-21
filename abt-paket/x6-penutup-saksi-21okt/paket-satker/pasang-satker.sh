#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-x6-penutup-saksi-21okt" (21 Okt 2026). Dijalankan DI SERVER sebagai root, dari folder paket. HANYA basis ABT (aps_badilag): tiga fungsi
# tersimpan (isian_rtf_penutup, isian_rtf_saring_penutup baru; isian_rtf_ket_saksi diganti). Tidak menyentuh abt_variabel, blangko (RTF), menu,
# isian tersimpan per perkara, abt_keterangan_saksi, atau SIPP. Variabel 9259-9265 tetap memanggil isian_rtf_ket_saksi (nama sama).
# Urutan: md5 -> PRASYARAT (baca saja) -> HITUNG sebelum -> CADANGAN -> FUNGSI -> PERIKSA -> HITUNG sesudah (harus 0).
#         Gagal sesudah FUNGSI = PULIH otomatis (fungsi lama dikembalikan dari fungsi-lama.sql).
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_x6 bash pasang-satker.sh   (nama basis di berkas SQL disesuaikan otomatis)
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-x6-penutup-saksi-21okt
CAD="$SINI/cadangan"
ADB="${ABT_DB:-aps_badilag}"
gagal() { echo "GAGAL: $*"; exit 1; }
pulih() { echo "... memulihkan"; bash "$SINI/pulih-satker.sh" 2>&1 | tail -4; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
myn() { $MY -N "$@" | tr -d '\r'; }   # klien mysql Windows menulis CRLF; di Linux tr tidak mengubah apa pun
# berkas SQL memakai nama basis aps_badilag; di basis uji laptop diganti nama basis ujinya
sqlf() { if [ "$ADB" = aps_badilag ]; then cat "$1"; else sed "s/aps_badilag\./$ADB./g" "$1"; fi; }
set -o pipefail

# --- 1. PRASYARAT (baca saja) -------------------------------------------------------------------------------------------
p=$(myn < "$N-PRASYARAT.sql") || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
inti=$(echo "$p" | cut -d'|' -f1-4)
echo "PRASYARAT ($p)  [ket_saksi|fungsi-baru|versi-lama|versi-baru|variabel-pemanggil|fungsi-isian_rtf]"
MODE=
if [ "$inti" = "1|0|1|0" ]; then MODE=BARU
elif [ "$inti" = "1|2|0|1" ]; then MODE=ULANG
else gagal "prasyarat tidak cocok (harus 1|0|1|0; 1|2|0|1 pada pasang ulang): isian_rtf_ket_saksi bukan versi paket I3 yang diharapkan atau sudah diubah - TIDAK ada yang diubah."; fi
echo "MODE $MODE"
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
CAP=$(date +%Y%m%d%H%M%S)

if [ "$MODE" = BARU ]; then
  # --- 2. CADANGAN (tidak pernah menimpa cadangan lama) -----------------------------------------------------------------
  for f in fungsi-sebelum.sql md5-sebelum.txt md5-sesudah.txt hitung-sebelum.txt hitung-sesudah.txt periksa-sesudah.txt; do
    [ -f "$CAD/$f" ] && mv "$CAD/$f" "$CAD/$f.$CAP"
  done
  mysqldump -h "$H" -u root --default-character-set=latin1 --routines --no-create-info --no-data --skip-triggers --skip-comments \
    "$ADB" > "$CAD/fungsi-sebelum.sql" || gagal "cadangan fungsi DB gagal - TIDAK ada yang diubah"
  grep -q 'FUNCTION `isian_rtf_ket_saksi`' "$CAD/fungsi-sebelum.sql" || gagal "cadangan fungsi tidak memuat isian_rtf_ket_saksi - TIDAK ada yang diubah"
  myn -e "SELECT MD5(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_')) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='isian_rtf_ket_saksi'" > "$CAD/md5-sebelum.txt"
  HS=$(myn < "$N-HITUNG.sql") || gagal "HITUNG sebelum tak terbaca - TIDAK ada yang diubah"
  echo "$HS" > "$CAD/hitung-sebelum.txt"
  echo "CADANGAN: $CAD (fungsi: $(grep -c 'FUNCTION `' "$CAD/fungsi-sebelum.sql"); md5 lama: $(cat "$CAD/md5-sebelum.txt"))"
  echo "SEBELUM: $HS kelompok saksi mencetak butir kalimat penutup"

  # --- 3. FUNGSI -----------------------------------------------------------------------------------------------------------
  sqlf "$N-FUNGSI.sql" | $MY > "$CAD/fungsi-pasang.log" 2>&1 || { tail -5 "$CAD/fungsi-pasang.log"; pulih; gagal "fungsi tidak bisa dibuat - dipulihkan"; }
  myn -e "SELECT MD5(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_')) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='isian_rtf_ket_saksi'" > "$CAD/md5-sesudah.txt"
else
  echo "SUDAH terpasang - hanya PERIKSA ulang"
fi

# --- 4. PERIKSA ----------------------------------------------------------------------------------------------------------------
myn < "$N-PERIKSA.sql" > "$CAD/periksa-sesudah.txt" 2>&1
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  grep -v '	1$' "$CAD/periksa-sesudah.txt" | head -20
  [ "$MODE" = BARU ] && pulih
  gagal "PERIKSA tidak cocok$([ "$MODE" = BARU ] && echo ' - fungsi dikembalikan')"
fi
echo "PERIKSA: $(grep -c '	1$' "$CAD/periksa-sesudah.txt") butir cocok - SEMUA COCOK"

# --- 5. HITUNG sesudah (harus 0) ---------------------------------------------------------------------------------------------
HA=$(myn < "$N-HITUNG.sql") || gagal "HITUNG sesudah tak terbaca"
echo "$HA" > "$CAD/hitung-sesudah.txt"
if [ "$HA" != 0 ]; then
  [ "$MODE" = BARU ] && pulih
  gagal "HITUNG sesudah = $HA (harus 0)$([ "$MODE" = BARU ] && echo ' - fungsi dikembalikan')"
fi
echo "SESUDAH: $HA kelompok saksi mencetak butir kalimat penutup"
FB=$(myn -e "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name LIKE 'isian\\_rtf\\_%'")
echo "FUNGSI isian_rtf_*: $FB"
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
