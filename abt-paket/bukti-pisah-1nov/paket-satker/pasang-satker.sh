#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-bukti-pisah-1nov" (1 Nov 2026). Dijalankan DI SERVER sebagai root, dari folder paket. HANYA pengguna derry_briantono.
# Isi: bukti surat dan bukti elektronik dicetak TERPISAH di BAS pembuktian dan putusan - fungsi BARU isian_bukti_baris / isian_bukti_sumber /
# isian_bukti_rtf, variabel BARU 12040-12079 (turunan dari isian bukti yang sudah ada; tanpa isian baru), blangko RTF ditambal
# (daftar-tambal.tsv + tambal.tsv, HANYA bila md5 persis keadaan SESUDAH 23 paket ../URUTAN-PASANG-31okt.md).
# URUTAN PASANG: KE-24, PALING AKHIR - sesudah butir-rata-31okt.
# Urutan: md5 -> PRASYARAT SQL + BERKAS (baca saja) -> CADANGAN -> FUNGSI -> PASANG SQL (satu transaksi) -> PERIKSA -> UJI fungsi & kueri (baca saja)
#         -> BERKAS -> PERIKSA BERKAS. Gagal sesudah FUNGSI = PULIH otomatis.
# Laptop: ABT_LOKAL=1 ABT_DB=<salinan> SIPP_DB=<salinan SIPP> ABT_BLANGKO=<_blangko_abt uji> MYSQL_BIN=<folder mysql.exe> PY=python bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-bukti-pisah-1nov
HARAP="$(sed -n 1p harap.txt | tr -d '\r')"
ULANG="$(sed -n 2p harap.txt | tr -d '\r')"
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
pulih_sql() { $MY -N < "$N-PULIH.sql"; $MY < "$N-FUNGSI-PULIH.sql"; }

# --- 1. PRASYARAT (baca saja) -------------------------------------------------------------------------------------------
p=$($MY -N < "$N-PRASYARAT.sql") || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
p=$(echo "$p" | tr -d '\r')
if [ "$p" != "$HARAP" ] && [ "$p" != "$ULANG" ]; then
  gagal "prasyarat '$p' (harus '$HARAP' pasang pertama atau '$ULANG' pasang ulang) - TIDAK ada yang diubah. Arti angka: lihat $N-PRASYARAT.sql"
fi
echo "PRASYARAT COCOK ($p)"
c=$($PY tambal_rtf.py cek "$B"); echo "$c" | tail -3
[ "$(echo "$c" | tail -1)" = "BERKAS SIAP" ] || gagal "berkas tujuan tidak sesuai - TIDAK ada yang diubah"

# --- 2. CADANGAN (paket ini hanya MENAMBAH fungsi dan variabel; yang dicadangkan: keadaan prasyarat) ------------------------------
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
echo "$p" > "$CAD/prasyarat-sebelum.txt"
echo "CADANGAN: $CAD (berkas lama dicadangkan oleh tambal_rtf.py di tahap BERKAS)"

# --- 3. FUNGSI + PASANG SQL + PERIKSA ---------------------------------------------------------------------------------------
if [ "$p" = "$HARAP" ]; then
  $MY < "$N-FUNGSI.sql" > "$CAD/fungsi.log" 2>&1 || { tail -3 "$CAD/fungsi.log"; pulih_sql; gagal "fungsi tidak bisa dibuat - dipulihkan"; }
fi
$MY < "$N-PASANG.sql" || { pulih_sql; gagal "$N-PASANG.sql gagal (transaksi tidak di-COMMIT) - dipulihkan"; }
$MY -N < "$N-PERIKSA.sql" | tr -d '\r' > "$CAD/periksa-sesudah.txt"
tail -1 "$CAD/periksa-sesudah.txt" | cut -f1
if [ "$(tail -1 "$CAD/periksa-sesudah.txt" | cut -f1)" != "SEMUA COCOK" ]; then
  head -20 "$CAD/periksa-sesudah.txt"; pulih_sql
  gagal "PERIKSA tidak cocok - dipulihkan; berkas belum disentuh"
fi

# --- 4. UJI (baca saja): fungsi atas contoh tetap; tiap kueri variabel berjalan di server ini tanpa galat (perkara terakhir) -----------
SQ="${BIN}mysql -h $H -u root --default-character-set=latin1 $SDB -N"
nf=0
while IFS=$'\t' read -r b64 jenis fn harap; do
  [ -n "$b64" ] || continue
  h=$($MY -N -e "SELECT MD5($fn(CONVERT(UNHEX('$b64') USING latin1), $jenis))" 2>/dev/null | tr -d '\r')
  [ "$h" = "$harap" ] || { pulih_sql; gagal "UJI: contoh $fn jenis $jenis berbeda dari laptop ($h) - dipulihkan; berkas belum disentuh"; }
  nf=$((nf + 1))
done < uji-fungsi.tsv
echo "UJI: $nf contoh fungsi sama dengan laptop"
PID=$($SQ -e "SELECT MAX(perkara_id) FROM perkara" 2>/dev/null | tr -d '\r')
[ -n "$PID" ] || { pulih_sql; gagal "perkara SIPP tidak terbaca - dipulihkan; berkas belum disentuh"; }
nuji=0
while IFS=$'\t' read -r no b64; do
  [ -n "$no" ] || continue
  q=$(printf '%s' "$b64" | base64 -d | sed -E -e "s/#perkara_id#/$PID/g" -e "s/#[0-9]{4}#/Penggugat/g")
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
