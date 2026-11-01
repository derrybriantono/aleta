#!/bin/bash
# Uji laptop paket teks-pihak-1nov atas rantai 26 paket MILIK SENDIRI (basis aps_badilag_rantai155f, pohon /d/r155f/_blangko_abt, paket dari git archive).
# keadaan DASAR = sesudah 25 paket: basis aps_badilag_rantai155, pohon /d/r155/_blangko_abt (tidak pernah diubah). Paket harus SUDAH terpasang sekali:
# pasang ulang (tidak mengubah apa pun), pulih (= keadaan dasar persis: variabel, SEMUA fungsi, DAN seluruh pohon RTF), pasang lagi (= pasang pertama),
# penjaga (variabel paket disunting orang -> pasang menolak; berkas disunting -> pulih membiarkan).
set -u
export PATH="/d/Satker Asal/Website PA Bungku/xampp/mysql/bin:$PATH" TMPDIR=/d/Aplikasi/aleta/tmp
P=/d/r155f/ap/teks-pihak-1nov/paket-satker
E="ABT_LOKAL=1 ABT_DB=aps_badilag_rantai155f SIPP_DB=sipp_w155 ABT_BLANGKO=/d/r155f/_blangko_abt PY=python"
sidik() {  # $1 = basis ABT, $2 = akar pohon
  mysql -h127.0.0.1 -uroot -N "$1" -e "SET SESSION group_concat_max_len = 1000000000; SELECT MD5(GROUP_CONCAT(CONCAT_WS('|', no_var, nama, data_type, IFNULL(sql_query,'')) ORDER BY no_var SEPARATOR '#')), (SELECT MD5(GROUP_CONCAT(CONCAT_WS('|', routine_name, MD5(routine_definition)) ORDER BY routine_name SEPARATOR '#')) FROM information_schema.routines WHERE routine_schema = '$1'), (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = '$1') FROM abt_variabel" | tr '\t' ' '
  (cd "$2" && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32)
}
DASAR="$(sidik aps_badilag_rantai155 /d/r155/_blangko_abt | tr '\n' ' ')"
S0="$(sidik aps_badilag_rantai155f /d/r155f/_blangko_abt | tr '\n' ' ')"
echo "dasar (25 paket) : $DASAR"
echo "terpasang (26)   : $S0"
echo "== pasang ulang"; (cd "$P" && env $E bash pasang-satker.sh | grep -E "PRASYARAT|SUDAH|SELESAI|GAGAL|UJI")
S1="$(sidik aps_badilag_rantai155f /d/r155f/_blangko_abt | tr '\n' ' ')"
[ "$S0" = "$S1" ] && echo "PASANG ULANG: tidak ada yang berubah" || echo "PASANG ULANG: BERUBAH (salah)"
echo "== pulih"; (cd "$P" && env $E bash pulih-satker.sh | tail -3)
S2="$(sidik aps_badilag_rantai155f /d/r155f/_blangko_abt | tr '\n' ' ')"
[ "$S2" = "$DASAR" ] && echo "PULIH: variabel, SEMUA fungsi, dan seluruh pohon RTF SAMA PERSIS dengan sebelum paket" || echo "PULIH: BEDA dengan dasar (salah): $S2"
echo "== pasang lagi"; (cd "$P" && rm -rf cadangan && env $E bash pasang-satker.sh | grep -E "PRASYARAT|TAMBAL|SELESAI|GAGAL")
S3="$(sidik aps_badilag_rantai155f /d/r155f/_blangko_abt | tr '\n' ' ')"
[ "$S3" = "$S0" ] && echo "PASANG LAGI: sama persis dengan pasang pertama" || echo "PASANG LAGI: BEDA (salah)"
echo "== penjaga 1: variabel paket disunting orang -> pasang ulang menolak, tidak ada yang berubah"
mysql -h127.0.0.1 -uroot aps_badilag_rantai155f -e "UPDATE abt_variabel SET nama = CONCAT(nama, ' x') WHERE no_var = 12100"
(cd "$P" && env $E bash pasang-satker.sh | grep -E "PRASYARAT|GAGAL" | head -2)
mysql -h127.0.0.1 -uroot aps_badilag_rantai155f -e "UPDATE abt_variabel SET nama = LEFT(nama, CHAR_LENGTH(nama) - 2) WHERE no_var = 12100"
S4="$(sidik aps_badilag_rantai155f /d/r155f/_blangko_abt | tr '\n' ' ')"
[ "$S4" = "$S0" ] && echo "PENJAGA 1: tidak ada yang berubah" || echo "PENJAGA 1: BERUBAH (salah)"
echo "== penjaga 2: variabel lama 9255 disunting orang -> pasang pertama menolak (uji pada keadaan dasar)"
(cd "$P" && env $E bash pulih-satker.sh | tail -1)
mysql -h127.0.0.1 -uroot aps_badilag_rantai155f -e "UPDATE abt_variabel SET nama = CONCAT(nama, ' x') WHERE no_var = 9255"
(cd "$P" && rm -rf cadangan && env $E bash pasang-satker.sh | grep -E "PRASYARAT|GAGAL" | head -2)
mysql -h127.0.0.1 -uroot aps_badilag_rantai155f -e "UPDATE abt_variabel SET nama = LEFT(nama, CHAR_LENGTH(nama) - 2) WHERE no_var = 9255"
S5="$(sidik aps_badilag_rantai155f /d/r155f/_blangko_abt | tr '\n' ' ')"
[ "$S5" = "$DASAR" ] && echo "PENJAGA 2: tidak ada yang berubah (tetap keadaan dasar)" || echo "PENJAGA 2: BERUBAH (salah): $S5"
echo "== pasang lagi (kembali ke terpasang)"; (cd "$P" && rm -rf cadangan && env $E bash pasang-satker.sh | grep -E "PRASYARAT|TAMBAL|SELESAI|GAGAL")
S6="$(sidik aps_badilag_rantai155f /d/r155f/_blangko_abt | tr '\n' ' ')"
[ "$S6" = "$S0" ] && echo "AKHIR: sama persis dengan pasang pertama" || echo "AKHIR: BEDA (salah)"
