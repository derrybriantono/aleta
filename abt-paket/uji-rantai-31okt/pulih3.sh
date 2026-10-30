#!/bin/bash
# Uji pulih terbalik 3 paket terakhir lalu pasang lagi (salinan laptop).
set -u
AP="$1"
export PATH="/d/satker asal/website pa bungku/xampp/mysql/bin:$PATH"
export ABT_LOKAL=1 ABT_DB=aps_badilag_rantai TMPDIR=/d/Aplikasi/aleta/tmp TMP=D:/Aplikasi/aleta/tmp TEMP=D:/Aplikasi/aleta/tmp
AKAR=/d/r/_blangko_abt
SIDIK="SELECT MD5(GROUP_CONCAT(MD5(CONCAT_WS('|', no_var, nama, IFNULL(sql_query,''), IFNULL(modifier,''))) ORDER BY no_var SEPARATOR '')) FROM abt_variabel"
pohon() { (cd "$AKAR" && find . -type f -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32); }
for p in titik-koma-teks-30okt variabel-sehat-30okt identitas-kosong-31okt; do :; done
echo "SEBELUM PULIH: variabel $(mysql -h 127.0.0.1 -u root -N $ABT_DB -e "SET SESSION group_concat_max_len=1073741824; $SIDIK") pohon $(pohon)"
for p in identitas-kosong-31okt variabel-sehat-30okt titik-koma-teks-30okt; do
  d="$AP/$p/paket-satker"
  echo "### PULIH $p"
  ( cd "$d" && ABT_BLANGKO="$AKAR" bash pulih-satker.sh ) 2>&1 | tail -2 | sed 's/^/    /'
done
echo "SESUDAH PULIH 3: variabel $(mysql -h 127.0.0.1 -u root -N $ABT_DB -e "SET SESSION group_concat_max_len=1073741824; $SIDIK") pohon $(pohon)"
for p in titik-koma-teks-30okt variabel-sehat-30okt identitas-kosong-31okt; do
  d="$AP/$p/paket-satker"
  echo "### PASANG LAGI $p"
  ( cd "$d" && rm -rf cadangan && ABT_BLANGKO="$AKAR" bash pasang-satker.sh ) 2>&1 | tail -2 | sed 's/^/    /'
done
echo "SESUDAH PASANG LAGI: variabel $(mysql -h 127.0.0.1 -u root -N $ABT_DB -e "SET SESSION group_concat_max_len=1073741824; $SIDIK") pohon $(pohon)"
