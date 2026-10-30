# Paket ABT `abt-bukti-8529-31okt` - bunyi daftar bukti surat tanpa KTP/surat domisili di 8529 (31 Okt 2026)

**Status: diuji di salinan rantai laptop (`aps_badilag_g1r` = salinan `aps_badilag_rantai`, uji-rantai-31okt, sesudah 18 paket).
Server: BELUM dipasang - dipasang sesi utama. URUTAN: SESUDAH SEMUA paket `URUTAN-PASANG-31okt.md` (nomor 19 di sana).**

Keputusan pengguna 31 Okt butir 9: cabang terakhir 8529 (PERTIMBANGAN BUKTI SURAT PERCERAIAN VERSTEK) - dipakai bila daftar bukti surat
(#1214#) tidak memuat KTP maupun surat domisili - berbunyi **"[BUKTI SURAT KTP/SURAT DOMISILI BELUM ADA DI DAFTAR BUKTI]"**, bukan
"[HURUF ALASAN PERCERAIAN BELUM DIPILIH]" (bunyi itu dibawa paket alasan-belum-dipilih dari "TIDAK BENAR QUERY NYA", padahal 8529 tidak
bergantung pada huruf alasan).

## Isi
- Hanya 8529, tepat satu frasa (`<mark>` tetap). Kalimat KTP/domisili dan paragraf murtad (murtad-8529-30okt) tidak disentuh.
- PRASYARAT: md5 8529 ternormal = keadaan sesudah rantai `1|0`; pasang ulang `0|1`; basis sebelum rantai (`aps_badilag_2810`) `0|0` -> berhenti.
- Ekstensi (cabang tinjau-periksa): `abt-panel-blangko.js` FRASA_GALAT + penyorot pratinjau; `blangko-derry-periksa.js` butir "Daftar
  bukti surat belum memuat KTP atau surat domisili" (Perbaiki -> daftar bukti surat), kurung siku tidak disebut dua kali.

## Ukuran
- Banding SEMUA perkara (`alat/banding.js`, mesin variabel ALETA, baca saja): 10.278 perkara - 8.300 berubah, SEMUANYA perkara yang
  keluaran lamanya berbunyi "[HURUF ALASAN PERCERAIAN BELUM DIPILIH]" dan hanya frasa itu yang berganti; berubah lain 0; berbunyi lama
  tetapi tidak berubah 0; galat 0. (8.300 = perkara tanpa daftar bukti surat KTP/domisili, kebanyakan perkara tanpa isian 1214;
  dari 2.117 perkara berdaftar bukti surat, 89 tanpa KTP/domisili.) `hasil/banding-ringkasan.json`.
- Render php56 ABT asli di salinan rantai (`alat/render_bukti.py`): 553/Pdt.G/2026 (daftar bukti kosong) "[HURUF ... BELUM DIPILIH]"
  8 -> 7 (sisanya dari isian huruf alasan yang memang kosong), bunyi baru 1; 235/Pdt.G/2026 (KTP ada) tidak berubah; penanda tersisa 0.
  Catatan laptop: kueri salinan rantai yang tertulis `aps_badilag.` diarahkan ke `aps_badilag_g1r.` agar renderer laptop memakai fungsi
  salinan (md5 ternormal tetap sama; di server tidak perlu).
- Siklus: `hasil/uji-lokal.txt` (2.926 variabel lain tak berubah; pulih = sidik seluruh variabel sama dengan dasar rantai).

## Pasang / pulih (server, root, dari `paket-satker`)
```
bash pasang-satker.sh   # md5 -> PRASYARAT 1|0 -> cadangan baris 8529 -> PASANG (1 transaksi) -> PERIKSA
bash pulih-satker.sh    # -> "PULIH COCOK"
```
