#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-x7-bersih-penutup-21okt" (21 Okt 2026). Dijalankan DI SERVER sebagai root, dari folder paket.
# Isi: (1) hapus dari aps_badilag.abt_keterangan_saksi baris yang jawabannya SELURUHNYA kalimat penutup (isian_rtf_penutup, paket x6)
#      untuk perkara BELUM minutasi saja (SIPP.perkara proses_terakhir_id < 220 dan tanpa perkara_proses 220); baris keterangan perkara
#      dan perkara yang sudah minutasi TIDAK disentuh; (2) isian_rtf_keterangan (jawaban lisan) memakai penyaring yang sama.
# PRASYARAT: paket x6 sudah terpasang. Cadangan LENGKAP baris yang dihapus (INSERT IGNORE persis) di cadangan/baris-dihapus.sql.
# Urutan: md5 -> PRASYARAT -> HITUNG -> CADANGAN -> FUNGSI -> HAPUS -> PERIKSA -> HITUNG sesudah. Gagal sesudah CADANGAN = PULIH otomatis.
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_x7 SIPP_DB=sipp_x7 bash pasang-satker.sh   (nama basis di berkas SQL disesuaikan otomatis)
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-x7-bersih-penutup-21okt
CAD="$SINI/cadangan"
ADB="${ABT_DB:-aps_badilag}"
gagal() { echo "GAGAL: $*"; exit 1; }
pulih() { echo "... memulihkan"; bash "$SINI/pulih-satker.sh" 2>&1 | tail -6; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
  export MYSQL_PWD
fi
SIPPDB="${SIPP_DB:-}"
if [ -z "$SIPPDB" ]; then SIPPDB="$(docker exec aleta-bot sh -lc 'printf "%s" "$ALETA_BOT_DB_SIPP_NAME"')" || gagal "nama basis SIPP tak terbaca dari aleta-bot"; fi
[ -n "$SIPPDB" ] || gagal "nama basis SIPP kosong"
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
myn() { $MY -N "$@" | tr -d '\r'; }   # klien mysql Windows menulis CRLF; di Linux tr tidak mengubah apa pun
# berkas SQL memakai nama basis aps_badilag dan penanda __SIPP__; disesuaikan di sini
sqlf() { if [ "$ADB" = aps_badilag ]; then sed "s/__SIPP__/$SIPPDB/g" "$1"; else sed -e "s/__SIPP__/$SIPPDB/g" -e "s/aps_badilag\./$ADB./g" "$1"; fi; }
set -o pipefail
rdr() { sqlf "$N-$1.sql" | $MY -N | tr -d '\r'; }

# --- 1. PRASYARAT (baca saja) -------------------------------------------------------------------------------------------
p=$(rdr PRASYARAT) || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
echo "PRASYARAT ($p)  [x6-terpasang|fungsi-penutup|tabel-SIPP|keterangan-lama|keterangan-baru]"
MODE=
if [ "$p" = "1|1|2|1|0" ]; then MODE=BARU
elif [ "$p" = "1|1|2|0|1" ]; then MODE=ULANG
else gagal "prasyarat tidak cocok (harus 1|1|2|1|0; 1|1|2|0|1 pada pasang ulang). Pasang paket x6 (abt-x6-penutup-saksi-21okt) lebih dulu; isian_rtf_keterangan harus versi I3 - TIDAK ada yang diubah."; fi
echo "MODE $MODE (SIPP=$SIPPDB)"
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
CAP=$(date +%Y%m%d%H%M%S)

# --- 2. HITUNG sebelum ----------------------------------------------------------------------------------------------------
HS=$(rdr HITUNG) || gagal "HITUNG tak terbaca - TIDAK ada yang diubah"
T0=$(echo "$HS" | cut -d'|' -f1); R0=$(echo "$HS" | cut -d'|' -f2); C0=$(echo "$HS" | cut -d'|' -f3)
UBAH=0; if [ "$MODE" = BARU ] || [ "$C0" != 0 ]; then UBAH=1; fi
echo "SEBELUM: seluruh baris=$T0; baris di perkara belum minutasi=$R0; baris penutup yang dihapus=$C0"

if [ "$MODE" = BARU ] || [ "$C0" != 0 ]; then
  # --- 3. CADANGAN (tidak pernah menimpa cadangan lama) ----------------------------------------------------------------
  for f in baris-dihapus.sql id-hapus.txt per-perkara-sebelum.tsv per-perkara-sesudah.tsv md5-ket-sebelum.txt md5-ket-sesudah.txt fungsi-sebelum.sql hitung-sebelum.txt hitung-sesudah.txt periksa-sesudah.txt; do
    [ -f "$CAD/$f" ] && mv "$CAD/$f" "$CAD/$f.$CAP"
  done
  echo "$HS" > "$CAD/hitung-sebelum.txt"
  mysqldump -h "$H" -u root --default-character-set=latin1 --routines --no-create-info --no-data --skip-triggers --skip-comments "$ADB" > "$CAD/fungsi-sebelum.sql" \
    || gagal "cadangan fungsi DB gagal - TIDAK ada yang diubah"
  grep -q 'FUNCTION `isian_rtf_keterangan`' "$CAD/fungsi-sebelum.sql" || gagal "cadangan fungsi tidak memuat isian_rtf_keterangan - TIDAK ada yang diubah"
  myn -e "SELECT MD5(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_')) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='isian_rtf_keterangan'" > "$CAD/md5-ket-sebelum.txt"
  rdr DAFTAR > "$CAD/id-hapus.txt" || gagal "DAFTAR tak terbaca - TIDAK ada yang diubah"
  NID=$(grep -c . "$CAD/id-hapus.txt")
  [ "$NID" = "$C0" ] || gagal "daftar id ($NID) tidak sama dengan HITUNG ($C0) - TIDAK ada yang diubah"
  rdr PERKARA > "$CAD/per-perkara-sebelum.tsv" || gagal "PERKARA tak terbaca - TIDAK ada yang diubah"
  if [ "$NID" -gt 0 ]; then
    IDS=$(paste -sd, "$CAD/id-hapus.txt")
    mysqldump -h "$H" -u root --default-character-set=latin1 --no-create-info --insert-ignore --skip-extended-insert --complete-insert --skip-comments --skip-triggers \
      --where="id IN ($IDS)" "$ADB" abt_keterangan_saksi > "$CAD/baris-dihapus.sql" || gagal "cadangan baris gagal - TIDAK ada yang diubah"
    NCAD=$(grep -c '^INSERT' "$CAD/baris-dihapus.sql")
    [ "$NCAD" = "$NID" ] || gagal "cadangan baris ($NCAD) tidak sama dengan daftar ($NID) - TIDAK ada yang diubah"
  else
    : > "$CAD/baris-dihapus.sql"
  fi
  echo "CADANGAN: $CAD (baris dihapus tercadang: $NID; perkara: $(($(grep -c . "$CAD/per-perkara-sebelum.tsv"))))"

  # --- 4. FUNGSI (jawaban lisan) ---------------------------------------------------------------------------------------
  if [ "$MODE" = BARU ]; then
    sqlf "$N-FUNGSI.sql" | $MY > "$CAD/fungsi-pasang.log" 2>&1 || { tail -5 "$CAD/fungsi-pasang.log"; pulih; gagal "isian_rtf_keterangan tidak bisa dibuat - dipulihkan"; }
    myn -e "SELECT MD5(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_')) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='isian_rtf_keterangan'" > "$CAD/md5-ket-sesudah.txt"
  fi

  # --- 5. HAPUS (hanya id di daftar, dan hanya bila masih memenuhi syarat) -------------------------------------------------
  if [ "$NID" -gt 0 ]; then
    IDS=$(paste -sd, "$CAD/id-hapus.txt")
    DIH=$(sqlf "$N-HAPUS.sql" | sed "s/__IDS__/$IDS/" | $MY -N | tr -d '\r' | tail -1)
    echo "HAPUS: $DIH baris dihapus (diharapkan $NID)"
    [ "$DIH" = "$NID" ] || { pulih; gagal "baris terhapus ($DIH) tidak sama dengan daftar ($NID) - dipulihkan"; }
  fi
else
  echo "SUDAH bersih (tidak ada baris penutup di perkara belum minutasi) - hanya PERIKSA ulang"
fi

# --- 6. PERIKSA ----------------------------------------------------------------------------------------------------------------
rdr PERIKSA > "$CAD/periksa-sesudah.txt" 2>&1
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  grep -v '	1$' "$CAD/periksa-sesudah.txt" | head -20
  [ "$UBAH" = 1 ] && pulih
  gagal "PERIKSA tidak cocok$([ "$UBAH" = 1 ] && echo ' - dipulihkan')"
fi
echo "PERIKSA: $(grep -c '	1$' "$CAD/periksa-sesudah.txt") butir cocok - SEMUA COCOK"

# --- 7. HITUNG sesudah: T-C | R-C | 0 ------------------------------------------------------------------------------------------
HA=$(rdr HITUNG) || gagal "HITUNG sesudah tak terbaca"
echo "$HA" > "$CAD/hitung-sesudah.txt"
T1=$(echo "$HA" | cut -d'|' -f1); R1=$(echo "$HA" | cut -d'|' -f2); C1=$(echo "$HA" | cut -d'|' -f3)
if [ "$MODE" = BARU ] || [ "$C0" != 0 ]; then
  if [ "$T1" != "$((T0 - C0))" ] || [ "$R1" != "$((R0 - C0))" ] || [ "$C1" != 0 ]; then
    pulih; gagal "HITUNG sesudah ($HA) tidak sama dengan harapan ($((T0 - C0))|$((R0 - C0))|0) - dipulihkan"
  fi
  if [ -s "$CAD/per-perkara-sebelum.tsv" ]; then
    PL=$(cut -f1 "$CAD/per-perkara-sebelum.tsv" | paste -sd,)
    $MY -N -e "SELECT perkara_id, COUNT(*) FROM abt_keterangan_saksi WHERE perkara_id IN ($PL) GROUP BY perkara_id ORDER BY perkara_id" | tr -d '\r' > "$CAD/per-perkara-sesudah.tsv"
  fi
fi
echo "SESUDAH: seluruh baris=$T1; baris di perkara belum minutasi=$R1; baris penutup=$C1"
echo "PER PERKARA (perkara_id, baris sebelum, baris penutup, baris sesudah): $CAD/per-perkara-sebelum.tsv / per-perkara-sesudah.tsv"
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
