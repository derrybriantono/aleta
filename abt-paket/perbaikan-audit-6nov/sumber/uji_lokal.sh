#!/bin/bash
# Uji paket di laptop atas SALINAN berkas paket (hanya berkas yang disentuh, bukan pohon utuh) dan skema uji. Pohon dasar dan skema lain tidak disentuh.
# pakai (Git Bash): ABT_DB=<skema uji berisi paket pendahulu> DASAR=<akar berisi derry_briantono keadaan sesudah saksi-tanya-jawab-43-5nov> \
#   SEBELUM=<akar derry_briantono sebelum a5-merah-5nov, untuk uji paket pendahulu belum terpasang> U=<folder kerja> bash sumber/uji_lokal.sh  -> hasil/uji-lokal.txt
set -u
cd "$(dirname "$0")/.." || exit 1
ASAL="$DASAR"
U="${U:-${TMP:-/tmp}/uji-perbaikan-$$}"
P="$(pwd)/paket-satker"
export ABT_LOKAL=1 ABT_DB="${ABT_DB:-aps_badilag_w223}" PY=python
M="mysql -h 127.0.0.1 -u root --default-character-set=latin1 -N $ABT_DB"
sidik() { (cd "$1" && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32); }
snap() { $M -e "SET SESSION group_concat_max_len=1000000000; SELECT COUNT(*), MD5(GROUP_CONCAT(CONCAT_WS('|',no_var,nama,data_type,IFNULL(sql_query,''),IFNULL(default_data,''),locked,IFNULL(modifier,'')) ORDER BY no_var)) FROM abt_variabel" | tr '\t\r' ' '; }
salin() {
  rm -rf "$U"
  grep -v '^#' "$P/daftar-tambal.tsv" | cut -f2 | tr -d '\r' | while IFS= read -r r; do mkdir -p "$U/$(dirname "$r")"; cp "$1/$r" "$U/$r"; done
  mkdir -p "$U/derry_briantono/ALUR 10 Cerai Talak Sidang Ikrar Talak"
  rm -rf "$P/cadangan"
}
jalan() { ABT_BLANGKO="$U" bash "$P/$1" 2>&1 | sed 's/^/    /' | grep -v 'md5 .* bukan dasar'; }
(cd "$P" && md5sum -c MD5SUMS.txt >/dev/null) || { echo "MD5SUMS paket tidak cocok"; exit 1; }
salin "$ASAL"
AWAL=$(sidik "$U"); V0=$(snap)
echo "SIDIK AWAL $AWAL ; VARIABEL AWAL $V0"
echo "== 1. pasang pertama"; jalan pasang-satker.sh
(cd "$P" && python -B tambal_rtf.py periksa "$U" | tail -1 | sed 's/^/    periksa: /')
echo "== 2. pasang ulang (idempoten)"; S1=$(sidik "$U"); V1=$(snap); jalan pasang-satker.sh; [ "$(sidik "$U")" = "$S1" ] && [ "$(snap)" = "$V1" ] && echo "    SIDIK & VARIABEL TETAP"
[ "$V1" = "$V0" ] && echo "    VARIABEL TIDAK BERUBAH OLEH PASANG"
echo "== 3. pulih"; jalan pulih-satker.sh; [ "$(sidik "$U")" = "$AWAL" ] && echo "    SIDIK BERKAS = AWAL"; [ "$(snap)" = "$V0" ] && echo "    VARIABEL = AWAL"
ls "$P/cadangan/rtf-baru-dipulihkan" 2>/dev/null | sed 's/^/    dipindah ke cadangan: /'
echo "== 4. pasang lagi sesudah pulih"; rm -rf "$P/cadangan/rtf-baru-dipulihkan"; jalan pasang-satker.sh; [ "$(sidik "$U")" = "$S1" ] && [ "$(snap)" = "$V1" ] && echo "    SAMA DENGAN PASANG PERTAMA"
jalan pulih-satker.sh | tail -1
echo "== 5. satu berkas disunting -> BERHENTI tanpa ubahan"; salin "$ASAL"
printf ' ' >> "$U/derry_briantono/1a Perceraian CT/[02] [Kabul] CT - F.rtf"
S5=$(sidik "$U"); jalan pasang-satker.sh; [ "$(sidik "$U")" = "$S5" ] && [ "$(snap)" = "$V0" ] && echo "    TIDAK ADA YANG BERUBAH"
echo "== 6. paket pendahulu belum terpasang (berkas sebelum a5-merah-5nov) -> BERHENTI tanpa ubahan"
if [ -n "${SEBELUM:-}" ] && [ -d "$SEBELUM/derry_briantono" ]; then
  salin "$SEBELUM"; S6=$(sidik "$U"); jalan pasang-satker.sh | tail -3; [ "$(sidik "$U")" = "$S6" ] && [ "$(snap)" = "$V0" ] && echo "    TIDAK ADA YANG BERUBAH"
else
  echo "    (dilewati: SEBELUM tidak diberikan)"
fi
echo "== 7. berkas lain bernama [4] sudah ada -> BERHENTI tanpa ubahan"; salin "$ASAL"
printf 'bukan paket' > "$U/derry_briantono/ALUR 10 Cerai Talak Sidang Ikrar Talak/[4] BAS Ikrar Talak - P & T Tidak Hadir, Tunda Tenggang Waktu 6 Bulan.rtf"
S7=$(sidik "$U"); jalan pasang-satker.sh | tail -5; [ "$(sidik "$U")" = "$S7" ] && [ "$(snap)" = "$V0" ] && echo "    TIDAK ADA YANG BERUBAH"
echo "== 8. rumus 9100 berubah -> PRASYARAT BERHENTI tanpa ubahan"; salin "$ASAL"; S8=$(sidik "$U")
ASLI=$($M -e "SELECT HEX(sql_query) FROM abt_variabel WHERE no_var = 9100" | tr -d '\r')
$M -e "UPDATE abt_variabel SET sql_query = CONCAT(sql_query, ' ') WHERE no_var = 9100"
jalan pasang-satker.sh | tail -3; [ "$(sidik "$U")" = "$S8" ] && echo "    BERKAS TIDAK BERUBAH"
$M -e "UPDATE abt_variabel SET sql_query = UNHEX('$ASLI') WHERE no_var = 9100"; [ "$(snap)" = "$V0" ] && echo "    VARIABEL = AWAL (rumus 9100 dikembalikan)"
echo "== 9. disunting sesudah pasang lalu pulih -> dibiarkan"; salin "$ASAL"; jalan pasang-satker.sh >/dev/null
printf ' ' >> "$U/derry_briantono/1a Perceraian CT/[02] [Kabul] CT - F.rtf"; jalan pulih-satker.sh | tail -5
rm -rf "$U" "$P/cadangan"; [ "$(snap)" = "$V0" ] && echo "AKHIR: VARIABEL = AWAL"
