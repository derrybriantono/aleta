#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-butir-rata-31okt" (31 Okt 2026). Dijalankan DI SERVER sebagai root, dari folder paket.
# Isi: fungsi isian_rtf_butir (+ isian_rtf_judul: "Dalam Konvensi dan Rekonvensi" sub-judul) diganti (HANYA bila isinya persis keadaan sesudah 22 paket ../URUTAN-PASANG-31okt.md): paragraf TANPA nomor
# sesudah butir bernomor dicetak rata kiri berinden baris pertama (keputusan pengguna 31 Okt). Butir bernomor dan butir "-" tetap.
# URUTAN PASANG: KE-23, PALING AKHIR - sesudah jawab-replik-31okt.
# Urutan: md5 -> PRASYARAT -> CADANGAN (SHOW CREATE) -> FUNGSI -> PERIKSA -> UJI (masukan tetap -> md5 keluaran). Gagal = PULIH otomatis.
# Laptop: ABT_LOKAL=1 ABT_DB=<salinan> MYSQL_BIN=<folder mysql.exe> bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-butir-rata-31okt
HARAP="$(sed -n 1p harap.txt | tr -d '\r')"
ULANG="$(sed -n 2p harap.txt | tr -d '\r')"
CAD="$SINI/cadangan"
ADB="${ABT_DB:-aps_badilag}"
BIN="${MYSQL_BIN:-}"; [ -n "$BIN" ] && BIN="$BIN/"
gagal() { echo "GAGAL: $*"; exit 1; }

md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt) - salin ulang paket dengan scp"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="${BIN}mysql -h $H -u root --default-character-set=latin1 $ADB"
pulih() { $MY < "$N-FUNGSI-LAMA.sql"; }

p=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r') || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
if [ "$p" = "$ULANG" ]; then echo "PRASYARAT COCOK ($p) - sudah terpasang, tidak ada yang diubah"; echo "SELESAI - paket $N sudah terpasang"; exit 0; fi
[ "$p" = "$HARAP" ] || gagal "prasyarat '$p' (harus '$HARAP') - fungsi isian_rtf_butir bukan keadaan dasar; TIDAK ada yang diubah"
echo "PRASYARAT COCOK ($p)"

mkdir -p "$CAD" || gagal "tidak bisa membuat $CAD"
{ $MY -N -e "SHOW CREATE FUNCTION isian_rtf_butir" && $MY -N -e "SHOW CREATE FUNCTION isian_rtf_judul"; } > "$CAD/fungsi-sebelum.txt" || gagal "cadangan fungsi gagal - TIDAK ada yang diubah"
echo "CADANGAN: $CAD/fungsi-sebelum.txt"

$MY < "$N-FUNGSI.sql" > "$CAD/fungsi.log" 2>&1 || { tail -3 "$CAD/fungsi.log"; pulih; gagal "fungsi tidak bisa dibuat - dipulihkan"; }
p=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r')
[ "$p" = "$ULANG" ] || { pulih; gagal "PERIKSA: isi fungsi '$p' bukan isi paket - dipulihkan"; }
echo "PERIKSA: SEMUA COCOK"

n=0; beda=0
while IFS=$'\t' read -r b64 mode harap; do
  [ -n "$b64" ] || continue
  h=$($MY -N -e "SELECT MD5(isian_rtf_butir(CONVERT(UNHEX('$b64') USING utf8mb4), '$mode', 426))" 2>/dev/null | tr -d '\r')
  [ "$h" = "$harap" ] || beda=$((beda + 1))
  n=$((n + 1))
done < uji.tsv
[ "$beda" = 0 ] || { pulih; gagal "UJI: $beda dari $n contoh keluarannya berbeda dari laptop - dipulihkan"; }
echo "UJI: $n contoh sama dengan laptop"
echo "SELESAI - paket $N terpasang. Cadangan: $CAD. Pulih: bash $SINI/pulih-satker.sh"
