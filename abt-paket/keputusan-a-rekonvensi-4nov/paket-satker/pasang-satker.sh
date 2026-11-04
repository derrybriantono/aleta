#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-keputusan-a-rekonvensi-4nov" (keputusan Derry 182 butir A2, 4 Nov 2026). Dijalankan DI SERVER sebagai root, dari
# folder paket. HANYA blangko pengguna derry_briantono: SATU berkas "1a Perceraian CT/[02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).rtf"
# disusun ulang menjadi kerangka (fakta contoh -> variabel isian, nominal contoh -> isian kosong, catatan kerja dibuang; lihat PASANG.md).
# Tanpa variabel, menu, fungsi, tabel, atau data yang diubah.
# URUTAN PASANG: SESUDAH keputusan-a-kerangka-4nov (memakai #9268#/#9269#); md5 berkas = keadaan sesudah keputusan-a-mekanis-4nov.
# Urutan: md5 paket -> PRASYARAT SQL (baca saja: 14 variabel yang dirujuk ada) -> CEK berkas (md5 persis; beda = BERHENTI, tidak ada yang
#         diubah) -> PASANG (cadangan utuh di cadangan/rtf-lama, tulis atomik, baca ulang) -> PERIKSA. Gagal = pulih otomatis.
# Laptop: ABT_LOKAL=1 ABT_DB=<basis ABT uji> ABT_BLANGKO=<_blangko_abt uji> MYSQL_BIN=<folder mysql.exe> PY=python bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-keputusan-a-rekonvensi-4nov
HARAP="$(sed -n 1p harap.txt | tr -d '\r')"
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
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

# --- 1. PRASYARAT (baca saja) -------------------------------------------------------------------------------------------
p=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r') || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
[ "$p" = "$HARAP" ] || gagal "prasyarat '$p' (harus '$HARAP' = semua variabel yang dirujuk ada; paket keputusan-a-kerangka-4nov belum terpasang?) - TIDAK ada yang diubah"
echo "PRASYARAT COCOK ($p)"
c=$($PY tambal_rtf.py cek "$B"); echo "$c" | tail -3
[ "$(echo "$c" | tail -1 | tr -d '\r')" = "BERKAS SIAP" ] || gagal "berkas tujuan tidak sama dengan keadaan sesudah keputusan-a-mekanis-4nov - TIDAK ada yang diubah"

# --- 2. PASANG ------------------------------------------------------------------------------------------------------------
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
$PY tambal_rtf.py pasang "$B" "$CAD" > "$CAD/berkas-pasang.txt"
if [ "$?" != "0" ]; then
  cat "$CAD/berkas-pasang.txt"
  $PY tambal_rtf.py pulih "$B" "$CAD"
  gagal "berkas tidak terpasang - dikembalikan (lihat $CAD/berkas-pasang.txt)"
fi
tail -1 "$CAD/berkas-pasang.txt"

# --- 3. PERIKSA -----------------------------------------------------------------------------------------------------------
$PY tambal_rtf.py periksa "$B" > "$CAD/berkas-periksa.txt"
tail -1 "$CAD/berkas-periksa.txt"
if [ "$(tail -1 "$CAD/berkas-periksa.txt" | tr -d '\r')" != "BERKAS COCOK" ]; then
  $PY tambal_rtf.py pulih "$B" "$CAD"
  gagal "periksa berkas tidak cocok - berkas dikembalikan"
fi
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
