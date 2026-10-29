#!/bin/bash
# Uji siklus paket abt-bas-tanya-jawab-29okt di LAPTOP (Git Bash): PRASYARAT -> pasang -> pasang ulang -> pulih -> gagal(1: satu
# berkas beda md5 = berhenti tanpa mengubah apa pun) -> gagal(2: prasyarat basis salah) -> pasang lagi -> pulih.
# Basis ABT uji: aps_badilag_bas29 (salinan dump server 28 Okt 15.44); blangko uji: salinan berkas sasaran dari pohon dasar.
# Pakai: bash uji_lokal.sh <pohon dasar derry_briantono>
set -u
DASAR="${1:-D:/Aplikasi/aleta/tmp/bas29/dasar3/derry_briantono}"
SINI="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/d/satker asal/website pa bungku/xampp/mysql/bin:$PATH"
P=/d/p29; B=/d/b29/derry_briantono
sidik() { (cd "$B" && find . -type f -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-12); }
siapkan() {
  rm -rf /d/b29 "$P"; mkdir -p "$B" "$P"
  cut -f2 "$SINI/paket-satker/rtf-daftar-tambal.tsv" | while IFS= read -r r; do mkdir -p "$B/$(dirname "$r")"; cp "$DASAR/$r" "$B/$r"; done
  cp "$SINI/paket-satker/"* "$P/"
}
jalan() { (cd "$P" && ABT_LOKAL=1 ABT_DB="${ADB:-aps_badilag_bas29}" ABT_BLANGKO="$B" bash "$1" 2>&1); }
siapkan
AWAL=$(sidik); echo "== sidik awal $AWAL"
echo "== 1. pasang";        jalan pasang-satker.sh | tail -6; S1=$(sidik); echo "sidik $S1"
echo "== 2. pasang ulang";  jalan pasang-satker.sh | tail -4; echo "sidik $(sidik) (harus $S1)"
echo "== 3. pulih";         jalan pulih-satker.sh | tail -3;  echo "sidik $(sidik) (harus $AWAL)"
echo "== 4. gagal: satu berkas disunting sebelum pasang"
f=$(cut -f2 "$P/rtf-daftar-tambal.tsv" | sed -n 5p); printf ' ' >> "$B/$f"; S4=$(sidik)
rm -rf "$P/cadangan"; jalan pasang-satker.sh | tail -3; echo "sidik $(sidik) (harus $S4 = tidak ada yang berubah)"
cp "$DASAR/$f" "$B/$f"; echo "sidik $(sidik) (harus $AWAL)"
echo "== 5. gagal: prasyarat basis tanpa variabel 9259 (basis sementara)"
mysql -h 127.0.0.1 -u root -e "DROP DATABASE IF EXISTS bas29_gagal; CREATE DATABASE bas29_gagal; CREATE TABLE bas29_gagal.abt_variabel LIKE aps_badilag_bas29.abt_variabel; INSERT INTO bas29_gagal.abt_variabel SELECT * FROM aps_badilag_bas29.abt_variabel WHERE no_var <> 9259;"
ADB=bas29_gagal jalan pasang-satker.sh | tail -2; echo "sidik $(sidik) (harus $AWAL)"
mysql -h 127.0.0.1 -u root -e "DROP DATABASE bas29_gagal"
echo "== 6. pasang lagi";   rm -rf "$P/cadangan"; jalan pasang-satker.sh | tail -3; echo "sidik $(sidik) (harus $S1)"
echo "== 7. pulih lagi";    jalan pulih-satker.sh | tail -2;  echo "sidik $(sidik) (harus $AWAL)"
