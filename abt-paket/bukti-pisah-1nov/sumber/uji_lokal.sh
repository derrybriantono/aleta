#!/bin/bash
# Uji laptop paket bukti-pisah-1nov atas rantai 24 paket MILIK SENDIRI (basis aps_badilag_rantai152b, pohon /d/r152b/_blangko_abt;
# keadaan DASAR = sesudah 23 paket: basis aps_badilag_rantai152, pohon /d/r152/_blangko_abt). Paket harus SUDAH terpasang sekali:
# pasang ulang (tidak mengubah apa pun), pulih (= keadaan dasar persis: variabel DAN seluruh pohon RTF DAN fungsi), pasang lagi (= pasang pertama),
# penjaga (variabel paket disunting orang -> pasang menolak).
set -u
export PATH="/d/Satker Asal/Website PA Bungku/xampp/mysql/bin:$PATH" TMPDIR=/d/Aplikasi/aleta/tmp
P=/d/r152b/ap/bukti-pisah-1nov/paket-satker
E="ABT_LOKAL=1 ABT_DB=aps_badilag_rantai152b SIPP_DB=sipp_w152 ABT_BLANGKO=/d/r152b/_blangko_abt PY=python"
sidik() {  # $1 = basis ABT, $2 = akar pohon
  mysql -h127.0.0.1 -uroot -N "$1" -e "SET SESSION group_concat_max_len = 1000000000; SELECT MD5(GROUP_CONCAT(CONCAT_WS('|', no_var, nama, data_type, IFNULL(sql_query,'')) ORDER BY no_var SEPARATOR '#')), (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = '$1' AND routine_name LIKE 'isian_bukti_%') FROM abt_variabel" | tr '\t' ' '
  (cd "$2" && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32)
}
DASAR="$(sidik aps_badilag_rantai152 /d/r152/_blangko_abt | tr '\n' ' ')"
S0="$(sidik aps_badilag_rantai152b /d/r152b/_blangko_abt | tr '\n' ' ')"
echo "dasar (23 paket) : $DASAR"
echo "terpasang        : $S0"
echo "== pasang ulang"; (cd "$P" && env $E bash pasang-satker.sh | grep -E "PRASYARAT|SUDAH|SELESAI|GAGAL|UJI")
S1="$(sidik aps_badilag_rantai152b /d/r152b/_blangko_abt | tr '\n' ' ')"
[ "$S0" = "$S1" ] && echo "PASANG ULANG: tidak ada yang berubah" || echo "PASANG ULANG: BERUBAH (salah)"
echo "== pulih"; (cd "$P" && env $E bash pulih-satker.sh | tail -3)
S2="$(sidik aps_badilag_rantai152b /d/r152b/_blangko_abt | tr '\n' ' ')"
# fungsi dasar 0 dan variabel serta pohon sama dengan dasar (jumlah variabel/fungsi ikut dibandingkan lewat sidik)
[ "$S2" = "$DASAR" ] && echo "PULIH: variabel, fungsi, dan seluruh pohon RTF SAMA PERSIS dengan sebelum paket" || echo "PULIH: BEDA dengan dasar (salah): $S2"
echo "== pasang lagi"; (cd "$P" && rm -rf cadangan && env $E bash pasang-satker.sh | grep -E "PRASYARAT|TAMBAL|SELESAI|GAGAL")
S3="$(sidik aps_badilag_rantai152b /d/r152b/_blangko_abt | tr '\n' ' ')"
[ "$S3" = "$S0" ] && echo "PASANG LAGI: sama persis dengan pasang pertama" || echo "PASANG LAGI: BEDA (salah)"
echo "== penjaga 1: variabel paket disunting orang -> pasang ulang menolak"
mysql -h127.0.0.1 -uroot aps_badilag_rantai152b -e "UPDATE abt_variabel SET nama = CONCAT(nama, ' x') WHERE no_var = 12040"
(cd "$P" && env $E bash pasang-satker.sh | grep -E "PRASYARAT|GAGAL" | head -2)
mysql -h127.0.0.1 -uroot aps_badilag_rantai152b -e "UPDATE abt_variabel SET nama = LEFT(nama, CHAR_LENGTH(nama) - 2) WHERE no_var = 12040"
S4="$(sidik aps_badilag_rantai152b /d/r152b/_blangko_abt | tr '\n' ' ')"
[ "$S4" = "$S0" ] && echo "PENJAGA 1: tidak ada yang berubah" || echo "PENJAGA 1: BERUBAH (salah)"
