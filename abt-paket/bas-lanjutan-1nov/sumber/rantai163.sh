#!/bin/bash
# Uji rantai 28 paket (agen L): basis aps_badilag_rantai163 = dump server 28 Okt (abt2810.sql), pohon /d/r163 = salinan server 28 Okt (bas29/dasar2),
# paket dari git archive HEAD (cabang bas-lanjutan-ringkas).
set -u
export PATH="/d/satker asal/website pa bungku/xampp/mysql/bin:$PATH" TMPDIR=/d/Aplikasi/aleta/tmp
echo "$(date +%T) siapkan"
mysql -h127.0.0.1 -uroot -e "DROP DATABASE IF EXISTS aps_badilag_rantai163; CREATE DATABASE aps_badilag_rantai163 DEFAULT CHARSET latin1;" || exit 1
mysql -h127.0.0.1 -uroot aps_badilag_rantai163 < /d/Aplikasi/aleta/tmp/bas29/abt2810.sql || exit 1
rm -rf /d/r163 && mkdir -p /d/r163/_blangko_abt /d/r163/ap && cp -r /d/Aplikasi/aleta/tmp/bas29/dasar2/derry_briantono /d/r163/_blangko_abt/ || exit 1
(cd D:/aleta-dev/wt/w163 && git archive HEAD abt-paket) | tar -x -C /d/r163/ap --strip-components=1 || exit 1
for d in /d/r163/ap/*/paket-satker; do (cd "$d" && md5sum -c MD5SUMS.txt >/dev/null 2>&1) || echo "MD5 GAGAL $d"; done
echo "$(date +%T) rantai"
ABT_DB=aps_badilag_rantai163 RANTAI_DIR=/d/r163 bash /d/r163/ap/uji-rantai-31okt/rantai.sh /d/r163/ap
echo "RANTAI-KELUAR $?"
# sesudah 28 paket: pohon harus sama persis dengan uji lokal (pohon sesudah 27 paket /d/r159 + paket 28 = /d/r163u)
echo "sidik pohon rantai : $(cd /d/r163/_blangko_abt && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32)"
echo "sidik uji lokal    : $(cd /d/r163u/_blangko_abt && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32)"
