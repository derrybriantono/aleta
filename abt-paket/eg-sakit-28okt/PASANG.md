# Paket ABT `abt-eg-sakit-28okt` - huruf E: pihak yang sakit dari rincian 5227; gabungan huruf disebut lengkap (28 Okt 2026)

**Status: TERPASANG di server 28 Okt 15.09** (cadangan + pulih di `/root/abt-eg-sakit-20261028/`, salinan di `D:/aleta-dev/cadangan-db/abt-eg-sakit-20261028`).

## Sebab
Perkara 627/Pdt.G/2026 (8503 = FE, Penggugat sakit stroke):
- 8521, 8522, 8528, 8531 selalu menulis **Tergugat** yang mendapat cacat badan/penyakit, dan 8530 mengutip Al-Muwatha' (istri yang suaminya sakit) walau yang sakit istri.
- 8522 paragraf F pada gabungan huruf hanya menyebut "Pasal 19 huruf (f) ... Pasal 116 huruf (f)".

## Isi
- `sp`/`sis` di subkueri k: pihak yang sakit = #0046# bila rincian 5227 menyebut #0046# sakit/menderita/mengidap/mengalami (strok, lumpuh, ...)/cacat dan tidak menyebut #0047# begitu; selain itu #0047# (perilaku lama).
- 8522: paragraf E memakai `sp`/`sis`; paragraf Pasal 75 lama hanya bila yang sakit #0047#; paragraf Pasal 75 baru bila yang sakit #0046#; paragraf F menyebut semua huruf (`lpp` = a-f untuk Pasal 19 PP 9/1975, `lkhi` = a-h untuk Pasal 116 KHI) + "secara kumulatif" bila lebih dari satu huruf.
- 8521, 8528, 8531: pihak sakit `sp`/`sis`. 8530: Al-Muwatha' hanya bila yang sakit suami.

## Ukuran (386 perkara ber-8503 di server, `banding.py`)
Galat lama 0 / baru 0. Berubah: 627 (5 variabel) dan 10170 (ADF: "Pasal 19 huruf (a), (d), dan (f) ... Pasal 116 huruf (a), (d), dan (f) ... secara kumulatif"). Selebihnya identik.

## Pasang / periksa / pulih
`mysql < abt-eg-sakit-28okt-PERIKSA.sql` (LAMA/BARU/LAIN) -> `PASANG.sql` (UPDATE bersyarat md5 lama) -> PERIKSA = BARU. Pulih: `PULIH.sql` (bersyarat md5 baru).
