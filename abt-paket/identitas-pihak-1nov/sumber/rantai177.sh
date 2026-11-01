#!/bin/bash
# Uji rantai 31 paket (agen V): basis aps_badilag_rantai177 = dump server 28 Okt (abt2810.sql), pohon /d/r177c = salinan server 28 Okt (bas29/dasar2),
# paket dari git archive HEAD (cabang identitas-pihak, paket ke-31). SIPP salinan sipp_w177 dipakai UJI kueri paket (SIPP_DB).
set -u
export PATH="/d/satker asal/website pa bungku/xampp/mysql/bin:$PATH" TMPDIR=/d/Aplikasi/aleta/tmp SIPP_DB=${SIPP_DB:-sipp_w177}
echo "$(date +%T) siapkan"
mysql -h127.0.0.1 -uroot -e "DROP DATABASE IF EXISTS aps_badilag_rantai177; CREATE DATABASE aps_badilag_rantai177 DEFAULT CHARSET latin1;" || exit 1
mysql -h127.0.0.1 -uroot aps_badilag_rantai177 < /d/Aplikasi/aleta/tmp/bas29/abt2810.sql || exit 1
rm -rf /d/r177c && mkdir -p /d/r177c/_blangko_abt /d/r177c/ap && cp -r /d/Aplikasi/aleta/tmp/bas29/dasar2/derry_briantono /d/r177c/_blangko_abt/ || exit 1
(cd D:/aleta-dev/wt/w177 && git archive HEAD abt-paket) | tar -x -C /d/r177c/ap --strip-components=1 || exit 1
for d in /d/r177c/ap/*/paket-satker; do (cd "$d" && md5sum -c MD5SUMS.txt >/dev/null 2>&1) || echo "MD5 GAGAL $d"; done
echo "$(date +%T) rantai"
SAMPAI=perbaikan-1nov ABT_DB=aps_badilag_rantai177 RANTAI_DIR=/d/r177c bash /d/r177c/ap/uji-rantai-31okt/rantai.sh /d/r177c/ap
# HANYA laptop: fungsi bawaan dump memuat "SIPP." (= basis sipp PA Bungku); arahkan ke salinan SIPP uji agar UJI paket ke-31 membaca perkara yang sama (di server SIPP memang SIPP)
mysql -h127.0.0.1 -uroot -e "UPDATE mysql.proc SET body=REPLACE(body,'SIPP.','$SIPP_DB.'), body_utf8=REPLACE(body_utf8,'SIPP.','$SIPP_DB.') WHERE db='aps_badilag_rantai177' AND body LIKE BINARY '%SIPP.%'"
ABT_DB=aps_badilag_rantai177 RANTAI_DIR=/d/r177c bash /d/r177c/ap/uji-rantai-31okt/rantai.sh /d/r177c/ap identitas-pihak-1nov
echo "RANTAI-KELUAR $?"
echo "sidik pohon rantai : $(cd /d/r177c/_blangko_abt && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32)"
echo "sidik uji lokal    : $(cd /d/Aplikasi/aleta/tmp/w177/pohon29 && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32)"
