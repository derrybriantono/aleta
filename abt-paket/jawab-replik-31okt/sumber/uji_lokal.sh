#!/bin/bash
# Uji laptop paket jawab-replik-31okt atas salinan MILIK SENDIRI (basis aps_badilag_w148 = aps_badilag_rantai2 sesudah 21 paket, pohon
# /d/r148 = salinan /d/r2 sesudah 21 paket): pasang ulang (tidak mengubah apa pun), pulih (= keadaan awal persis), pasang lagi, penjaga
# (9252 disunting -> berhenti). Paket harus SUDAH terpasang sekali sebelum skrip ini dijalankan.
set -u
export PATH="/d/Satker Asal/Website PA Bungku/xampp/mysql/bin:$PATH" TMPDIR=/d/Aplikasi/aleta/tmp
P=$(cd "$(dirname "$0")/../paket-satker" && pwd)
E="ABT_LOKAL=1 ABT_DB=aps_badilag_w148 SIPP_DB=sipp_w148 ABT_BLANGKO=/d/r148/_blangko_abt PY=python"
sidik() {
  mysql -h127.0.0.1 -uroot -N aps_badilag_w148 -e "SET SESSION group_concat_max_len = 1000000000; SELECT MD5(GROUP_CONCAT(CONCAT_WS('|', no_var, nama, data_type, IFNULL(sql_query,'')) ORDER BY no_var SEPARATOR '#')) FROM abt_variabel"
  (cd /d/r148/_blangko_abt && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32)
}
echo "== pasang ulang"; S1=$(sidik); (cd "$P" && env $E bash pasang-satker.sh | grep -E "PRASYARAT|SUDAH|SELESAI|GAGAL"); S2=$(sidik)
[ "$S1" = "$S2" ] && echo "PASANG ULANG: tidak ada yang berubah" || echo "PASANG ULANG: BERUBAH (salah)"
echo "== pulih"; (cd "$P" && env $E bash pulih-satker.sh | tail -3)
mysql -h127.0.0.1 -uroot -N -e "SET SESSION group_concat_max_len = 1000000000; SELECT MD5(GROUP_CONCAT(CONCAT_WS('|', no_var, nama, data_type, IFNULL(sql_query,'')) ORDER BY no_var SEPARATOR '#')) FROM aps_badilag_rantai2.abt_variabel" > /tmp/_w148_a
(cd /d/r2/_blangko_abt && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32) >> /tmp/_w148_a
S3=$(sidik)
[ "$S3" = "$(cat /tmp/_w148_a)" ] && echo "PULIH: variabel dan seluruh pohon RTF SAMA PERSIS dengan sebelum paket" || echo "PULIH: BEDA dengan dasar (salah)"
echo "== pasang lagi"; (cd "$P" && rm -rf cadangan && env $E bash pasang-satker.sh | grep -E "PRASYARAT|TAMBAL|SELESAI|GAGAL"); S4=$(sidik)
[ "$S4" = "$S2" ] && echo "PASANG LAGI: sama persis dengan pasang pertama" || echo "PASANG LAGI: BEDA (salah)"
echo "== penjaga: 9252 disunting orang"
mysql -h127.0.0.1 -uroot aps_badilag_w148 -e "UPDATE abt_variabel SET nama = CONCAT(nama, ' x') WHERE no_var = 9252"
(cd "$P" && env $E bash pasang-satker.sh | grep -E "PRASYARAT|GAGAL" | head -2)
mysql -h127.0.0.1 -uroot aps_badilag_w148 -e "UPDATE abt_variabel SET nama = LEFT(nama, CHAR_LENGTH(nama) - 2) WHERE no_var = 9252"
[ "$(sidik)" = "$S2" ] && echo "PENJAGA: tidak ada yang berubah" || echo "PENJAGA: BERUBAH (salah)"
