#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-hir-rbg-30okt" (30 Okt 2026, G6). Dijalankan DI SERVER sebagai root, dari folder paket. HANYA pengguna derry_briantono.
# Isi: variabel BARU #11850# (hukum acara satker RBg/HIR, otomatis dari provinsi satker #9276#), #11851# (singkatan) dan variabel padanan
# nomor pasal/ayat; kueri variabel lama yang menyebut pasal RBg PASTI diganti padanan (nomor-diubah.txt; hanya bila md5 persis dasar);
# blangko RTF lama ditambal (daftar-tambal.tsv + tambal.tsv; hanya bila md5 persis keadaan SESUDAH semua paket 29-30 Okt).
# Untuk satker RBg (Donggala) hasil cetak IDENTIK; satker HIR otomatis menyebut pasal HIR.
# URUTAN PASANG: PALING AKHIR - sesudah semua paket 29-30 Okt (prodeo ... sela-ps-30okt).
# Urutan: md5 -> PRASYARAT SQL + BERKAS (baca saja) -> CADANGAN -> PASANG SQL (satu transaksi) -> PERIKSA -> UJI kueri baru (baca saja)
#         -> BERKAS -> PERIKSA BERKAS. Gagal sesudah PASANG = PULIH otomatis.
# Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_g6 SIPP_DB=sipp_g6 ABT_BLANGKO=<_blangko_abt uji> MYSQL_BIN=<folder mysql.exe> PY=python bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-hir-rbg-30okt
HARAP="$(sed -n 1p harap.txt | tr -d '\r')"
ULANG="$(sed -n 2p harap.txt | tr -d '\r')"
NOMOR="$(grep -v '^#' nomor-variabel.txt | paste -sd, -)"
UBAH="$(grep -v '^#' nomor-diubah.txt | paste -sd, -)"
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
SDB="${SIPP_DB:-SIPP}"
ADB="${ABT_DB:-aps_badilag}"
PY="${PY:-python}"
BIN="${MYSQL_BIN:-}"; [ -n "$BIN" ] && BIN="$BIN/"
gagal() { echo "GAGAL: $*"; exit 1; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
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
c=$($PY tambal_rtf.py cek "$B"); echo "$c" | tail -3
[ "$(echo "$c" | tail -1)" = "BERKAS SIAP" ] || gagal "berkas tujuan tidak sesuai - TIDAK ada yang diubah"

# --- 2. CADANGAN ------------------------------------------------------------------------------------------------------
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
[ -f "$CAD/abt_variabel-sebelum.sql" ] && mv "$CAD/abt_variabel-sebelum.sql" "$CAD/abt_variabel-sebelum.$(date +%Y%m%d%H%M%S).sql"
"${BIN}mysqldump" -h "$H" -u root --default-character-set=latin1 --skip-tz-utc --no-create-info --replace --skip-extended-insert \
  --complete-insert --skip-comments --hex-blob --where="no_var IN ($NOMOR,$UBAH)" "$ADB" abt_variabel > "$CAD/abt_variabel-sebelum.sql" \
  || gagal "mysqldump abt_variabel gagal - TIDAK ada yang diubah"
echo "CADANGAN: $CAD (baris variabel: $(grep -c '^REPLACE' "$CAD/abt_variabel-sebelum.sql"))"

# --- 3. PASANG SQL + PERIKSA -------------------------------------------------------------------------------------------
$MY < "$N-PASANG.sql" || { pulih_sql; gagal "$N-PASANG.sql gagal (transaksi tidak di-COMMIT) - dipulihkan"; }
$MY -N < "$N-PERIKSA.sql" | tr -d '\r' > "$CAD/periksa-sesudah.txt"
tail -1 "$CAD/periksa-sesudah.txt" | cut -f1
if [ "$(tail -1 "$CAD/periksa-sesudah.txt" | cut -f1)" != "SEMUA COCOK" ]; then
  head -20 "$CAD/periksa-sesudah.txt"; pulih_sql
  gagal "PERIKSA tidak cocok - dipulihkan; berkas belum disentuh"
fi

# --- 4. UJI: #11850# dan padanan menjawab di server ini (baca saja) ----------------------------------------------------------
SQ="${BIN}mysql -h $H -u root --default-character-set=latin1 $SDB -N"
KODE=$($SQ -e "SELECT TRIM(value) FROM sys_config WHERE name = 'KodePN' LIMIT 1" 2>/dev/null | tr -d '\r')
PROV=$($MY -N -e "SELECT sql_query FROM abt_variabel WHERE no_var = 9276" | tr -d '\r')
NP=$($SQ -e "SELECT x.data FROM ($PROV) x LIMIT 1" 2>/dev/null | tr -d '\r')
Q=$($MY -N -e "SELECT sql_query FROM abt_variabel WHERE no_var = 11850" | tr -d '\r')
Q2=$(printf '%s' "$Q" | sed "s|#9276#|$NP|g")
HA=$($SQ -e "SELECT x.data FROM ($Q2) x LIMIT 1" 2>&1 | tr -d '\r')
case "$HA" in
  RBg|HIR) echo "UJI: satker $KODE provinsi '$NP' -> hukum acara $HA" ;;
  *) pulih_sql; gagal "kueri #11850# tidak menjawab RBg/HIR di server ini ('$HA') - dipulihkan; berkas belum disentuh" ;;
esac

# --- 5. BERKAS RTF ---------------------------------------------------------------------------------------------------------
$PY tambal_rtf.py pasang "$B" "$CAD" > "$CAD/berkas-pasang.txt"
if [ "$?" != "0" ]; then
  tail -5 "$CAD/berkas-pasang.txt"
  $PY tambal_rtf.py pulih "$B" "$CAD"; pulih_sql
  gagal "berkas RTF tidak terpasang - berkas & variabel dikembalikan (lihat $CAD/berkas-pasang.txt)"
fi
tail -1 "$CAD/berkas-pasang.txt"
$PY tambal_rtf.py periksa "$B" > "$CAD/berkas-periksa.txt"
tail -1 "$CAD/berkas-periksa.txt"
if [ "$(tail -1 "$CAD/berkas-periksa.txt" | tr -d '\r')" != "BERKAS COCOK" ]; then
  $PY tambal_rtf.py pulih "$B" "$CAD"; pulih_sql
  gagal "periksa berkas tidak cocok - berkas & variabel dikembalikan"
fi
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
