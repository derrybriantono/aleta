#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-keputusan-a-kerangka-4nov" (keputusan Derry 182/184, 4 Nov 2026). Dijalankan DI SERVER sebagai root, dari folder
# paket. HANYA blangko dan variabel pengguna derry_briantono. Isi (lihat PASANG.md):
#   - variabel BARU 9266 (keterangan saksi 3 T), 9267 (saksi 4 T), 9268 (nafkah iddah per bulan), 9269 (per hari) - tanpa fungsi baru
#   - 12 blangko ditambal: 9 CT Mut'ah Iddah (A4), 2 BAS Itsbat (A8), 1 Asal Usul Anak [01b] (A10)
#   - 4 blangko BARU: putusan kontradiktoir CG/CT [02] dengan 3 dan 4 saksi Tergugat (A9)
# URUTAN PASANG: SESUDAH keputusan-a-mekanis-4nov (md5 berkas tambalan = hasil paket itu).
# Urutan: md5 paket -> PRASYARAT SQL + BERKAS (baca saja) -> PASANG SQL (satu transaksi) -> PERIKSA -> UJI kueri (baca saja) -> BERKAS
#         (tambal + berkas baru) -> PERIKSA BERKAS. Gagal sesudah PASANG SQL = PULIH otomatis (berkas lebih dulu, lalu variabel).
# Laptop: ABT_LOKAL=1 ABT_DB=<basis ABT uji> SIPP_DB=<basis SIPP uji> ABT_BLANGKO=<_blangko_abt uji> MYSQL_BIN=<folder mysql.exe> PY=python bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-keputusan-a-kerangka-4nov
HARAP="$(sed -n 1p harap.txt | tr -d '\r')"
ULANG="$(sed -n 2p harap.txt | tr -d '\r')"
NOMOR="$(grep -v '^#' nomor-variabel.txt | tr -d '\r' | paste -sd, -)"
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
pulih_berkas() { $PY berkas_rtf.py pulih "$B" "$CAD" >/dev/null 2>&1; $PY tambal_rtf.py pulih "$B" "$CAD" >/dev/null 2>&1; }

# --- 1. PRASYARAT (baca saja) -------------------------------------------------------------------------------------------
p=$($MY -N < "$N-PRASYARAT.sql") || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
p=$(echo "$p" | tr -d '\r')
if [ "$p" != "$HARAP" ] && [ "$p" != "$ULANG" ]; then
  gagal "prasyarat '$p' (harus '$HARAP' pasang pertama atau '$ULANG' pasang ulang) - TIDAK ada yang diubah. Arti angka: lihat $N-PRASYARAT.sql"
fi
echo "PRASYARAT COCOK ($p)"
c=$($PY tambal_rtf.py cek "$B"); echo "$c" | tail -3
[ "$(echo "$c" | tail -1 | tr -d '\r')" = "BERKAS SIAP" ] || gagal "berkas tujuan tidak sesuai (paket keputusan-a-mekanis-4nov belum terpasang, atau blangko berubah) - TIDAK ada yang diubah"
c2=$($PY berkas_rtf.py cek "$B"); echo "$c2" | tail -3
[ "$(echo "$c2" | tail -1 | tr -d '\r')" = "BERKAS SIAP" ] || gagal "folder/berkas baru tidak sesuai (berkas bernama sama sudah ada?) - TIDAK ada yang diubah"

# --- 2. CADANGAN (paket hanya MENAMBAH variabel dan berkas; berkas lama dicadangkan utuh oleh tambal_rtf.py) ---------------------
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
echo "$p" > "$CAD/prasyarat-sebelum.txt"
echo "CADANGAN: $CAD (berkas lama dicadangkan oleh tambal_rtf.py di tahap BERKAS)"

# --- 3. PASANG SQL + PERIKSA ----------------------------------------------------------------------------------------------
if [ "$p" = "$HARAP" ]; then
  $MY < "$N-PASANG.sql" || { pulih_sql; gagal "$N-PASANG.sql gagal (transaksi tidak di-COMMIT) - dipulihkan"; }
fi
r=$($MY -N < "$N-PERIKSA.sql" | tr -d '\r')
echo "PERIKSA: $r"
if [ "$r" != "SEMUA COCOK" ]; then
  [ "$p" = "$HARAP" ] && { pulih_sql; echo "variabel dipulihkan"; }
  gagal "PERIKSA tidak cocok - berkas belum disentuh"
fi

# --- 4. UJI (baca saja): tiap kueri variabel berjalan tanpa galat atas perkara terakhir di SIPP ---------------------------------
SQ="${BIN}mysql -h $H -u root --default-character-set=latin1 $SDB -N"
PID=$($SQ -e "SELECT MAX(perkara_id) FROM perkara" 2>/dev/null | tr -d '\r')
[ -n "$PID" ] || { [ "$p" = "$HARAP" ] && pulih_sql; gagal "perkara SIPP tidak terbaca - dipulihkan; berkas belum disentuh"; }
nuji=0
while IFS=$'\t' read -r no b64; do
  [ -n "$no" ] || continue
  q=$(printf '%s' "$b64" | base64 -d | sed -E -e "s/#perkara_id#/$PID/g" -e "s/#[0-9]{4}#/Penggugat/g")
  [ "$ADB" != "aps_badilag" ] && q=$(printf '%s' "$q" | sed "s/aps_badilag\./$ADB./g")
  if ! $SQ -e "SELECT CHAR_LENGTH(x.data) FROM ($q) x" >/dev/null 2>"$CAD/uji-$no.err"; then
    head -3 "$CAD/uji-$no.err"; [ "$p" = "$HARAP" ] && pulih_sql
    gagal "kueri #$no galat di server ini - dipulihkan; berkas belum disentuh"
  fi
  nuji=$((nuji + 1))
done < uji-kueri.tsv
echo "UJI: $nuji kueri berjalan (perkara $PID)"

# --- 5. BERKAS RTF (tambalan + blangko baru) --------------------------------------------------------------------------------
$PY tambal_rtf.py pasang "$B" "$CAD" > "$CAD/berkas-pasang.txt"
if [ "$?" != "0" ]; then
  tail -5 "$CAD/berkas-pasang.txt"; pulih_berkas; [ "$p" = "$HARAP" ] && pulih_sql
  gagal "berkas RTF tidak terpasang - berkas & variabel dikembalikan (lihat $CAD/berkas-pasang.txt)"
fi
tail -1 "$CAD/berkas-pasang.txt"
$PY berkas_rtf.py pasang "$B" "$SINI" "$CAD" > "$CAD/berkas-baru-pasang.txt"
if [ "$?" != "0" ]; then
  tail -5 "$CAD/berkas-baru-pasang.txt"; pulih_berkas; [ "$p" = "$HARAP" ] && pulih_sql
  gagal "blangko baru tidak terpasang - berkas & variabel dikembalikan (lihat $CAD/berkas-baru-pasang.txt)"
fi
tail -1 "$CAD/berkas-baru-pasang.txt"
$PY tambal_rtf.py periksa "$B" > "$CAD/berkas-periksa.txt"
$PY berkas_rtf.py periksa "$B" "$CAD" > "$CAD/berkas-baru-periksa.txt"
tail -1 "$CAD/berkas-periksa.txt"; tail -1 "$CAD/berkas-baru-periksa.txt"
if [ "$(tail -1 "$CAD/berkas-periksa.txt" | tr -d '\r')" != "BERKAS COCOK" ] || [ "$(tail -1 "$CAD/berkas-baru-periksa.txt" | tr -d '\r')" != "BERKAS COCOK" ]; then
  pulih_berkas; [ "$p" = "$HARAP" ] && pulih_sql
  gagal "periksa berkas tidak cocok - berkas & variabel dikembalikan"
fi
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
