#!/bin/bash
# =============================================================================
# PASANG paket ABT "abt-bukti-nomor-30okt" (30 Okt 2026) DI SERVER sebagai root, dari folder paket.
# Isi: 2 fungsi baru (isian_rtf_bukti_nomor, isian_rtf_bukti), 8 variabel data_sql BARU (nomor-baru.txt) dan blangko RTF
#      derry_briantono yang mencetak daftar bukti surat (rtf-daftar-tambal.tsv): paragraf "[1.] #isian bukti#" diganti
#      paragraf bergaya sama berisi variabel baru (penomoran 1., 2., ... dari fungsi) + penanda isian lama di tujuan RTF yang
#      diabaikan pengolah kata (penyunting ABT/panel tetap menawarkan isiannya).
# URUTAN DENGAN PAKET LAIN: sesudah prodeo-panggilan-29okt dan bas-tanya-jawab-29okt (dasar md5 RTF = hasil keduanya).
# Urutan: md5 paket -> PRASYARAT -> praperiksa RTF (SEMUA md5 persis dasar; satu beda = BERHENTI) -> CADANGAN -> FUNGSI ->
#         PASANG SQL -> PERIKSA -> tambal RTF -> periksa ulang. Gagal di tengah = PULIH otomatis.
# Laptop: ABT_LOKAL=1 ABT_DB=<basis salinan> ABT_BLANGKO=<salinan derry_briantono> bash pasang-satker.sh
# =============================================================================
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-bukti-nomor-30okt
HARAP=$(sed -n 1p harap.txt); ULANG=$(sed -n 2p harap.txt)
NR=$(grep -c . rtf-daftar-tambal.tsv)
CAD="$SINI/cadangan"
ADB="${ABT_DB:-aps_badilag}"
B="${ABT_BLANGKO:-/var/www/html/aps_badilag/_blangko_abt/derry_briantono}"
PERL="${PERL:-perl}"
gagal() { echo "GAGAL: $*"; exit 1; }
md5sum -c MD5SUMS.txt >/dev/null 2>&1 || gagal "isi paket rusak (md5sum -c MD5SUMS.txt)"
[ -d "$B" ] || gagal "folder blangko $B tidak ada"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || gagal "sandi DB tidak terbaca dari aleta-bot"
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
sqlf() { if [ "$ADB" = aps_badilag ]; then cat "$1"; else sed "s/aps_badilag\\./$ADB./g" "$1"; fi; }
pulih() { echo "... memulihkan"; ABT_LOKAL="${ABT_LOKAL:-}" ABT_DB="$ADB" ABT_BLANGKO="$B" bash "$SINI/pulih-satker.sh" 2>&1 | tail -4; }
set -o pipefail
p=$($MY -N < "$N-PRASYARAT.sql" | tr -d '\r') || gagal "prasyarat tak terbaca - TIDAK ada yang diubah"
inti=${p%|*}
[ "$inti" = "$HARAP" ] || [ "$inti" = "$ULANG" ] || gagal "prasyarat '$p' (harus '$HARAP|*' atau '$ULANG|*' bila pasang ulang) - TIDAK ada yang diubah. Arti angka: $N-PRASYARAT.sql"
echo "PRASYARAT COCOK ($p)"
mkdir -p "$CAD"
$PERL tambal-rtf.pl periksa "$B" "$CAD" > "$CAD/periksa-rtf-sebelum.txt" || gagal "praperiksa RTF galat - TIDAK ada yang diubah"
r=$(tail -1 "$CAD/periksa-rtf-sebelum.txt")
case "$r" in
  "RINGKAS COCOK=$NR SUDAH=0 LEWAT=0") RTF=belum ;;
  "RINGKAS COCOK=0 SUDAH=$NR LEWAT=0") RTF=sudah ;;
  *) grep -v '^COCOK\|^SUDAH' "$CAD/periksa-rtf-sebelum.txt" | head -n 20
     gagal "praperiksa RTF '$r' (harus COCOK=$NR SUDAH=0 LEWAT=0 atau COCOK=0 SUDAH=$NR LEWAT=0) - TIDAK ada yang diubah. Berkas LEWAT di atas: pasang prodeo & bas-tanya-jawab dulu, atau bangun ulang paket dari pohon server (PASANG.md)" ;;
esac
echo "PRAPERIKSA RTF: $r"
if [ "$inti" = "$HARAP" ]; then
  $MY -N -e "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name IN ('isian_rtf_bukti','isian_rtf_bukti_nomor')" | grep -qx 0 \
    || gagal "fungsi isian_rtf_bukti* sudah ada padahal variabel belum - TIDAK ada yang diubah"
  sqlf "$N-FUNGSI.sql" | $MY > "$CAD/fungsi.log" 2>&1 || { tail -3 "$CAD/fungsi.log"; pulih; gagal "fungsi tidak bisa dibuat - dipulihkan"; }
  sqlf "$N-PASANG.sql" | $MY || { pulih; gagal "$N-PASANG.sql gagal (transaksi tidak di-COMMIT) - dipulihkan"; }
fi
# PERIKSA dibaca apa adanya (normalisasi nama basis ada di dalamnya; jangan disulih sed)
r2=$($MY -N < "$N-PERIKSA.sql" | tr -d '\r')
echo "PERIKSA: $r2"
[ "$r2" = "SEMUA COCOK" ] || { [ "$inti" = "$HARAP" ] && pulih; gagal "PERIKSA tidak cocok"; }
if [ "$RTF" = belum ]; then
  if ! $PERL tambal-rtf.pl pasang "$B" "$CAD" > "$CAD/tambal-hasil.txt"; then
    tail -n 4 "$CAD/tambal-hasil.txt"; pulih; gagal "tambal RTF dibatalkan dan dipulihkan"
  fi
  tail -n 1 "$CAD/tambal-hasil.txt"
fi
$PERL tambal-rtf.pl periksa "$B" "$CAD" > "$CAD/periksa-rtf-sesudah.txt"
r3=$(tail -1 "$CAD/periksa-rtf-sesudah.txt")
echo "PERIKSA RTF: $r3"
[ "$r3" = "RINGKAS COCOK=0 SUDAH=$NR LEWAT=0" ] || { [ "$RTF" = belum ] && pulih; gagal "periksa ulang RTF tidak cocok"; }
echo "PRASYARAT SESUDAH: $($MY -N < "$N-PRASYARAT.sql" | tr -d '\r') (harus $ULANG|*)"
echo "SELESAI ($NR berkas RTF; cadangan: $CAD)"
