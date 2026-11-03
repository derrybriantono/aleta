#!/bin/bash
# Uji paket di laptop atas SALINAN pohon keadaan server (cadangan 2 Nov + saksi-rapi-3nov + in-lupa-prosesi-3nov +
# ijab-yang-menikahkan-3nov). pohon asli tidak disentuh; salinan di $U.
# pakai (Git Bash): U=<folder salinan> bash sumber/uji_lokal.sh <akar _blangko_abt keadaan server>   -> hasil/uji-lokal.txt
set -u
cd "$(dirname "$0")/.." || exit 1
ASAL="$1"
U="${U:-${TMP:-/tmp}/uji-audit-mekanis-$$}"
P="$(pwd)/paket-satker"
sidik() { (cd "$1" && find derry_briantono -name '*.rtf' -print0 | sort -z | xargs -0 md5sum | md5sum | cut -c1-32); }
salin() { rm -rf "$U"; mkdir -p "$U"; cp -r "$ASAL/derry_briantono" "$U/"; rm -rf "$P/cadangan"; }
jalan() { ABT_BLANGKO="$U" PY=python bash "$P/$1" 2>&1 | sed 's/^/    /'; }
(cd "$P" && md5sum -c MD5SUMS.txt >/dev/null) || { echo "MD5SUMS paket tidak cocok"; exit 1; }
AWAL=$(sidik "$ASAL")
echo "SIDIK AWAL $AWAL"
echo "== 1. pasang pertama"; salin; jalan pasang-satker.sh
SB=$(cd "$U" && python -B "$P/tambal_rtf.py" periksa "$U" | tail -1); echo "    periksa: $SB"
echo "== 2. pasang ulang (idempoten)"; S1=$(sidik "$U"); jalan pasang-satker.sh; [ "$(sidik "$U")" = "$S1" ] && echo "    SIDIK TETAP"
echo "== 3. pulih"; jalan pulih-satker.sh; [ "$(sidik "$U")" = "$AWAL" ] && echo "    SIDIK = AWAL"
echo "== 4. pasang lagi sesudah pulih"; jalan pasang-satker.sh
echo "== 5. md5 server berbeda (satu berkas disunting) -> BERHENTI tanpa ubahan"; salin
printf ' ' >> "$U/derry_briantono/2 Itsbat Nikah/[03] [Tolak] IN - Rukun Tidak Terpenuhi (Wali Tidak Sah).rtf"; S5=$(sidik "$U")
jalan pasang-satker.sh; [ "$(sidik "$U")" = "$S5" ] && echo "    TIDAK ADA YANG BERUBAH"
echo "== 6. paket ijab belum terpasang (5 berkas [01]-[01e] keadaan sebelum ijab) -> BERHENTI tanpa ubahan"; salin
L="${IJAB_LAMA:-}"
if [ -n "$L" ] && [ -d "$L" ]; then
  python -B - "$U" "$L" <<'PY'
import os, sys, shutil
u, l = sys.argv[1], sys.argv[2]
peta = {'I001': '[01] [Kabul] IN.rtf', 'I002': '[01a] [Kabul] IN - Syahadah Al Istifadhah.rtf', 'I003': '[01b] [Kabul] IN Itsbat Terpadu.rtf',
        'I004': '[01d] [Kabul] IN - Format Lengkap Rukun dan Syarat per Unsur.rtf', 'I005': '[01e] [Kabul] IN - Satu Pemohon (Pasangan Meninggal, Voluntair).rtf'}
for k, n in peta.items():
    shutil.copyfile(os.path.join(l, k + '.rtf'), os.path.join(u, 'derry_briantono', '2 Itsbat Nikah', n))
PY
  S6=$(sidik "$U"); jalan pasang-satker.sh | grep -v '^    GAGAL	' ; [ "$(sidik "$U")" = "$S6" ] && echo "    TIDAK ADA YANG BERUBAH"
else
  echo "    (dilewati: IJAB_LAMA tidak diberikan)"
fi
echo "== 7. disunting sesudah pasang lalu pulih -> dibiarkan"; salin; jalan pasang-satker.sh >/dev/null
printf ' ' >> "$U/derry_briantono/2 Itsbat Nikah/[03] [Tolak] IN - Rukun Tidak Terpenuhi (Wali Tidak Sah).rtf"; jalan pulih-satker.sh | grep -v '^    GAGAL	'
rm -rf "$U" "$P/cadangan"
