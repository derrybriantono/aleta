#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-jawab-replik-31okt" (31 Okt 2026). Dijalankan DI SERVER sebagai root, dari folder paket. HANYA pengguna derry_briantono.
# Isi: naskah utuh jawab-menjawab - variabel BARU 12020-12028 (isian naskah) dan 12030-12036 (penampil RTF), variabel lama 9252/9253/9254/9257/9258
# diubah (naskah tertulis didahulukan, HANYA bila nama+kueri persis dasar); blangko RTF ditambal (daftar-tambal.tsv + tambal.tsv, HANYA bila md5
# persis keadaan SESUDAH 21 paket ../URUTAN-PASANG-31okt.md): petunjuk "COPY FILE ... APABILA TERTULIS" diganti variabel, BAS jawab-menjawab
# disisipi naskah sesudah #7083#, putusan kontradiktoir yang hanya memuat pokok jawaban disisipi naskah tertulis susulan.
# URUTAN PASANG: PALING AKHIR (ke-22) - sesudah tanggal-agenda-31okt.
# Urutan: md5 -> PRASYARAT SQL + BERKAS (baca saja) -> CADANGAN -> PASANG SQL (satu transaksi) -> PERIKSA -> UJI kueri (baca saja)
#         -> BERKAS -> PERIKSA BERKAS. Gagal sesudah PASANG = PULIH otomatis.
# Laptop: ABT_LOKAL=1 ABT_DB=<salinan> SIPP_DB=<salinan SIPP> ABT_BLANGKO=<_blangko_abt uji> MYSQL_BIN=<folder mysql.exe> PY=python bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-jawab-replik-31okt
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

# --- 4. UJI: tiap kueri baru/diubah berjalan di server ini tanpa galat (baca saja; perkara terakhir) ----------------------------
SQ="${BIN}mysql -h $H -u root --default-character-set=latin1 $SDB -N"
PID=$($SQ -e "SELECT MAX(perkara_id) FROM perkara" 2>/dev/null | tr -d '\r')
[ -n "$PID" ] || { pulih_sql; gagal "perkara SIPP tidak terbaca - dipulihkan; berkas belum disentuh"; }
nuji=0
while IFS=$'\t' read -r no b64; do
  [ -n "$no" ] || continue
  q=$(printf '%s' "$b64" | base64 -d | sed -e "s/#perkara_id#/$PID/g" -e "s/#0046#/Penggugat/g" -e "s/#0047#/Tergugat/g" -e "s/#0098#//g" -e "s/#0102#//g" -e "s/#711[1-4]#//g")
  [ "$ADB" != "aps_badilag" ] && q=$(printf '%s' "$q" | sed "s/aps_badilag\./$ADB./g")
  if ! $SQ -e "SELECT CHAR_LENGTH(x.data) FROM ($q) x" >/dev/null 2>"$CAD/uji-$no.err"; then
    cat "$CAD/uji-$no.err" | head -3; pulih_sql
    gagal "kueri #$no galat di server ini - dipulihkan; berkas belum disentuh"
  fi
  nuji=$((nuji + 1))
done < uji-kueri.tsv
echo "UJI: $nuji kueri berjalan (perkara $PID)"

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
