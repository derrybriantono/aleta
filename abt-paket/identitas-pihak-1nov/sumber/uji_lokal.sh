#!/bin/bash
# Uji laptop paket identitas-pihak-1nov atas SALINAN pohon sesudah 30 paket + basis ABT salinan (keadaan dasar):
# pasang pertama, pasang ulang (tidak mengubah apa pun), pulih (= pohon, variabel DAN fungsi dasar persis), pasang lagi (= pasang pertama),
# penjaga (berkas disunting orang -> pulih membiarkannya; variabel disunting orang -> pasang menolak tanpa mengubah apa pun).
# pakai: ABT_DB=<basis ABT> SIPP_DB=<basis SIPP> bash uji_lokal.sh <akar _blangko_abt salinan (akan DIUBAH)> <folder paket-satker>
set -u
A="$1"; P="$2"
export TMPDIR=/d/Aplikasi/aleta/tmp ABT_LOKAL=1
export PATH="/d/satker asal/website pa bungku/xampp/mysql/bin:$PATH"
ADB="${ABT_DB:-aps_badilag_w177d}"; SDB="${SIPP_DB:-sipp_w177}"
sidik() { (cd "$A" && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32); }
sidikvar() { mysql -h127.0.0.1 -uroot -N --default-character-set=latin1 "$ADB" -e "SET SESSION group_concat_max_len = 100000000; SELECT MD5(GROUP_CONCAT(MD5(CONCAT_WS('|', no_var, nama, data_type, IFNULL(sql_query,''), IFNULL(referensi,''), IFNULL(default_data,''), IFNULL(multi_sidang,''), IFNULL(locked,''))) ORDER BY no_var))  FROM abt_variabel"; }
sidikfn() { mysql -h127.0.0.1 -uroot -N "$ADB" -e "SET SESSION group_concat_max_len = 100000000; SELECT COUNT(*), MD5(GROUP_CONCAT(CONCAT(routine_name, MD5(REPLACE(routine_definition, '$SDB.', 'SIPP.'))) ORDER BY routine_name)) FROM information_schema.routines WHERE routine_schema='$ADB'" | tr '\t\r' ' '; }
jalan() { (cd "$P" && ABT_BLANGKO="$A" ABT_DB="$ADB" SIPP_DB="$SDB" PY=python bash "$1"); }
DASAR=$(sidik); VDASAR=$(sidikvar); FDASAR=$(sidikfn)
echo "dasar pohon (30 paket)   : $DASAR"; echo "dasar variabel (30 paket): $VDASAR"; echo "dasar fungsi (30 paket)  : $FDASAR"
rm -rf "$P/cadangan"
echo "== pasang pertama"; jalan pasang-satker.sh | grep -E "PRASYARAT|TAMBAL|BERKAS|UJI|CADANGAN|FUNGSI|SELESAI|GAGAL|SEMUA"
S0=$(sidik); V0=$(sidikvar); F0=$(sidikfn); echo "terpasang pohon (31)     : $S0"; echo "terpasang variabel (31)  : $V0"; echo "terpasang fungsi (31)    : $F0"
echo "== pasang ulang"; jalan pasang-satker.sh | grep -E "PRASYARAT|SUDAH|UJI identitas|SELESAI|GAGAL"
S1=$(sidik); V1=$(sidikvar); F1=$(sidikfn); [ "$S1" = "$S0" ] && [ "$V1" = "$V0" ] && [ "$F1" = "$F0" ] && echo "PASANG ULANG: tidak ada yang berubah (pohon, variabel, fungsi)" || echo "PASANG ULANG: BERUBAH (salah)"
echo "== pulih"; jalan pulih-satker.sh | tail -4
S2=$(sidik); V2=$(sidikvar); F2=$(sidikfn)
[ "$S2" = "$DASAR" ] && echo "PULIH: seluruh pohon RTF SAMA PERSIS dengan sebelum paket" || echo "PULIH: pohon BEDA dengan dasar (salah)"
[ "$V2" = "$VDASAR" ] && echo "PULIH: seluruh variabel SAMA PERSIS dengan sebelum paket" || echo "PULIH: variabel BEDA dengan dasar (salah)"
[ "$F2" = "$FDASAR" ] && echo "PULIH: seluruh fungsi SAMA PERSIS dengan sebelum paket" || echo "PULIH: fungsi BEDA dengan dasar (salah)"
echo "== pasang lagi"; rm -rf "$P/cadangan"; jalan pasang-satker.sh | grep -E "PRASYARAT|TAMBAL|UJI identitas|SELESAI|GAGAL"
S3=$(sidik); V3=$(sidikvar); F3=$(sidikfn); [ "$S3" = "$S0" ] && [ "$V3" = "$V0" ] && [ "$F3" = "$F0" ] && echo "PASANG LAGI: sama persis dengan pasang pertama (pohon, variabel, fungsi)" || echo "PASANG LAGI: BEDA (salah)"
F="$(sed -n 2p "$P/daftar-tambal.tsv" | cut -f2)"
echo "== penjaga 1: berkas disunting orang sesudah dipasang -> pulih membiarkannya (dilaporkan), yang lain dipulihkan"
printf ' ' >> "$A/$F"
jalan pulih-satker.sh | grep -E "BIARKAN|PULIH" | head -3
echo "== penjaga 2: berkas dasar disunting orang -> pasang menolak tanpa mengubah apa pun"
truncate -s -1 "$A/$F"
K="$(sed -n 2p "$P/daftar-tambal.tsv" | cut -f1)"; cp "$P/cadangan/rtf-lama/$K.rtf" "$A/$F"; printf ' ' >> "$A/$F"
S4a=$(sidik); V4a=$(sidikvar); F4a=$(sidikfn); rm -rf "$P/cadangan.uji"; mv "$P/cadangan" "$P/cadangan.uji"
jalan pasang-satker.sh | grep -E "GAGAL" | head -2
S4b=$(sidik); V4b=$(sidikvar); F4b=$(sidikfn); [ "$S4a" = "$S4b" ] && [ "$V4a" = "$V4b" ] && [ "$F4a" = "$F4b" ] && echo "PENJAGA 2: tidak ada yang berubah (pohon, variabel, fungsi)" || echo "PENJAGA 2: BERUBAH (salah)"
truncate -s -1 "$A/$F"; rm -rf "$P/cadangan"; mv "$P/cadangan.uji" "$P/cadangan"
S5=$(sidik); [ "$S5" = "$DASAR" ] && echo "KEMBALI KE DASAR: ya" || echo "KEMBALI KE DASAR: tidak (salah)"
echo "== penjaga 3: variabel 7047 disunting orang -> pasang menolak tanpa mengubah apa pun (pohon, variabel, fungsi)"
jalan pulih-satker.sh | tail -1
rm -rf "$P/cadangan"
mysql -h127.0.0.1 -uroot --default-character-set=latin1 "$ADB" -e "UPDATE abt_variabel SET sql_query=CONCAT(sql_query, ' ') WHERE no_var=7047"
S6a=$(sidik); V6a=$(sidikvar); F6a=$(sidikfn)
jalan pasang-satker.sh | grep -E "GAGAL" | head -2
S6b=$(sidik); V6b=$(sidikvar); F6b=$(sidikfn); [ "$S6a" = "$S6b" ] && [ "$V6a" = "$V6b" ] && [ "$F6a" = "$F6b" ] && echo "PENJAGA 3: tidak ada yang berubah (pohon, variabel, fungsi)" || echo "PENJAGA 3: BERUBAH (salah)"
mysql -h127.0.0.1 -uroot --default-character-set=latin1 "$ADB" -e "UPDATE abt_variabel SET sql_query=TRIM(TRAILING ' ' FROM sql_query) WHERE no_var=7047"
[ "$(sidikvar)" = "$VDASAR" ] && echo "SESUDAH PENJAGA 3 = KEADAAN DASAR: ya" || echo "SESUDAH PENJAGA 3 = KEADAAN DASAR: tidak (salah)"
echo "== pasang akhir"; rm -rf "$P/cadangan"; jalan pasang-satker.sh | grep -E "PRASYARAT|TAMBAL|UJI identitas|SELESAI|GAGAL"
S7=$(sidik); V7=$(sidikvar); F7=$(sidikfn); [ "$S7" = "$S0" ] && [ "$V7" = "$V0" ] && [ "$F7" = "$F0" ] && echo "AKHIR: sama persis dengan pasang pertama (pohon, variabel, fungsi)" || echo "AKHIR: BEDA (salah)"
