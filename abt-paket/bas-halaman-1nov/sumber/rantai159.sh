#!/bin/bash
# Uji rantai 27 paket (agen I1): basis aps_badilag_rantai159 = dump server 28 Okt (abt2810.sql), pohon /d/r159 = salinan server 28 Okt (bas29/dasar2),
# paket dari git archive HEAD (cabang bas-halaman-runut).
set -u
export PATH="/d/satker asal/website pa bungku/xampp/mysql/bin:$PATH" TMPDIR=/d/Aplikasi/aleta/tmp
echo "$(date +%T) siapkan"
mysql -h127.0.0.1 -uroot -e "DROP DATABASE IF EXISTS aps_badilag_rantai159; CREATE DATABASE aps_badilag_rantai159 DEFAULT CHARSET latin1;" || exit 1
mysql -h127.0.0.1 -uroot aps_badilag_rantai159 < /d/Aplikasi/aleta/tmp/bas29/abt2810.sql || exit 1
rm -rf /d/r159 && mkdir -p /d/r159/_blangko_abt /d/r159/ap && cp -r /d/Aplikasi/aleta/tmp/bas29/dasar2/derry_briantono /d/r159/_blangko_abt/ || exit 1
(cd D:/aleta-dev/wt/w159 && git archive HEAD abt-paket) | tar -x -C /d/r159/ap --strip-components=1 || exit 1
for d in /d/r159/ap/*/paket-satker; do (cd "$d" && md5sum -c MD5SUMS.txt >/dev/null 2>&1) || echo "MD5 GAGAL $d"; done
echo "$(date +%T) rantai"
ABT_DB=aps_badilag_rantai159 RANTAI_DIR=/d/r159 bash /d/r159/ap/uji-rantai-31okt/rantai.sh /d/r159/ap
echo "RANTAI-KELUAR $?"
# sesudah 27 paket: pohon harus sama persis dengan uji lokal (salinan r155f + paket 27)
echo "sidik pohon rantai : $(cd /d/r159/_blangko_abt && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32)"
echo "sidik uji lokal    : $(cd /d/r159u/_blangko_abt && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32)"
