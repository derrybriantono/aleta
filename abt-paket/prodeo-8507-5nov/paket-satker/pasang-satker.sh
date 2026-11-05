#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-prodeo-8507-5nov" (5 Nov 2026). Dijalankan DI SERVER sebagai root, dari folder paket. Hanya rumus variabel 8507 (DUDUK PERKARA PRODEO)
# yang dipakai blangko derry_briantono. Tanpa berkas blangko, fungsi, menu, tabel, atau data perkara yang diubah. Perkara non-prodeo tetap bernilai kosong.
# Urutan: md5 paket -> PRASYARAT (rumus persis rumus lama) -> cadangan rumus -> PASANG (satu transaksi) -> PERIKSA. Gagal = pulih otomatis. Lihat PASANG.md.
# Laptop: ABT_LOKAL=1 ABT_DB=<basis ABT uji> bash pasang-satker.sh  (mysql lewat PATH)
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-prodeo-8507-5nov
HARAP="$(sed -n 1p harap.txt | tr -d '\r')"
ULANG="$(sed -n 2p harap.txt | tr -d '\r')"
CAD="$SINI/cadangan"
ADB="${ABT_DB:-aps_badilag}"
gagal() { echo "GAGAL: $*"; exit 1; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"

p=$($MY -N < "$N-PRASYARAT.sql") || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
p=$(echo "$p" | tr -d '\r')
if [ "$p" != "$HARAP" ] && [ "$p" != "$ULANG" ]; then
  gagal "prasyarat '$p' (harus '$HARAP' pasang pertama atau '$ULANG' pasang ulang): rumus 8507 di server berbeda - TIDAK ada yang diubah"
fi
echo "PRASYARAT COCOK ($p)"
mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
if [ "$p" = "$HARAP" ]; then
  $MY -N -e "SELECT HEX(sql_query), modified, modifier FROM abt_variabel WHERE no_var = 8507" > "$CAD/rumus-8507-sebelum.txt" || gagal "cadangan rumus gagal - TIDAK ada yang diubah"
  $MY < "$N-PASANG.sql" || { $MY -N < "$N-PULIH.sql"; gagal "$N-PASANG.sql gagal - dipulihkan"; }
fi
r=$($MY -N < "$N-PERIKSA.sql" | tr -d '\r')
echo "PERIKSA: $r"
if [ "$r" != "SEMUA COCOK" ]; then
  [ "$p" = "$HARAP" ] && { $MY -N < "$N-PULIH.sql"; echo "rumus dipulihkan"; }
  gagal "PERIKSA tidak cocok"
fi
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
