#!/bin/bash
# Uji laptop paket bas-halaman-1nov atas SALINAN pohon sesudah 26 paket (rantai sendiri /d/r159 bila ada, selainnya salinan /d/r155f).
# pasang pertama, pasang ulang (tidak mengubah apa pun), pulih (= pohon dasar persis), pasang lagi (= pasang pertama),
# penjaga (berkas disunting orang -> pasang menolak tanpa mengubah apa pun; pulih membiarkan berkas yang disunting).
# pakai: bash uji_lokal.sh <akar _blangko_abt salinan (akan DIUBAH)> <folder paket-satker>
set -u
A="$1"; P="$2"
export TMPDIR=/d/Aplikasi/aleta/tmp
sidik() { (cd "$A" && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32); }
jalan() { (cd "$P" && ABT_BLANGKO="$A" PY=python bash "$1"); }
DASAR=$(sidik); echo "dasar (26 paket)  : $DASAR"
rm -rf "$P/cadangan"
echo "== pasang pertama"; jalan pasang-satker.sh | grep -E "PRASYARAT|TAMBAL|BERKAS|SELESAI|GAGAL"
S0=$(sidik); echo "terpasang (27)    : $S0"
echo "== pasang ulang"; jalan pasang-satker.sh | grep -E "PRASYARAT|SUDAH|SELESAI|GAGAL"
S1=$(sidik); [ "$S1" = "$S0" ] && echo "PASANG ULANG: tidak ada yang berubah" || echo "PASANG ULANG: BERUBAH (salah)"
echo "== pulih"; jalan pulih-satker.sh | tail -2
S2=$(sidik); [ "$S2" = "$DASAR" ] && echo "PULIH: seluruh pohon RTF SAMA PERSIS dengan sebelum paket" || echo "PULIH: BEDA dengan dasar (salah)"
echo "== pasang lagi"; rm -rf "$P/cadangan"; jalan pasang-satker.sh | grep -E "PRASYARAT|TAMBAL|SELESAI|GAGAL"
S3=$(sidik); [ "$S3" = "$S0" ] && echo "PASANG LAGI: sama persis dengan pasang pertama" || echo "PASANG LAGI: BEDA (salah)"
F="$(sed -n 2p "$P/daftar-tambal.tsv" | cut -f2)"
echo "== penjaga 1: berkas disunting orang sesudah dipasang -> pulih membiarkannya (dilaporkan), yang lain dipulihkan"
printf ' ' >> "$A/$F"
jalan pulih-satker.sh | grep -E "BIARKAN|PULIH" | head -3
echo "== penjaga 2: berkas dasar disunting orang -> pasang menolak tanpa mengubah apa pun"
truncate -s -1 "$A/$F"; cp "$A/$F" "$TMPDIR/uji159-satu.rtf"
# kembalikan berkas itu ke keadaan dasar dari cadangan paket, lalu sunting
K="$(sed -n 2p "$P/daftar-tambal.tsv" | cut -f1)"; cp "$P/cadangan/rtf-lama/$K.rtf" "$A/$F"; printf ' ' >> "$A/$F"
S4a=$(sidik); rm -rf "$P/cadangan.uji"; mv "$P/cadangan" "$P/cadangan.uji"
jalan pasang-satker.sh | grep -E "GAGAL" | head -2
S4b=$(sidik); [ "$S4a" = "$S4b" ] && echo "PENJAGA 2: tidak ada yang berubah" || echo "PENJAGA 2: BERUBAH (salah)"
truncate -s -1 "$A/$F"; rm -rf "$P/cadangan"; mv "$P/cadangan.uji" "$P/cadangan"
S5=$(sidik); [ "$S5" = "$DASAR" ] && echo "KEMBALI KE DASAR: ya" || echo "KEMBALI KE DASAR: tidak (salah)"
echo "== pasang akhir"; rm -rf "$P/cadangan"; jalan pasang-satker.sh | grep -E "PRASYARAT|TAMBAL|SELESAI|GAGAL"
S6=$(sidik); [ "$S6" = "$S0" ] && echo "AKHIR: sama persis dengan pasang pertama" || echo "AKHIR: BEDA (salah)"
