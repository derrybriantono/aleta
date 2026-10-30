#!/bin/bash
# Uji rantai pasang paket ABT 29-30 Okt di salinan yang meniru server (basis aps_badilag_rantai = dump server 28 Okt 15.44,
# pohon _blangko_abt/derry_briantono = salinan server 28 Okt), memakai salinan repo apa adanya (git archive = seolah di-scp).
# pakai: bash rantai.sh <folder abt-paket salinan> [paket-mulai]
set -u
AP="$1"; MULAI="${2:-}"
export PATH="/d/satker asal/website pa bungku/xampp/mysql/bin:$PATH"
export ABT_LOKAL=1 ABT_DB=${ABT_DB:-aps_badilag_rantai} TMPDIR=/d/Aplikasi/aleta/tmp TMP=D:/Aplikasi/aleta/tmp TEMP=D:/Aplikasi/aleta/tmp
R=${RANTAI_DIR:-/d/r}
AKAR=$R/_blangko_abt
URUT="prodeo-panggilan-29okt bas-tanya-jawab-29okt bas-itsbat-varian-30okt bukti-nomor-30okt ket-saksi-kata-30okt ket-saksi-baris-30okt titik-koma-30okt titik-koma-data-30okt alasan-belum-dipilih-30okt agama-belum-diubah-30okt murtad-8529-30okt relaas-penetapan-30okt sampul-rapi-30okt sela-ps-30okt hir-rbg-30okt titik-koma-teks-30okt variabel-sehat-30okt identitas-kosong-31okt tinjau-31okt bukti-8529-31okt tanggal-agenda-31okt"
jalan=0; [ -z "$MULAI" ] && jalan=1
for p in $URUT; do
  [ "$p" = "$MULAI" ] && jalan=1
  [ $jalan = 1 ] || continue
  d="$AP/$p/paket-satker"
  s="$d/pasang-satker.sh"
  [ -f "$s" ] || { echo "### $p: TIDAK ADA pasang-satker.sh"; exit 1; }
  case "$p" in hir-rbg-30okt|tinjau-31okt|bukti-8529-31okt|tanggal-agenda-31okt)
    # HANYA salinan laptop: pasang-satker.sh mengganti "aps_badilag." dengan nama basis salinan di teks yang ditulis; di server
    # namanya memang aps_badilag. hir-rbg memeriksa md5 kueri MENTAH, jadi teks salinan dikembalikan ke bentuk server dulu.
    mysql -h 127.0.0.1 -u root -N "$ABT_DB" -e "UPDATE abt_variabel SET sql_query = REPLACE(sql_query, '$ABT_DB.', 'aps_badilag.') WHERE sql_query LIKE '%$ABT_DB.%'; SELECT CONCAT('    (salinan: nama basis dikembalikan ke bentuk server pada ', ROW_COUNT(), ' variabel)')" ;;
  esac
  if grep -q '_blangko_abt/derry_briantono' "$s"; then B="$AKAR/derry_briantono"; else B="$AKAR"; fi
  echo "### $p (ABT_BLANGKO=$B) $(date +%H:%M:%S)"
  ( cd "$d" && ABT_BLANGKO="$B" bash pasang-satker.sh ) > "$R/log-$p.txt" 2>&1
  rc=$?
  tail -4 "$R/log-$p.txt" | sed 's/^/    /'
  if [ $rc != 0 ]; then echo "### GAGAL $p (kode $rc) - rantai berhenti"; exit 1; fi
done
echo "### RANTAI SELESAI $(date +%H:%M:%S)"
