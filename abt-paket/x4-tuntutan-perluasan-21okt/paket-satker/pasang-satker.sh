#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-x4-tuntutan-perluasan-21okt" (21 Okt 2026). Dijalankan DI SERVER sebagai root, dari folder paket.
# Isi: variabel BARU (pemicu layar hak bekas istri 3401-3408, bagian akibat cerai varian 3410-3421, pemicu perkara anak 3430-3435,
#      pemicu utang bersama 3440), baris variabel yang DIUBAH (u2 4110-4150: penjaga daftar pilihan bawaan; hak bekas istri 3760-3779:
#      pola petitum + penjaga daftar bawaan; kebendaan 4788-4847: pola sita/utang/jaminan/batal), dan tambalan blangko RTF Derry
#      (varian Mut'ah Iddah, CT ex officio, CG kumulasi nafkah istri, folder 1d, CG qabla dukhul, BAS putus verstek 1d).
# Urutan: md5 -> PRASYARAT variabel (baca saja) -> praperiksa RTF (md5 persis + jangkar tepat; tidak menulis) -> CADANGAN baris diubah
#         -> PASANG SQL (satu transaksi) -> PERIKSA -> UJI kueri atas perkara nyata (baca saja) -> tambal RTF (cadangan utuh dulu)
#         -> periksa ulang RTF. Gagal sesudah PASANG = PULIH otomatis (variabel dan RTF).
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_x4u SIPP_DB=sipp_donggala ABT_BLANGKO=<salinan derry_briantono> bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-x4-tuntutan-perluasan-21okt
HARAP=$(sed -n 1p harap.txt)
ULANG=$(sed -n 2p harap.txt)
JU=$(sed -n 3p harap.txt)
NR=$(sed -n 4p harap.txt)
CAD="$SINI/cadangan"
SDB="${SIPP_DB:-SIPP}"
ADB="${ABT_DB:-aps_badilag}"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt/derry_briantono}"
PERL="${PERL:-perl}"
gagal() { echo "GAGAL: $*"; exit 1; }
pulih_semua() { bash ./pulih-satker.sh; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
[ -d "$B" ] || gagal "folder blangko $B tidak ada"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
NOMOR_UBAH=$(cat nomor-ubah.txt)

# --- 1. PRASYARAT variabel (baca saja) ----------------------------------------------------------------------------------
p=$($MY -N < "$N-PRASYARAT.sql") || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
if [ "$p" != "$HARAP" ] && [ "$p" != "$ULANG" ]; then
  gagal "prasyarat '$p' (harus '$HARAP', atau '$ULANG' bila pasang ulang) - TIDAK ada yang diubah. Arti angka: lihat $N-PRASYARAT.sql"
fi
echo "PRASYARAT COCOK ($p)"

# --- 2. praperiksa RTF (tidak menulis) ------------------------------------------------------------------------------------
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
$PERL tambal-rtf.pl periksa "$B" "$CAD" > "$CAD/rtf-periksa-sebelum.txt" || gagal "praperiksa RTF galat (lihat $CAD/rtf-periksa-sebelum.txt) - TIDAK ada yang diubah"
r=$(tail -1 "$CAD/rtf-periksa-sebelum.txt")
case "$r" in
  "RINGKAS COCOK=$NR SUDAH=0 LEWAT=0") RTF_PASANG=1 ;;
  "RINGKAS COCOK=0 SUDAH=$NR LEWAT=0") RTF_PASANG=0 ;;
  *) grep '^LEWAT' "$CAD/rtf-periksa-sebelum.txt" | head -n 30
     gagal "praperiksa RTF '$r' (harus COCOK=$NR SUDAH=0 LEWAT=0 atau COCOK=0 SUDAH=$NR LEWAT=0) - TIDAK ada yang diubah; berkas LEWAT di atas" ;;
esac
echo "RTF $r"

# --- 3. CADANGAN variabel (hanya saat pertama; pasang ulang TIDAK menimpa cadangan isi lama) ----------------------------------
if [ "$p" = "$HARAP" ]; then
  [ -f "$CAD/abt_variabel-sebelum.sql" ] && mv "$CAD/abt_variabel-sebelum.sql" "$CAD/abt_variabel-sebelum.$(date +%Y%m%d%H%M%S).sql"
  mysqldump -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
    --complete-insert --skip-comments --hex-blob --where="no_var IN ($NOMOR_UBAH)" "$ADB" abt_variabel > "$CAD/abt_variabel-sebelum.sql" \
    || gagal "mysqldump abt_variabel gagal - TIDAK ada yang diubah"
  nlama=$(grep -c '^REPLACE' "$CAD/abt_variabel-sebelum.sql")
  [ "$nlama" = "$JU" ] || gagal "cadangan memuat $nlama baris (harus $JU) - TIDAK ada yang diubah"
  echo "CADANGAN: $CAD/abt_variabel-sebelum.sql ($nlama baris lama)"
else
  [ -f "$CAD/abt_variabel-sebelum.sql" ] || echo "PERINGATAN: paket sudah terpasang tetapi $CAD/abt_variabel-sebelum.sql tidak ada - PULIH tidak dapat mengembalikan isi lama (ambil dari cadangan DB harian)"
  echo "PASANG ULANG: cadangan isi lama dibiarkan"
fi

# --- 4. PASANG SQL + PERIKSA -------------------------------------------------------------------------------------------
$MY < "$N-PASANG.sql" || { pulih_semua; gagal "$N-PASANG.sql gagal (transaksi tidak di-COMMIT) - dipulihkan"; }
$MY -N < "$N-PERIKSA.sql" > "$CAD/periksa-sesudah.txt"
tail -1 "$CAD/periksa-sesudah.txt"
if [ "$(tail -1 "$CAD/periksa-sesudah.txt")" != "SEMUA COCOK" ]; then
  grep -v '	1$' "$CAD/periksa-sesudah.txt"
  pulih_semua
  gagal "PERIKSA tidak cocok - dipulihkan"
fi

# --- 5. UJI kueri baru dan diubah atas perkara nyata (baca saja) -------------------------------------------------------------
SQ="mysql -h $H -u root --default-character-set=latin1 $SDB -N"
NU=$(awk -F'\t' '!/^#/ && NF==2' uji-kueri.tsv | wc -l | tr -d ' ')
PERKARA_UJI="$(cat perkara-uji.txt | tr '\n' ',' | sed "s/,\$//; s/,/','/g")"
for PID in $($SQ -e "SELECT perkara_id FROM perkara WHERE nomor_perkara IN ('$PERKARA_UJI')" 2>/dev/null | grep -v NULL | sort -u); do
  if ! sed "s/#perkara_id#/$PID/g" uji-kueri.tsv | awk -F'\t' '!/^#/ && NF==2 {print "SELECT " $1 " AS var, LEFT(REPLACE(IFNULL((SELECT x.data FROM (" $2 ") x LIMIT 1), \"(kosong)\"), CHAR(10), \" \"), 120) AS data;"}' \
       | $SQ > "$CAD/uji-$PID.txt" 2>&1; then
    echo "uji perkara $PID: GALAT $(head -c 300 "$CAD/uji-$PID.txt")"
    pulih_semua
    gagal "kueri variabel baru atau diubah tidak jalan di server ini - dipulihkan. Kirim $CAD/uji-$PID.txt ke pengembang"
  fi
  [ "$(grep -c . "$CAD/uji-$PID.txt")" = "$NU" ] || { pulih_semua; gagal "uji perkara $PID tidak menjawab $NU baris - dipulihkan"; }
  echo "uji perkara $PID: $(grep -c . "$CAD/uji-$PID.txt") kueri jalan; pemicu/bagian berisi: $(awk -F"	" '$1<3500 && $2!="(kosong)" && $2!="" {printf "%s ", $1}' "$CAD/uji-$PID.txt")"
done

# --- 6. tambal RTF (cadangan utuh dulu) + periksa ulang ----------------------------------------------------------------------
if [ "$RTF_PASANG" = 1 ]; then
  if ! $PERL tambal-rtf.pl pasang "$B" "$CAD" > "$CAD/rtf-tambal-hasil.txt"; then
    tail -n 6 "$CAD/rtf-tambal-hasil.txt"
    pulih_semua
    gagal "tambal RTF gagal - dipulihkan"
  fi
  tail -n 1 "$CAD/rtf-tambal-hasil.txt"
fi
$PERL tambal-rtf.pl periksa "$B" "$CAD" > "$CAD/rtf-periksa-sesudah.txt"
if [ "$(tail -1 "$CAD/rtf-periksa-sesudah.txt")" != "RINGKAS COCOK=0 SUDAH=$NR LEWAT=0" ]; then
  tail -n 5 "$CAD/rtf-periksa-sesudah.txt"
  pulih_semua
  gagal "periksa ulang RTF tidak cocok - dipulihkan"
fi
echo "RTF $(tail -1 "$CAD/rtf-periksa-sesudah.txt")"
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
