#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-x11-tepi-pkuasa-21okt" (21 Okt 2026). Dijalankan DI SERVER sebagai root, dari folder paket. Prasyarat: paket x6 dan x7 terpasang.
# (a) hapus dari aps_badilag.abt_keterangan_saksi baris yang jawabannya SELURUHNYA kalimat penutup pada perkara TANPA catatan Minutasi (proses 220) yang
#     x7 lewati (proses terakhir 293/296); cadangan baris lengkap di cadangan/baris-dihapus.sql; baris keterangan perkara & perkara berminutasi tidak disentuh.
# (c) dua BAS non-Derry "P (Kuasa)" (berita_acara_sidang/1 BAS Pertama Standar/01-b dan 01-c): "#0184#" (kedua, sebenarnya tgl register) -> "#0111#"
#     (izin pengguna "boleh, asal pakai kuasa"); md5 sebelum/sesudah dikunci di rtf-md5.txt; cadangan berkas di cadangan/rtf/.
# Urutan: md5 -> PRASYARAT -> praperiksa berkas (md5 persis, tulis TIDAK) -> HITUNG -> CADANGAN -> HAPUS -> RTF -> PERIKSA -> HITUNG sesudah.
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_x11 SIPP_DB=sipp_x11 ABT_BLANGKO=<salinan _blangko_abt> bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-x11-tepi-pkuasa-21okt
CAD="$SINI/cadangan"
ADB="${ABT_DB:-aps_badilag}"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
D="$B/berita_acara_sidang/1 BAS Pertama Standar"
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
myn() { $MY -N "$@" | tr -d '\r'; }
sqlf() { if [ "$ADB" = aps_badilag ]; then sed "s/__SIPP__/$SIPPDB/g" "$1"; else sed -e "s/__SIPP__/$SIPPDB/g" -e "s/aps_badilag\./$ADB./g" "$1"; fi; }
set -o pipefail
rdr() { sqlf "$N-$1.sql" | $MY -N | tr -d '\r'; }
m5() { md5sum "$1" | cut -c1-32; }
sesudah_dari() { awk -v m="$1" '$1==m {print $2; exit}' rtf-md5.txt; }
sebelum_dari() { awk -v m="$1" '$2==m {print $1; exit}' rtf-md5.txt; }

# --- 1. PRASYARAT (baca saja) -------------------------------------------------------------------------------------------
p=$(rdr PRASYARAT) || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
echo "PRASYARAT ($p)  [x6-terpasang|fungsi-penutup|tabel-SIPP|x7-terpasang]"
[ "$p" = "1|1|2|1" ] || gagal "prasyarat tidak cocok (harus 1|1|2|1): pasang paket x6 dan x7 lebih dulu - TIDAK ada yang diubah."

# --- 2. praperiksa berkas RTF (tidak menulis) -----------------------------------------------------------------------------------
[ -d "$D" ] || gagal "folder blangko tak ada: $D - TIDAK ada yang diubah"
RTFBARU=0; RTFSUDAH=0; DAFTARRTF="$CAD/rtf-daftar.tmp"
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
: > "$DAFTARRTF"
while IFS= read -r f; do
  [ -n "$f" ] || continue
  mm=$(m5 "$f"); j0=$(grep -a -o '#0184#' "$f" | wc -l); j7=$(grep -a -o '#0207#' "$f" | wc -l); j1=$(grep -a -o '#0111#' "$f" | wc -l)
  if [ -n "$(sesudah_dari "$mm")" ] && [ "$j0" = 1 ] && [ "$j7" = 1 ] && [ "$j1" = 0 ]; then RTFBARU=$((RTFBARU+1)); printf '%s\n' "$f" >> "$DAFTARRTF"
  elif [ -n "$(sebelum_dari "$mm")" ] && [ "$j0" = 0 ] && [ "$j1" = 1 ]; then RTFSUDAH=$((RTFSUDAH+1))
  else gagal "berkas RTF tak dikenal (md5 $mm; 0184=$j0 0207=$j7 0111=$j1): $(basename "$f") - TIDAK ada yang diubah"; fi
done < <(find "$D" -maxdepth 1 -type f \( -name '01-b. BAS Pertama P (Kuasa) Tidak Hadir*Tunda Panggil PKuasanya*.rtf' -o -name '01-c. BAS Pertama P (Kuasa) Hadir*Tunda Panggil T.PA.Mj.rtf' \) | sort)
echo "RTF: perlu diubah=$RTFBARU sudah-diubah=$RTFSUDAH"
[ $((RTFBARU + RTFSUDAH)) -gt 0 ] || gagal "tidak ada berkas BAS P (Kuasa) yang cocok di $D - TIDAK ada yang diubah"

# --- 3. HITUNG sebelum ----------------------------------------------------------------------------------------------------
HS=$(rdr HITUNG) || gagal "HITUNG tak terbaca - TIDAK ada yang diubah"
T0=$(echo "$HS" | cut -d'|' -f1); R0=$(echo "$HS" | cut -d'|' -f2); C0=$(echo "$HS" | cut -d'|' -f3)
echo "SEBELUM: seluruh baris=$T0; baris di perkara tanpa catatan Minutasi=$R0; baris penutup yang dihapus=$C0"
CAP=$(date +%Y%m%d%H%M%S)
if [ "$C0" != 0 ] || [ "$RTFBARU" != 0 ]; then
  UBAH=1
  # --- 4. CADANGAN (tidak pernah menimpa cadangan lama) ----------------------------------------------------------------
  for f in baris-dihapus.sql id-hapus.txt per-perkara-sebelum.tsv per-perkara-sesudah.tsv hitung-sebelum.txt hitung-sesudah.txt periksa-sesudah.txt rtf-sebelum.tsv; do
    [ -f "$CAD/$f" ] && mv "$CAD/$f" "$CAD/$f.$CAP"
  done
  echo "$HS" > "$CAD/hitung-sebelum.txt"
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
  mkdir -p "$CAD/rtf" || gagal "tidak bisa membuat $CAD/rtf"
  : > "$CAD/rtf-sebelum.tsv"
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    cp -p "$f" "$CAD/rtf/$(basename "$f").sebelum-x11" || gagal "cadangan RTF gagal - TIDAK ada yang diubah"
    [ "$(m5 "$CAD/rtf/$(basename "$f").sebelum-x11")" = "$(m5 "$f")" ] || gagal "cadangan RTF tidak sama - TIDAK ada yang diubah"
    printf '%s\t%s\n' "$(m5 "$f")" "$f" >> "$CAD/rtf-sebelum.tsv"
  done < "$DAFTARRTF"
  echo "CADANGAN: $CAD (baris dihapus tercadang: $NID; perkara: $(grep -c . "$CAD/per-perkara-sebelum.tsv"); berkas RTF: $RTFBARU)"

  # --- 5. HAPUS baris ----------------------------------------------------------------------------------------------------
  if [ "$NID" -gt 0 ]; then
    IDS=$(paste -sd, "$CAD/id-hapus.txt")
    DIH=$(sqlf "$N-HAPUS.sql" | sed "s/__IDS__/$IDS/" | $MY -N | tr -d '\r' | tail -1)
    echo "HAPUS: $DIH baris dihapus (diharapkan $NID)"
    [ "$DIH" = "$NID" ] || { pulih; gagal "baris terhapus ($DIH) tidak sama dengan daftar ($NID) - dipulihkan"; }
  fi
  # --- 6. RTF: "#0184#" -> "#0111#" (panjang sama; ditulis ke berkas yang sama agar pemilik/izin tetap) -----------------------------
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    mm=$(m5 "$f"); target=$(sesudah_dari "$mm")
    LC_ALL=C sed 's/#0184#/#0111#/' "$f" > "$CAD/rtf/tulis.tmp"
    [ "$(m5 "$CAD/rtf/tulis.tmp")" = "$target" ] || { rm -f "$CAD/rtf/tulis.tmp"; pulih; gagal "hasil sunting RTF tidak sama dengan yang dikunci ($(basename "$f")) - dipulihkan"; }
    cat "$CAD/rtf/tulis.tmp" > "$f" && rm -f "$CAD/rtf/tulis.tmp"
    [ "$(m5 "$f")" = "$target" ] || { pulih; gagal "berkas tertulis tidak sama ($(basename "$f")) - dipulihkan"; }
  done < "$DAFTARRTF"
  echo "RTF: $RTFBARU berkas diubah (#0184# -> #0111#)"
else
  UBAH=0
  echo "SUDAH bersih (tidak ada baris penutup di perkara tanpa catatan Minutasi; BAS P (Kuasa) sudah diubah) - hanya PERIKSA ulang"
fi
rm -f "$DAFTARRTF"

# --- 7. PERIKSA ----------------------------------------------------------------------------------------------------------------
rdr PERIKSA > "$CAD/periksa-sesudah.txt" 2>&1
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  cat "$CAD/periksa-sesudah.txt" | head -5
  [ "$UBAH" = 1 ] && pulih
  gagal "PERIKSA tidak cocok$([ "$UBAH" = 1 ] && echo ' - dipulihkan')"
fi
echo "PERIKSA: $(grep -c '	1$' "$CAD/periksa-sesudah.txt") butir cocok - SEMUA COCOK"
HA=$(rdr HITUNG) || gagal "HITUNG sesudah tak terbaca"
echo "$HA" > "$CAD/hitung-sesudah.txt"
T1=$(echo "$HA" | cut -d'|' -f1); R1=$(echo "$HA" | cut -d'|' -f2); C1=$(echo "$HA" | cut -d'|' -f3)
if [ "$UBAH" = 1 ]; then
  if [ "$T1" != "$((T0 - C0))" ] || [ "$R1" != "$((R0 - C0))" ] || [ "$C1" != 0 ]; then
    pulih; gagal "HITUNG sesudah ($HA) tidak sama dengan harapan ($((T0 - C0))|$((R0 - C0))|0) - dipulihkan"
  fi
  if [ -s "$CAD/per-perkara-sebelum.tsv" ]; then
    PL=$(cut -f1 "$CAD/per-perkara-sebelum.tsv" | paste -sd,)
    $MY -N -e "SELECT perkara_id, COUNT(*) FROM abt_keterangan_saksi WHERE perkara_id IN ($PL) GROUP BY perkara_id ORDER BY perkara_id" | tr -d '\r' > "$CAD/per-perkara-sesudah.tsv"
  fi
fi
echo "SESUDAH: seluruh baris=$T1; baris di perkara tanpa catatan Minutasi=$R1; baris penutup=$C1"
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
