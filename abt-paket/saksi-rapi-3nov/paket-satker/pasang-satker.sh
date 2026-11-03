#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-saksi-rapi-3nov" (3 Nov 2026). Dijalankan DI SERVER sebagai root, dari folder paket. HANYA pengguna derry_briantono.
# Isi:
#   1. blangko RTF putusan/penetapan (301 berkas): paragraf keterangan saksi (#9259#-#9265#) SEJAJAR dengan identitas saksinya -
#      "-" di tepi kiri teks identitas, teks sesudah tab dan baris lanjutan menggantung 400 twip ke kanan (\fi-400 \li L+400 \tx L+400),
#      \cufi/\culi dibuang; identitas saksi ke-3..5 di 18 varian "(3/4/5 Saksi)" yang kurung kurawalnya rusak (Word memotong putusan
#      sesudah "3.") dibentuk seperti identitas saksi ke-2. Teks/penanda TIDAK diubah.
#   2. fungsi: isian_rtf_objek_tanya + isian_rtf_tahu_lengkap (baru), isian_rtf_ket_saksi (satu baris ditambah): jawaban saksi yang
#      hanya "tidak tahu/tidak mengetahuinya/tidak pernah melihatnya" dilengkapi objek dari pertanyaannya di putusan. Data BAS tidak diubah.
# Urutan: md5 -> PRASYARAT SQL + BERKAS (baca saja) -> CADANGAN definisi -> FUNGSI -> PERIKSA -> BERKAS -> PERIKSA BERKAS.
# Gagal sesudah FUNGSI = PULIH otomatis.
# Laptop: ABT_LOKAL=1 ABT_DB=<basis ABT uji> ABT_BLANGKO=<_blangko_abt uji> MYSQL_BIN=<folder mysql.exe> PY=python bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-saksi-rapi-3nov
HARAP="$(sed -n 1p harap.txt | tr -d '\r')"
ULANG="$(sed -n 2p harap.txt | tr -d '\r')"
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
sqlf() { if [ "$ADB" = aps_badilag ]; then cat "$1"; else sed "s/aps_badilag\\./$ADB./g" "$1"; fi; }
pulih_sql() { sqlf "$N-FUNGSI-LAMA.sql" | $MY; }

# --- 1. PRASYARAT (baca saja) ---------------------------------------------------------------------------------------
p=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r') || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
if [ "$p" != "$HARAP" ] && [ "$p" != "$ULANG" ]; then
  gagal "prasyarat '$p' (harus '$HARAP' pasang pertama atau '$ULANG' pasang ulang) - TIDAK ada yang diubah. Arti angka: lihat $N-PRASYARAT.sql"
fi
echo "PRASYARAT COCOK ($p)"
c=$($PY tambal_rtf.py cek "$B"); echo "$c" | tail -3
[ "$(echo "$c" | tail -1)" = "BERKAS SIAP" ] || gagal "berkas tujuan tidak sesuai - TIDAK ada yang diubah"

# --- 2. CADANGAN + FUNGSI + PERIKSA -----------------------------------------------------------------------------------
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
if [ "$p" = "$HARAP" ]; then
  $MY -N -e "SHOW CREATE FUNCTION isian_rtf_ket_saksi\G" > "$CAD/ket-saksi-sebelum.$(date +%Y%m%d%H%M%S).txt" || gagal "cadangan definisi gagal - TIDAK ada yang diubah"
  echo "CADANGAN: $CAD/ket-saksi-sebelum.*.txt"
  if ! sqlf "$N-FUNGSI.sql" | $MY > "$CAD/fungsi.log" 2>&1; then
    tail -3 "$CAD/fungsi.log"; pulih_sql; gagal "fungsi tidak bisa dibuat - dipulihkan ke definisi lama; berkas belum disentuh"
  fi
fi
r=$($MY -N < "$N-PERIKSA.sql" | tr -d '\r')
echo "PERIKSA: $r"
if [ "$r" != "SEMUA COCOK" ]; then
  [ "$p" = "$HARAP" ] && { pulih_sql; echo "fungsi dipulihkan"; }
  gagal "PERIKSA tidak cocok - berkas belum disentuh"
fi
p2=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r')
echo "PRASYARAT SESUDAH: $p2"
[ "$p2" = "$ULANG" ] || { [ "$p" = "$HARAP" ] && pulih_sql; gagal "prasyarat sesudah '$p2' bukan '$ULANG'"; }

# --- 3. BERKAS RTF ----------------------------------------------------------------------------------------------------
$PY tambal_rtf.py pasang "$B" "$CAD" > "$CAD/berkas-pasang.txt"
if [ "$?" != "0" ]; then
  tail -5 "$CAD/berkas-pasang.txt"
  $PY tambal_rtf.py pulih "$B" "$CAD"; [ "$p" = "$HARAP" ] && pulih_sql
  gagal "berkas RTF tidak terpasang - berkas & fungsi dikembalikan (lihat $CAD/berkas-pasang.txt)"
fi
tail -1 "$CAD/berkas-pasang.txt"
$PY tambal_rtf.py periksa "$B" > "$CAD/berkas-periksa.txt"
tail -1 "$CAD/berkas-periksa.txt"
if [ "$(tail -1 "$CAD/berkas-periksa.txt" | tr -d '\r')" != "BERKAS COCOK" ]; then
  $PY tambal_rtf.py pulih "$B" "$CAD"; [ "$p" = "$HARAP" ] && pulih_sql
  gagal "periksa berkas tidak cocok - berkas & fungsi dikembalikan"
fi
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
