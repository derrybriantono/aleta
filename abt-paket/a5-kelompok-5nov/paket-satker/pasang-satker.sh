#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-a5-kelompok-5nov" (keputusan Derry, 5 Nov 2026). Dijalankan DI SERVER sebagai root, dari folder paket.
# HANYA blangko pengguna derry_briantono dan isian baru untuk blangko itu. Isi (lihat PASANG.md): 45 kelompok teks merah sisa daftar A5:
#   hitamkan, isian ketik, isian otomatis kuasa dari SIPP, kalimat pilihan (bawaan tidak dipakai, tanpa alinea kosong), dua petunjuk kerja dibuang, dua salah ketik.
# URUTAN PASANG: SESUDAH a5-merah-5nov (md5 berkas = keadaan sesudah paket itu). Variabel baru 12150-12182. Tanpa fungsi, menu, tabel, atau data perkara.
# Urutan: md5 paket -> PRASYARAT SQL + BERKAS (baca saja) -> PASANG SQL (satu transaksi) -> PERIKSA -> BERKAS (cadangan utuh, tulis atomik,
#         baca ulang) -> PERIKSA BERKAS. Gagal sesudah PASANG SQL = pulih otomatis (berkas lebih dulu, lalu variabel).
# Laptop: ABT_LOKAL=1 ABT_DB=<basis ABT uji> ABT_BLANGKO=<_blangko_abt uji> PY=python bash pasang-satker.sh  (mysql lewat PATH)
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-a5-kelompok-5nov
HARAP="$(sed -n 1p harap.txt | tr -d '\r')"
ULANG="$(sed -n 2p harap.txt | tr -d '\r')"
CAD="$SINI/cadangan"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt}"
ADB="${ABT_DB:-aps_badilag}"
PY="${PY:-python}"
gagal() { echo "GAGAL: $*"; exit 1; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
[ -d "$B/derry_briantono" ] || gagal "folder $B/derry_briantono tidak ada - TIDAK ada yang diubah"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
pulih_sql() { $MY -N < "$N-PULIH.sql"; }

# --- 1. PRASYARAT (baca saja) -------------------------------------------------------------------------------------------
p=$($MY -N < "$N-PRASYARAT.sql") || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
p=$(echo "$p" | tr -d '\r')
if [ "$p" != "$HARAP" ] && [ "$p" != "$ULANG" ]; then
  gagal "prasyarat '$p' (harus '$HARAP' pasang pertama atau '$ULANG' pasang ulang) - TIDAK ada yang diubah. Arti angka: lihat $N-PRASYARAT.sql"
fi
echo "PRASYARAT COCOK ($p)"
c=$($PY tambal_rtf.py cek "$B"); echo "$c" | tail -20
[ "$(echo "$c" | tail -1 | tr -d '\r')" = "BERKAS SIAP" ] || gagal "berkas tujuan tidak sama dengan keadaan server sesudah a5-merah-5nov - TIDAK ada yang diubah"

# --- 2. PASANG SQL + PERIKSA ----------------------------------------------------------------------------------------------
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
echo "$p" > "$CAD/prasyarat-sebelum.txt"
if [ "$p" = "$HARAP" ]; then
  $MY < "$N-PASANG.sql" || { pulih_sql; gagal "$N-PASANG.sql gagal (transaksi tidak di-COMMIT) - dipulihkan"; }
fi
r=$($MY -N < "$N-PERIKSA.sql" | tr -d '\r')
echo "PERIKSA: $r"
if [ "$r" != "SEMUA COCOK" ]; then
  [ "$p" = "$HARAP" ] && { pulih_sql; echo "variabel dipulihkan"; }
  gagal "PERIKSA tidak cocok - berkas belum disentuh"
fi

# --- 3. BERKAS RTF --------------------------------------------------------------------------------------------------------
$PY tambal_rtf.py pasang "$B" "$CAD" > "$CAD/berkas-pasang.txt"
if [ "$?" != "0" ]; then
  tail -5 "$CAD/berkas-pasang.txt"; $PY tambal_rtf.py pulih "$B" "$CAD" >/dev/null 2>&1; [ "$p" = "$HARAP" ] && pulih_sql
  gagal "berkas RTF tidak terpasang - berkas & variabel dikembalikan (lihat $CAD/berkas-pasang.txt)"
fi
tail -1 "$CAD/berkas-pasang.txt"
$PY tambal_rtf.py periksa "$B" > "$CAD/berkas-periksa.txt"
tail -1 "$CAD/berkas-periksa.txt"
if [ "$(tail -1 "$CAD/berkas-periksa.txt" | tr -d '\r')" != "BERKAS COCOK" ]; then
  $PY tambal_rtf.py pulih "$B" "$CAD" >/dev/null 2>&1; [ "$p" = "$HARAP" ] && pulih_sql
  gagal "periksa berkas tidak cocok - berkas & variabel dikembalikan"
fi
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
