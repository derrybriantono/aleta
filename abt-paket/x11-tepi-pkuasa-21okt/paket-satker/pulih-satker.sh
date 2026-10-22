#!/bin/bash
# PULIH paket ABT "abt-x11-tepi-pkuasa-21okt" (21 Okt 2026) - deterministik:
#  1) baris yang dihapus dikembalikan dari cadangan/baris-dihapus.sql dengan INSERT IGNORE (yang sudah ada tidak ditimpa);
#  2) berkas RTF dikembalikan dari cadangan/rtf/*.sebelum-x11 HANYA bila md5-nya masih persis hasil paket (yang sudah diubah orang DIBIARKAN dan dilaporkan).
# Baris terakhir harus "PULIH COCOK". Laptop: ABT_LOKAL=1 ABT_DB=aps_badilag_x11 SIPP_DB=sipp_x11 ABT_BLANGKO=<salinan _blangko_abt> bash pulih-satker.sh
set -u
cd "$(dirname "$0")" || exit 1
SINI=$(pwd)
N=abt-x11-tepi-pkuasa-21okt
CAD="$SINI/cadangan"
ADB="${ABT_DB:-aps_badilag}"
if [ "${ABT_LOKAL:-}" != 1 ] && [ -z "${MYSQL_PWD:-}" ]; then
  MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" || { echo "GAGAL: sandi DB tidak terbaca"; exit 1; }
  export MYSQL_PWD
fi
H="${MYSQL_HOST:-127.0.0.1}"
MY="mysql -h $H -u root --default-character-set=latin1 $ADB"
myn() { $MY -N "$@" | tr -d '\r'; }
m5() { md5sum "$1" | cut -c1-32; }
set -o pipefail
[ -f "$CAD/hitung-sebelum.txt" ] || { echo "TIDAK ADA cadangan ($CAD/hitung-sebelum.txt) - tidak ada yang dipulihkan"; exit 1; }
BIARKAN=0
if [ -s "$CAD/baris-dihapus.sql" ]; then
  NCAD=$(grep -c '^INSERT' "$CAD/baris-dihapus.sql")
  IDS=$(paste -sd, "$CAD/id-hapus.txt")
  ADA0=$(myn -e "SELECT COUNT(*) FROM abt_keterangan_saksi WHERE id IN ($IDS)")
  $MY < "$CAD/baris-dihapus.sql" || { echo "GAGAL: baris tidak bisa dikembalikan"; exit 1; }
  ADA1=$(myn -e "SELECT COUNT(*) FROM abt_keterangan_saksi WHERE id IN ($IDS)")
  echo "BARIS: tercadang=$NCAD sudah-ada-sebelumnya=$ADA0 dikembalikan=$((ADA1 - ADA0)) ada-sekarang=$ADA1"
  [ "$ADA1" = "$NCAD" ] || BIARKAN=1
else
  echo "BARIS: tidak ada yang tercadang"
fi
KEMBALI=0; SUDAHLAMA=0
if [ -s "$CAD/rtf-sebelum.tsv" ]; then
  while IFS=$'\t' read -r md f; do
    [ -n "$f" ] || continue
    cad="$CAD/rtf/$(basename "$f").sebelum-x11"
    [ -f "$cad" ] || { echo "BIARKAN $(basename "$f") (cadangan hilang)"; BIARKAN=1; continue; }
    now=$(m5 "$f" 2>/dev/null)
    target=$(awk -v m="$md" '$1==m {print $2; exit}' rtf-md5.txt)
    if [ "$now" = "$md" ]; then SUDAHLAMA=$((SUDAHLAMA+1))
    elif [ -n "$target" ] && [ "$now" = "$target" ]; then
      cat "$cad" > "$f" && [ "$(m5 "$f")" = "$md" ] && KEMBALI=$((KEMBALI+1)) || { echo "GAGAL: $(basename "$f") tidak bisa dikembalikan"; exit 1; }
    else echo "BIARKAN $(basename "$f") (sudah diubah sesudah dipasang)"; BIARKAN=1; fi
  done < "$CAD/rtf-sebelum.tsv"
fi
echo "RTF: kembali=$KEMBALI sudah-lama=$SUDAHLAMA"
if [ "$BIARKAN" = 0 ]; then echo "PULIH COCOK"; else echo "PULIH SEBAGIAN (lihat BIARKAN di atas)"; fi
