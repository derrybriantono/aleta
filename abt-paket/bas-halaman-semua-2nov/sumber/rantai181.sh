#!/bin/bash
# Uji rantai 33 paket (agen V2, w181): paket 1-30 dari salinan baru, lalu ke-31 REVISI (identitas-pihak-1nov tanpa umur) dan ke-33 (bas-halaman-semua-2nov).
# basis aps_badilag_r181c = dump server 28 Okt (abt2810.sql), pohon /d/r181c = salinan server 28 Okt (bas29/dasar2), paket dari git archive HEAD.
# SIPP salinan ($SIPP_DB) dipakai UJI paket ke-31 (baca saja). Paket ke-32 (kaidah-fikih-2nov) dari cabang lain, belum ada di sini.
set -u
export PATH="/d/satker asal/website pa bungku/xampp/mysql/bin:$PATH" TMPDIR=/d/Aplikasi/aleta/tmp SIPP_DB=${SIPP_DB:-sipp_w177}
echo "$(date +%T) siapkan"
mysql -h127.0.0.1 -uroot -e "DROP DATABASE IF EXISTS aps_badilag_r181c; CREATE DATABASE aps_badilag_r181c DEFAULT CHARSET latin1;" || exit 1
mysql -h127.0.0.1 -uroot aps_badilag_r181c < /d/Aplikasi/aleta/tmp/bas29/abt2810.sql || exit 1
rm -rf /d/r181c && mkdir -p /d/r181c/_blangko_abt /d/r181c/ap && cp -r /d/Aplikasi/aleta/tmp/bas29/dasar2/derry_briantono /d/r181c/_blangko_abt/ || exit 1
(cd D:/aleta-dev/wt/w181 && git archive HEAD abt-paket) | tar -x -C /d/r181c/ap --strip-components=1 || exit 1
for d in /d/r181c/ap/*/paket-satker; do (cd "$d" && md5sum -c MD5SUMS.txt >/dev/null 2>&1) || echo "MD5 GAGAL $d"; done
echo "$(date +%T) rantai tahap 1 (sampai perbaikan-1nov)"
SAMPAI=perbaikan-1nov ABT_DB=aps_badilag_r181c RANTAI_DIR=/d/r181c bash /d/r181c/ap/uji-rantai-31okt/rantai.sh /d/r181c/ap
echo "sidik pohon sesudah 30 paket: $(cd /d/r181c/_blangko_abt && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32) (harus 9931cdd9c3f77cb0575d9ab9ec9322ee)"
# HANYA laptop: fungsi bawaan dump memuat "SIPP." (= basis sipp PA Bungku); arahkan ke salinan SIPP uji agar UJI paket ke-31 membaca perkara yang sama (di server SIPP memang SIPP)
mysql -h127.0.0.1 -uroot -e "UPDATE mysql.proc SET body=REPLACE(body,'SIPP.','$SIPP_DB.'), body_utf8=REPLACE(body_utf8,'SIPP.','$SIPP_DB.') WHERE db='aps_badilag_r181c' AND body LIKE BINARY '%SIPP.%'"
echo "$(date +%T) rantai tahap 2 (ke-31 revisi dan ke-33)"
ABT_DB=aps_badilag_r181c RANTAI_DIR=/d/r181c bash /d/r181c/ap/uji-rantai-31okt/rantai.sh /d/r181c/ap identitas-pihak-1nov
echo "RANTAI-KELUAR $?"
echo "sidik pohon rantai : $(cd /d/r181c/_blangko_abt && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32)"
echo "sidik uji lokal 33 : $(cd /d/r181/uji33 && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32)"
echo "$(date +%T) selesai"
