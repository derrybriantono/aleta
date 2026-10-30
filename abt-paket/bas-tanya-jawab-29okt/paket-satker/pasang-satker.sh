#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-bas-tanya-jawab-29okt" (29 Okt 2026). Dijalankan DI SERVER sebagai root, dari folder paket.
# Isi: blangko RTF derry_briantono (BAS dan putusan) yang keterangan saksinya TERTULIS MATI (tabel tanya-jawab dari isian,
#      butir "- Bahwa ..." dari isian, variabel kalimat saksi jadi 2555-2558/8486/8487/8511/8512) diganti dengan variabel
#      tanya-jawab saksi ABT - sama dengan blangko patokan (BAS ALUR 02 [2] "Saksi dan Putusan Verstek": #5058#/#5059#;
#      putusan "[01] [Kabul Verstek] Cerai (Format Lengkap)": #9259#/#9260#). Daftar berkas: daftar-berkas.tsv.
#      TIDAK ada baris basis data yang diubah. Blangko non-Derry TIDAK disentuh.
# Urutan: md5 paket -> PRASYARAT (baca saja) -> praperiksa RTF (baca saja; SEMUA berkas harus md5 persis dasar paket,
#         satu saja beda = BERHENTI tanpa mengubah apa pun) -> tambal (cadangan utuh tiap berkas dulu) -> periksa ulang.
#         Gagal di tengah = PULIH otomatis.
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_bas29 ABT_BLANGKO=<salinan derry_briantono> bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-bas-tanya-jawab-29okt
HARAP=$(sed -n 1p harap.txt)
NR=$(grep -c . rtf-daftar-tambal.tsv)
CAD="$SINI/cadangan"
ADB="${ABT_DB:-aps_badilag}"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt/derry_briantono}"
PERL="${PERL:-perl}"
gagal() { echo "GAGAL: $*"; exit 1; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp, bukan editor"
[ -d "$B" ] || gagal "folder blangko $B tidak ada"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
set -o pipefail

# --- 1. PRASYARAT (baca saja) ----------------------------------------------------------------------------------------------
p=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r') || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
case "$p" in
  "$HARAP"|"${HARAP%|*}|0") echo "PRASYARAT COCOK ($p)"; [ "${p##*|}" = 0 ] && echo "INFO: fungsi isian_rtf_ket_saksi belum memakai penyaring penutup x6 (pasang x6 agar 'Bahwa sudah cukup' tidak ikut tercetak di putusan)";;
  *) gagal "prasyarat '$p' (harus '$HARAP') - TIDAK ada yang diubah. Arti angka: lihat $N-PRASYARAT.sql";;
esac
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"

# --- 2. praperiksa RTF (baca saja): semua COCOK (belum ditambal) atau semua SUDAH --------------------------------------------
$PERL tambal-rtf.pl periksa "$B" "$CAD" > "$CAD/periksa-rtf-sebelum.txt" || gagal "praperiksa RTF galat (lihat $CAD/periksa-rtf-sebelum.txt) - TIDAK ada yang diubah"
r=$(tail -1 "$CAD/periksa-rtf-sebelum.txt")
case "$r" in
  "RINGKAS COCOK=$NR SUDAH=0 LEWAT=0") RTF=belum ;;
  "RINGKAS COCOK=0 SUDAH=$NR LEWAT=0") RTF=sudah ;;
  *) grep -v '^COCOK\|^SUDAH' "$CAD/periksa-rtf-sebelum.txt" | head -n 20
     gagal "praperiksa RTF '$r' (harus COCOK=$NR SUDAH=0 LEWAT=0 atau COCOK=0 SUDAH=$NR LEWAT=0) - TIDAK ada yang diubah. Berkas LEWAT (md5 beda dari dasar paket) di atas: ambil pohon server terbaru lalu bangun ulang paket (PASANG.md, 'Bangun ulang')" ;;
esac
echo "PRAPERIKSA RTF: $r"

# --- 3. tambal RTF (cadangan utuh tiap berkas dulu) ---------------------------------------------------------------------------
if [ "$RTF" = belum ]; then
  echo "== tambal blangko RTF derry_briantono ($NR berkas)"
  if ! $PERL tambal-rtf.pl pasang "$B" "$CAD" > "$CAD/tambal-hasil.txt"; then
    tail -n 6 "$CAD/tambal-hasil.txt"
    echo "tambal RTF gagal - memulihkan"; $PERL tambal-rtf.pl pulih "$B" "$CAD" | tail -n 3
    gagal "tambal RTF dibatalkan dan dipulihkan"
  fi
  tail -n 1 "$CAD/tambal-hasil.txt"
else
  echo "PASANG ULANG: semua berkas sudah bertambal, tidak ada yang ditulis"
fi

# --- 4. periksa ulang -------------------------------------------------------------------------------------------------------------
$PERL tambal-rtf.pl periksa "$B" "$CAD" > "$CAD/periksa-rtf-sesudah.txt"
r2=$(tail -1 "$CAD/periksa-rtf-sesudah.txt")
echo "PERIKSA RTF: $r2"
if [ "$r2" != "RINGKAS COCOK=0 SUDAH=$NR LEWAT=0" ]; then
  if [ "$RTF" = belum ]; then echo "periksa ulang tidak cocok - memulihkan"; $PERL tambal-rtf.pl pulih "$B" "$CAD" | tail -n 3; fi
  gagal "periksa ulang RTF tidak cocok"
fi
# tanpa kata nama aplikasi di berkas hasil
nap=0
while IFS= read -r rel; do grep -q -i 'aleta' "$B/$rel" && { echo "PERINGATAN: kata nama aplikasi di $rel"; nap=$((nap+1)); }; done < <(cut -f2 rtf-daftar-tambal.tsv)
[ "$nap" = 0 ] && echo "TANPA KATA NAMA APLIKASI: $NR berkas diperiksa"
echo "SELESAI ($NR berkas; cadangan berkas lama: $CAD/rtf-lama)"
