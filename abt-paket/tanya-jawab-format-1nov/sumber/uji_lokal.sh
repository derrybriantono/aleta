#!/bin/bash
# Uji laptop paket tanya-jawab-format-1nov atas SALINAN pohon sesudah 28 paket + basis ABT salinan (keadaan dasar):
# pasang pertama, pasang ulang (tidak mengubah apa pun), pulih (= pohon & variabel dasar persis), pasang lagi (= pasang pertama),
# penjaga (berkas disunting orang -> pasang menolak tanpa mengubah apa pun; pulih membiarkan berkas yang disunting).
# pakai: ABT_DB=<basis ABT> SIPP_DB=<basis SIPP> bash uji_lokal.sh <akar _blangko_abt salinan (akan DIUBAH)> <folder paket-satker>
set -u
A="$1"; P="$2"
export TMPDIR=/d/Aplikasi/aleta/tmp ABT_LOKAL=1
export PATH="/d/satker asal/website pa bungku/xampp/mysql/bin:$PATH"
ADB="${ABT_DB:-aps_badilag_w164d}"; SDB="${SIPP_DB:-sipp_w164}"
sidik() { (cd "$A" && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32); }
sidikvar() { mysql -h127.0.0.1 -uroot -N --default-character-set=latin1 "$ADB" -e "SET SESSION group_concat_max_len = 100000000; SELECT MD5(GROUP_CONCAT(MD5(CONCAT_WS('|', no_var, nama, data_type, IFNULL(sql_query,''), IFNULL(referensi,''), IFNULL(multi_sidang,''), locked, IFNULL(modifier,''))) ORDER BY no_var SEPARATOR '#')) FROM abt_variabel"; }
jalan() { (cd "$P" && ABT_BLANGKO="$A" ABT_DB="$ADB" SIPP_DB="$SDB" PY=python bash "$1"); }
DASAR=$(sidik); VDASAR=$(sidikvar); echo "dasar pohon (28 paket)  : $DASAR"; echo "dasar variabel (28 paket): $VDASAR"
rm -rf "$P/cadangan"
echo "== pasang pertama"; jalan pasang-satker.sh | grep -E "PRASYARAT|TAMBAL|BERKAS|UJI|CADANGAN|SELESAI|GAGAL|SEMUA"
S0=$(sidik); V0=$(sidikvar); echo "terpasang pohon (29)    : $S0"; echo "terpasang variabel (29) : $V0"
echo "== pasang ulang"; jalan pasang-satker.sh | grep -E "PRASYARAT|SUDAH|UJI|SELESAI|GAGAL"
S1=$(sidik); V1=$(sidikvar); [ "$S1" = "$S0" ] && [ "$V1" = "$V0" ] && echo "PASANG ULANG: tidak ada yang berubah (pohon dan variabel)" || echo "PASANG ULANG: BERUBAH (salah)"
echo "== pulih"; jalan pulih-satker.sh | tail -3
S2=$(sidik); V2=$(sidikvar)
[ "$S2" = "$DASAR" ] && echo "PULIH: seluruh pohon RTF SAMA PERSIS dengan sebelum paket" || echo "PULIH: pohon BEDA dengan dasar (salah)"
[ "$V2" = "$VDASAR" ] && echo "PULIH: seluruh variabel SAMA PERSIS dengan sebelum paket" || echo "PULIH: variabel BEDA dengan dasar (salah)"
echo "== pasang lagi"; rm -rf "$P/cadangan"; jalan pasang-satker.sh | grep -E "PRASYARAT|TAMBAL|UJI|SELESAI|GAGAL"
S3=$(sidik); V3=$(sidikvar); [ "$S3" = "$S0" ] && [ "$V3" = "$V0" ] && echo "PASANG LAGI: sama persis dengan pasang pertama (pohon dan variabel)" || echo "PASANG LAGI: BEDA (salah)"
F="$(sed -n 2p "$P/daftar-tambal.tsv" | cut -f2)"
echo "== penjaga 1: berkas disunting orang sesudah dipasang -> pulih membiarkannya (dilaporkan), yang lain dipulihkan"
printf ' ' >> "$A/$F"
jalan pulih-satker.sh | grep -E "BIARKAN|PULIH" | head -3
echo "== penjaga 2: berkas dasar disunting orang -> pasang menolak tanpa mengubah apa pun"
truncate -s -1 "$A/$F"
K="$(sed -n 2p "$P/daftar-tambal.tsv" | cut -f1)"; cp "$P/cadangan/rtf-lama/$K.rtf" "$A/$F"; printf ' ' >> "$A/$F"
S4a=$(sidik); V4a=$(sidikvar); rm -rf "$P/cadangan.uji"; mv "$P/cadangan" "$P/cadangan.uji"
jalan pasang-satker.sh | grep -E "GAGAL" | head -2
S4b=$(sidik); V4b=$(sidikvar); [ "$S4a" = "$S4b" ] && [ "$V4a" = "$V4b" ] && echo "PENJAGA 2: tidak ada yang berubah (pohon dan variabel)" || echo "PENJAGA 2: BERUBAH (salah)"
truncate -s -1 "$A/$F"; rm -rf "$P/cadangan"; mv "$P/cadangan.uji" "$P/cadangan"
S5=$(sidik); [ "$S5" = "$DASAR" ] && echo "KEMBALI KE DASAR: ya" || echo "KEMBALI KE DASAR: tidak (salah)"
echo "== pasang akhir"; rm -rf "$P/cadangan"; jalan pasang-satker.sh | grep -E "PRASYARAT|TAMBAL|UJI|SELESAI|GAGAL"
S6=$(sidik); V6=$(sidikvar); [ "$S6" = "$S0" ] && [ "$V6" = "$V0" ] && echo "AKHIR: sama persis dengan pasang pertama (pohon dan variabel)" || echo "AKHIR: BEDA (salah)"
