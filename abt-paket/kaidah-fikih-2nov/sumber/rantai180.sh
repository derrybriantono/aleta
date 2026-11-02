#!/bin/bash
# Uji rantai 32 paket (agen K): basis aps_badilag_rantai180 = dump server 28 Okt (abt2810.sql), pohon /d/r180c = salinan server 28 Okt (bas29/dasar2),
# paket dari git archive cabang kaidah-fikih (paket ke-32), paket ke-31 identitas-pihak-1nov diambil dari cabang umur-bas-halaman bila sudah
# di-commit di sana (revisi tanpa umur, RTF tidak berubah). SIPP salinan sipp_w180 dipakai UJI kueri paket (SIPP_DB).
set -u
export PATH="/d/satker asal/website pa bungku/xampp/mysql/bin:$PATH" TMPDIR=/d/Aplikasi/aleta/tmp SIPP_DB=${SIPP_DB:-sipp_w180}
W=D:/aleta-dev/wt/w180
P31=${P31:-umur-bas-halaman}
echo "$(date +%T) siapkan"
mysql -h127.0.0.1 -uroot -e "DROP DATABASE IF EXISTS aps_badilag_rantai180; CREATE DATABASE aps_badilag_rantai180 DEFAULT CHARSET latin1;" || exit 1
mysql -h127.0.0.1 -uroot aps_badilag_rantai180 < /d/Aplikasi/aleta/tmp/bas29/abt2810.sql || exit 1
rm -rf /d/r180c && mkdir -p /d/r180c/_blangko_abt /d/r180c/ap && cp -r /d/Aplikasi/aleta/tmp/bas29/dasar2/derry_briantono /d/r180c/_blangko_abt/ || exit 1
(cd $W && git archive HEAD abt-paket) | tar -x -C /d/r180c/ap --strip-components=1 || exit 1
if (cd $W && git rev-parse -q --verify "$P31" >/dev/null); then
  rm -rf /d/r180c/ap/identitas-pihak-1nov
  (cd $W && git archive "$P31" abt-paket/identitas-pihak-1nov) | tar -x -C /d/r180c/ap --strip-components=1 || exit 1
  echo "paket ke-31 dari $P31 ($(cd $W && git rev-parse --short "$P31"))"
fi
for d in /d/r180c/ap/*/paket-satker; do (cd "$d" && md5sum -c MD5SUMS.txt >/dev/null 2>&1) || echo "MD5 GAGAL $d"; done
echo "$(date +%T) rantai"
SAMPAI=perbaikan-1nov ABT_DB=aps_badilag_rantai180 RANTAI_DIR=/d/r180c bash /d/r180c/ap/uji-rantai-31okt/rantai.sh /d/r180c/ap || exit 1
# HANYA laptop: fungsi bawaan dump memuat "SIPP." (= basis sipp PA Bungku); arahkan ke salinan SIPP uji agar UJI paket ke-31 membaca perkara yang sama (di server SIPP memang SIPP)
mysql -h127.0.0.1 -uroot -e "UPDATE mysql.proc SET body=REPLACE(body,'SIPP.','$SIPP_DB.'), body_utf8=REPLACE(body_utf8,'SIPP.','$SIPP_DB.') WHERE db='aps_badilag_rantai180' AND body LIKE BINARY '%SIPP.%'"
ABT_DB=aps_badilag_rantai180 RANTAI_DIR=/d/r180c bash /d/r180c/ap/uji-rantai-31okt/rantai.sh /d/r180c/ap identitas-pihak-1nov
echo "RANTAI-KELUAR $?"
echo "sidik pohon rantai : $(cd /d/r180c/_blangko_abt && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32)"
echo "sidik uji lokal    : $(cd /d/Aplikasi/aleta/tmp/w180/uji && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32)"
